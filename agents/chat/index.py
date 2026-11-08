"""
Agent handler — EdgeOne Makers
========================================

The file path agents/chat/index.py is auto-mapped to **POST /chat**.
(EdgeOne Makers convention: directory name = route name, `index` is the default entry.)

`context` contract:
    context.request.body    — dict, request body
    context.request.signal  — asyncio.Event, set when /chat/stop is called
    context.conversation_id — conversation ID
    context.run_id          — run ID for this invocation
    context.store           — EdgeOne built-in store; provides openai_session() and friends
"""

from typing import Any, AsyncGenerator
import asyncio
import base64
import json
import os

from dotenv import load_dotenv
from openai import AsyncOpenAI
from openai.types.responses import ResponseTextDeltaEvent
from agents import Agent, OpenAIChatCompletionsModel, Runner

from .._logger import create_logger
from .._tools import generate_resume, match_jobs, save_jobs, export_resume_pdf


load_dotenv()

logger = create_logger("chat")


# ========== LLM Model ==========
# 变量名说明：
# AI_GATEWAY_* 是 EdgeOne Makers 的保留前缀，平台可能用自己的网关凭证覆盖它，
# 那样会出现「平台的 key + 百炼的 base_url」→ 401 Invalid API key。
# 因此优先读 DASHSCOPE_*（自定义命名，平台不干预），读不到再回退到 AI_GATEWAY_*。
API_KEY = os.getenv("DASHSCOPE_API_KEY") or os.getenv("AI_GATEWAY_API_KEY")
BASE_URL = os.getenv("DASHSCOPE_BASE_URL") or os.getenv("AI_GATEWAY_BASE_URL")
MODEL_NAME = (
    os.getenv("DASHSCOPE_MODEL")
    or os.getenv("AI_GATEWAY_MODEL")
    or "@makers/deepseek-v4-flash"
)

logger.log(
    f"llm config: model={MODEL_NAME} base={BASE_URL} "
    f"key_len={len(API_KEY or '')} key_src={'DASHSCOPE' if os.getenv('DASHSCOPE_API_KEY') else 'AI_GATEWAY'}"
)

llm_client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)

llm_model = OpenAIChatCompletionsModel(
    model=MODEL_NAME,
    openai_client=llm_client,
)


# ========== Agent ==========
agent = Agent(
    name="ResumeJobAgent",
    instructions=(
        "你是一个「简历生成 + 工作匹配」智能体，运行在 EdgeOne Makers 上，基于 OpenAI Agents SDK。\n"
        "你的目标：帮助用户生成专业简历，并基于真实招聘信息推荐最匹配的工作。\n\n"
        "【核心原则：少问、先做】\n"
        "用户一旦表露出「写简历 / 生成简历 / 帮我做个简历」的意图，且已提供姓名或专业方向、技能、经历中的任意两项，"
        "就【立即调用 generate_resume】，不要为了凑齐字段反复追问。\n"
        "缺失的字段留空或写「待补充」，然后在结果末尾一次性列出 1~3 个最值得补充的点，让用户补完后再重新生成。\n"
        "最多只做一轮追问；用户说「就用这些」「先这样」时，直接用现有信息生成。\n\n"
        "【工具使用】\n"
        "- generate_resume(profile_json)：把用户口述的信息整理成结构化 JSON（name / target_role / contact / summary / "
        "skills / education / experience / projects / certifications / languages），再调用它生成 Markdown 简历。\n"
        "- match_jobs(resume_text, jobs_json)：拿到简历正文后立即调用；jobs_json 留空表示读取招聘库 jobs.json；"
        "用户粘贴了真实招聘信息时，把 JSON 数组传给 jobs_json。\n"
        "- save_jobs(jobs_json)：用户明确要求把招聘信息长期保存时调用。\n"
        "- export_resume_pdf(resume_markdown, file_name)：用户要「PDF 版 / 可下载版本 / 打印版」时调用，"
        "resume_markdown 必须传 generate_resume 的原文，不要传摘要。调用成功后只需说一句"
        "「PDF 已生成，点击下方按钮下载」并写出文件名和体积；"
        "【不要】向用户解释系统实现（禁止出现「系统会自动附上入口」「后端已下发」这类说法），"
        "也不要输出 Base64 或编造下载链接。\n"
        "- 用户只要了简历、没提 PDF 时，不要主动调用 export_resume_pdf。\n"
        "- 用户只要求「生成简历」时，不要顺手调用 match_jobs；等用户明确说「帮我匹配岗位」再调。\n\n"
        "【不得编造（最高优先级）】\n"
        "- 只使用用户提供的真实信息。不得虚构公司、学校、时间、奖项、指标数字。\n"
        "- 严禁以「合理凝练」「适当润色」的名义新增量化成果（例如凭空写「提升 20%」）。可以润色措辞，不可以创造事实。\n"
        "- 招聘信息必须来自用户提供或招聘库，不得凭空生成岗位；招聘库为空时如实告知，并请用户粘贴真实 JD。\n\n"
        "【回复格式】\n"
        "本系统会把你调用 generate_resume 得到的简历正文自动完整展示在对话里，因此你【不要重复输出简历正文】，"
        "只需在简历之后用 1~3 条要点说明「哪里还可以补强、补什么」。\n"
        "匹配结果按「岗位 → 匹配度 → 命中要求 → 待补强缺口」的列表或表格呈现（这部分由你输出），然后给 1~3 条建议。\n"
        "用中文，专业、简洁、不啰嗦。"
    ),
    tools=[generate_resume, match_jobs, save_jobs, export_resume_pdf],
    model=llm_model,
)


# ========== SSE Helper ==========
def sse_event(event: str, data: dict) -> str:
    """Format a single SSE event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ========== Event Stream Generator ==========
async def _event_stream(
    message: str,
    session=None,
    cancel_signal: asyncio.Event | None = None,
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE frames from the agent stream.

    Accepts cancel_signal to enable cancellation — when set,
    the loop breaks and the SDK releases its connection.
    """
    result = Runner.run_streamed(agent, input=message, session=session)

    # call_id -> tool name，用于把 tool_output 归到具体工具上
    tool_names: dict[str, str] = {}

    async for event in result.stream_events():
        # Check cancel between each event
        if cancel_signal and cancel_signal.is_set():
            break

        # Raw token delta → push per-character
        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            delta = event.data.delta or ""
            if delta:
                logger.log(f"[stream] text_delta: {repr(delta)}")
                yield sse_event("text_delta", {"delta": delta})

        # Semantic event → tool called
        elif event.type == "run_item_stream_event":
            if event.name == "tool_called":
                item = event.item
                raw = getattr(item, "raw_item", None)
                tool_name = (
                    getattr(item, "tool_name", None)
                    or getattr(item, "name", None)
                    or getattr(raw, "name", None)
                )
                call_id = getattr(item, "call_id", None) or (
                    getattr(raw, "call_id", None) or getattr(raw, "id", None)
                )
                if tool_name and call_id:
                    tool_names[call_id] = tool_name
                if tool_name:
                    logger.log(f"[stream] tool_called: {tool_name}")
                    yield sse_event("tool_called", {"tool": tool_name})

            # 简历正文由后端直接推给前端：不依赖模型是否愿意复述，
            # 保证用户一定能看到完整 Markdown 简历。
            elif event.name == "tool_output":
                item = event.item
                raw = getattr(item, "raw_item", None)
                # 注意：tool_output 的 raw_item 是 dict，不是对象
                call_id = getattr(item, "call_id", None) or (
                    raw.get("call_id") if isinstance(raw, dict) else getattr(raw, "call_id", None)
                )
                name = tool_names.get(call_id) if call_id else None
                if name == "generate_resume":
                    out = getattr(item, "output", None)
                    if isinstance(out, str) and out.strip():
                        logger.log(f"[stream] inject resume markdown ({len(out)} chars)")
                        yield sse_event("text_delta", {"delta": out.rstrip() + "\n\n"})
                        # 告知前端这一屏是简历，可以就地提供「下载 PDF」入口
                        yield sse_event("resume_ready", {"chars": len(out)})

                # PDF 由后端直接下发：工具只回传一个小体积的 pdf_id，
                # 真实字节走 pdf_ready 事件，避免把 Base64 灌进模型上下文。
                elif name == "export_resume_pdf":
                    out = getattr(item, "output", None)
                    meta: dict = {}
                    if isinstance(out, str) and out.strip():
                        try:
                            meta = json.loads(out)
                        except (json.JSONDecodeError, TypeError):
                            meta = {}
                    pdf_id = meta.get("pdf_id") if isinstance(meta, dict) else None
                    pdf_bytes = None
                    if pdf_id:
                        try:
                            from ..resume_pdf import cache_get
                            pdf_bytes = cache_get(pdf_id)
                        except Exception as e:
                            logger.error(f"[stream] pdf cache miss: {type(e).__name__}: {e}")
                    if pdf_bytes:
                        logger.log(
                            f"[stream] emit pdf_ready: {meta.get('filename')} "
                            f"({len(pdf_bytes)} bytes)"
                        )
                        yield sse_event("pdf_ready", {
                            "filename": meta.get("filename") or "简历.pdf",
                            "size": len(pdf_bytes),
                            "base64": base64.b64encode(pdf_bytes).decode(),
                        })
                    else:
                        logger.error("[stream] pdf_ready skipped: 未取到 PDF 字节")


# ========== Core Handler ==========
async def handler(context: Any) -> AsyncGenerator[str, None]:
    """EdgeOne Makers entry point.

    Uses OpenAI Agents SDK session for automatic memory:
      - SDK calls session.get_items() to inject history
      - SDK calls session.add_items() to persist assistant replies and tool results
    """
    request = context.request
    body = request.body
    message = body.get("message") if isinstance(body, dict) else None

    if not message:
        yield sse_event("error", {"message": "'message' is required"})
        yield sse_event("done", {})
        return

    # Accept both camelCase (chat handler historical convention) and snake_case
    # (cloud-functions convention) as a body field name for the user id.
    raw_user_id = ""
    if isinstance(body, dict):
        raw_user_id = body.get("userId") or body.get("user_id") or ""
    user_id = str(raw_user_id).strip() or None

    # Session for memory persistence
    cid = context.conversation_id

    logger.log(f"[request] cid={cid}, uid={user_id or '-'}, message={message[:50]!r}")

    # Write a user-indexed copy of the user message ONLY on the first turn of
    # this conversation, so /conversations (which scans the
    # user_conversation_index prefix) can list this thread.
    #
    # Why first-turn-only:
    #   - The OpenAI Agents SDK Session adapter does NOT pass user_id when it
    #     persists turns, so without a user-indexed write the user index stays
    #     empty and list_conversations(user_id=...) returns [].
    #   - But the index lives at the (user_id, conversation_id) level — once
    #     a single message has been written under this user_id, the
    #     conversation is reachable. Writing a user-indexed copy on every turn
    #     just produces duplicates that downstream consumers have to dedupe
    #     (see cloud-functions/conversations/index.py and history/index.py)
    #     and surfaces a duplicated user message in OpenAI Agents SDK traces
    #     because the SDK's session.get_items() will re-feed it as input
    #     alongside the new `message` argument.
    #   - We therefore probe with get_messages(limit=1); if the conversation
    #     already has any record, the index is established and we skip.
    #
    # The /history route already filters by metadata.agent_sdk_session and
    # dedupes adjacent items, so the chat window stays clean either way —
    # but the trace dashboard shows raw SDK input, hence the visible doubling.
    body_keys_preview = list(body.keys()) if isinstance(body, dict) else None
    logger.log(
        f"[user-index] body keys={body_keys_preview!r} "
        f"raw_user_id={raw_user_id!r} normalized_user_id={user_id!r} cid={cid!r}"
    )
    if user_id and cid:
        try:
            existing = await context.store.get_messages(
                conversation_id=cid, limit=1
            )
            already_indexed = bool(existing)
        except Exception as e:
            # If the probe fails, fall through to writing — better to leave
            # a duplicate than to lose the user index entirely.
            logger.error(
                f"[user-index] probe failed: {type(e).__name__}: {e}; "
                f"will write user-index entry anyway"
            )
            already_indexed = False

        if already_indexed:
            logger.log(
                f"[user-index] SKIPPED user-index write: cid={cid} already has "
                f"messages, user index for user_id={user_id!r} is established"
            )
        else:
            try:
                # NOTE: the Python store.append_message() does NOT accept a
                # `message_id` kwarg (unlike the TS counterpart) — the SDK
                # auto-generates one. Passing it raises TypeError, which
                # silently kills the user-index write.
                msg_id = await context.store.append_message(
                    conversation_id=cid,
                    role="user",
                    content=message,
                    user_id=user_id,
                )
                logger.log(
                    f"[user-index] WROTE first-turn user-indexed message: cid={cid} "
                    f"user_id={user_id} msg_id={msg_id!r}"
                )
            except Exception as e:
                # Non-fatal — chat itself should keep working even if the
                # user-index write fails.
                logger.error(f"[user-index] FAILED to write user index: {type(e).__name__}: {e}")
    else:
        logger.log(
            f"[user-index] SKIPPED user-index write: user_id={user_id!r} cid={cid!r} "
            f"(both must be truthy to trigger the write — this is why "
            f"/conversations would return empty for this user)"
        )

    session = context.store.openai_session(cid) if cid else None

    # Cancel signal (asyncio.Event), set when /chat/stop is called
    cancel_signal = request.signal
    stopped = False

    try:
        async for frame in _event_stream(message, session, cancel_signal):
            if cancel_signal.is_set():
                stopped = True
                break
            yield frame
    except asyncio.CancelledError:
        stopped = True
        logger.log("[stream] cancelled")
    except Exception as e:
        logger.error(f"[stream] error: {type(e).__name__}: {e}")
        # Try to surface upstream HTTP error body (e.g. OpenAI SDK APIStatusError) to the TRACE panel
        detail: Any = str(e)
        status: Any = None
        response = getattr(e, "response", None)
        if response is not None:
            status = getattr(response, "status_code", None)
            try:
                body_text = response.text if hasattr(response, "text") else None
                if callable(body_text):
                    body_text = body_text()
                if body_text:
                    try:
                        detail = json.loads(body_text)
                    except (json.JSONDecodeError, ValueError, TypeError):
                        detail = body_text
            except Exception:
                pass
        body_attr = getattr(e, "body", None)
        if body_attr and detail == str(e):
            detail = body_attr
        yield sse_event("error", {
            "message": str(e),
            "errorType": type(e).__name__,
            "status": status,
            "detail": detail,
        })
    finally:
        yield sse_event("done", {"stopped": stopped})
