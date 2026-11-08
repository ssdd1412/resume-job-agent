"""
本地运行器（不需要 EdgeOne 账号）——只为本地/离线演示，不参与线上部署。

它做的事情，和 EdgeOne Makers 运行时提供的完全一致：
  POST /chat                  → 复用 agents/chat/index.py 的 agent + SSE 流
  POST /stop                  → 中断当前生成
  POST /history               → 读取会话历史（SQLiteSession）
  POST /export-pdf            → 简历 Markdown 渲染成 PDF（与线上同源）
  POST /parse-resume          → 上传的 PDF/DOCX/TXT 简历抽成纯文本
  POST /conversations         → 侧边栏会话列表
  POST /delete-conversation   → 删除会话
  GET  /*                     → 返回 dist/ 里的前端构建产物

启动：
  .venv/Scripts/python.exe dev/local_server.py
然后浏览器打开 http://127.0.0.1:8088

实现要点：HTTP 处理是同步多线程的，而 agent 是异步的，所以这里跑一个
**常驻事件循环**（独立线程）。绝不能在每个请求里 asyncio.run()——
aiosqlite / httpx 的连接会绑定到首次使用它的循环，循环一关，下一轮就
报 "Event loop is closed"。

注意：线上部署走 EdgeOne Makers，会用它自带的 context.store；
本文件不参与云端构建（Makers 只加载 agents/ 与 cloud-functions/）。
"""

from __future__ import annotations

import asyncio
import importlib
import json
import mimetypes
import os
import queue
import sys
import threading
import time
import types
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
INDEX_DB = os.path.join(PROJECT_ROOT, ".local_conversations.db")
META_PATH = os.path.join(PROJECT_ROOT, ".local_conversations.json")

sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# ── 把 agents/ 目录伪装成包，直接复用线上同一份 chat 代码 ────────────────
_pkg = types.ModuleType("eoagents")
_pkg.__path__ = [os.path.join(PROJECT_ROOT, "agents")]
sys.modules["eoagents"] = _pkg
_chat = importlib.import_module("eoagents.chat.index")
_event_stream = _chat._event_stream

from agents.memory import SQLiteSession  # noqa: E402

# ── 常驻事件循环 ──────────────────────────────────────────────────────
_loop = asyncio.new_event_loop()
threading.Thread(target=_loop.run_forever, daemon=True, name="agent-loop").start()


def _new_session(cid: str) -> SQLiteSession:
    """Session 必须在常驻循环里创建，否则会绑定到临时循环。"""
    return SQLiteSession(cid, db_path=INDEX_DB)


# ── 会话元数据（侧边栏标题 / 最后活跃时间）────────────────────────────
_meta_lock = threading.Lock()


def _load_meta() -> dict:
    try:
        with open(META_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_meta(meta: dict) -> None:
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def _touch_conversation(cid: str, user_id: str, message: str) -> None:
    with _meta_lock:
        meta = _load_meta()
        entry = meta.get(cid) or {}
        title = entry.get("title") or (message[:8] + ("..." if len(message) > 8 else ""))
        entry.update({
            "id": cid,
            "title": title,
            "userId": user_id,
            "lastMessageAt": int(time.time() * 1000),
        })
        meta[cid] = entry
        _save_meta(meta)


# ── 取消信号 ──────────────────────────────────────────────────────────
_cancel_events: dict[str, asyncio.Event] = {}
_cancel_lock = threading.Lock()


def _flatten(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [str(p["text"]) for p in content if isinstance(p, dict) and p.get("text")]
        return "\n".join(parts)
    return ""


async def _read_items(cid: str) -> list:
    try:
        return await _new_session(cid).get_items()
    except Exception:
        return []


def _build_history(cid: str) -> list[dict]:
    """把 SQLiteSession 里的原始 items 转成前端 Message[]。"""
    try:
        items = asyncio.run_coroutine_threadsafe(_read_items(cid), _loop).result(timeout=30)
    except Exception:
        return []

    bubbles: list[dict] = []
    for it in items:
        if not isinstance(it, dict) or it.get("type") not in (None, "message"):
            continue
        role = it.get("role")
        if role not in ("user", "assistant"):
            continue
        text = _flatten(it.get("content"))
        if not text.strip():
            continue
        if bubbles and bubbles[-1]["role"] == role == "assistant":
            bubbles[-1]["content"] += "\n\n" + text
        elif bubbles and bubbles[-1]["role"] == role == "user" and bubbles[-1]["content"] == text:
            continue
        else:
            bubbles.append({
                "id": str(uuid.uuid4()),
                "role": role,
                "content": text,
                "timestamp": int(time.time() * 1000) - (len(bubbles) * 1000),
            })
    return bubbles


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ResumeJobAgentLocal/1.0"

    # ── 工具方法 ────────────────────────────────────────────────
    def _json(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8")) or {}
        except Exception:
            return {}

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and args[0].startswith("GET /"):
            return
        sys.stderr.write("[local] %s\n" % (fmt % args))

    # ── 路由 ────────────────────────────────────────────────────
    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_body()

        if path == "/chat":
            return self._handle_chat(body)

        if path == "/stop":
            cid = str(body.get("conversation_id") or "")
            with _cancel_lock:
                ev = _cancel_events.get(cid)
            if ev:
                _loop.call_soon_threadsafe(ev.set)
            return self._json(200, {"status": "aborting" if ev else "idle"})

        if path == "/history":
            cid = str(body.get("conversation_id") or "")
            return self._json(200, {"conversation_id": cid, "messages": _build_history(cid) if cid else []})

        if path == "/conversations":
            meta = _load_meta()
            user_id = body.get("user_id")
            limit = int(body.get("limit") or 20)
            rows = [v for v in meta.values() if not user_id or v.get("userId") == user_id]
            rows.sort(key=lambda x: x.get("lastMessageAt", 0), reverse=True)
            return self._json(200, {"conversations": rows[:limit]})

        if path == "/delete-conversation":
            cid = str(body.get("conversation_id") or "")
            with _meta_lock:
                meta = _load_meta()
                meta.pop(cid, None)
                _save_meta(meta)
            return self._json(200, {"status": "deleted"})

        if path == "/export-pdf":
            # 与线上 agents/export-pdf/index.py 共用同一份 export_payload()
            try:
                from eoagents.resume_pdf import export_payload
            except Exception as e:
                return self._json(500, {"ok": False, "error": f"PDF 组件加载失败：{e}"})
            result = export_payload(
                body.get("markdown") or "", (body.get("file_name") or "").strip()
            )
            return self._json(200 if result.get("ok") else 400, result)

        if path == "/parse-resume":
            # 与线上 agents/parse-resume/index.py 共用同一份 parse_resume_payload()
            try:
                from eoagents.resume_parser import parse_resume_payload
            except Exception as e:
                return self._json(500, {"ok": False, "error": f"文件解析组件加载失败：{e}"})
            result = parse_resume_payload(
                (body.get("file_name") or "").strip(), body.get("base64") or ""
            )
            return self._json(200 if result.get("ok") else 400, result)

        if path == "/clear-history":
            cid = str(body.get("conversation_id") or "")

            async def _clear():
                await _new_session(cid).clear_session()

            try:
                asyncio.run_coroutine_threadsafe(_clear(), _loop).result(timeout=30)
            except Exception:
                pass
            return self._json(200, {"status": "cleared"})

        return self._json(404, {"error": "not found"})

    # ── SSE 流 ──────────────────────────────────────────────────
    def _handle_chat(self, body: dict) -> None:
        message = (body.get("message") or "").strip()
        cid = (self.headers.get("makers-conversation-id") or body.get("conversationId")
               or body.get("conversation_id") or str(uuid.uuid4()))
        user_id = str(body.get("userId") or body.get("user_id") or "").strip()

        if not message:
            return self._json(400, {"error": "message is required"})

        _touch_conversation(cid, user_id, message)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Transfer-Encoding", "chunked")
        # 流式响应不复用连接：服务重启后浏览器手里的 keep-alive 连接会变成
        # 死连接，下次发消息直接失败。每个 SSE 请求独立一条连接就不会串。
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

        def write(frame: str) -> None:
            data = frame.encode("utf-8")
            self.wfile.write(b"%X\r\n" % len(data) + data + b"\r\n")
            self.wfile.flush()

        q: "queue.Queue[str | None]" = queue.Queue()

        async def producer() -> None:
            cancel = asyncio.Event()
            with _cancel_lock:
                _cancel_events[cid] = cancel
            stopped = False
            try:
                session = _new_session(cid)          # 在常驻循环里创建
                async for frame in _event_stream(message, session, cancel):
                    q.put(frame)
                    if cancel.is_set():
                        stopped = True
                        break
            except Exception as e:
                q.put(_chat.sse_event("error", {"message": f"{type(e).__name__}: {e}"}))
            finally:
                with _cancel_lock:
                    _cancel_events.pop(cid, None)
                q.put(_chat.sse_event("done", {"stopped": stopped}))
                q.put(None)

        fut = asyncio.run_coroutine_threadsafe(producer(), _loop)

        try:
            while True:
                item = q.get()
                if item is None:
                    break
                write(item)
        except (BrokenPipeError, ConnectionResetError):
            fut.cancel()
        finally:
            try:
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
            except Exception:
                pass

    # ── 静态资源 ────────────────────────────────────────────────
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"
        target = os.path.join(DIST_DIR, path.lstrip("/").replace("/", os.sep))
        if not os.path.isfile(target):
            target = os.path.join(DIST_DIR, "index.html")
        if not os.path.isfile(target):
            return self._json(404, {"error": "dist 未构建，先执行 npm run build"})

        ctype = mimetypes.guess_type(target)[0] or "application/octet-stream"
        with open(target, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    port = int(os.environ.get("PORT", "8088"))
    if not os.path.isdir(DIST_DIR):
        print("[local] 缺少 dist/，请先运行: npm run build")
    print(f"[local] 简历+工作匹配 Agent 本地运行中 → http://127.0.0.1:{port}")
    print(f"[local] 模型: {os.getenv('AI_GATEWAY_MODEL')} @ {os.getenv('AI_GATEWAY_BASE_URL')}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
