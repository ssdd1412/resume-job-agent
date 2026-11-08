"""本地端到端验证：上传简历 PDF → 解析 → 润色 → 定稿下发。

用法：.venv/Scripts/python.exe dev/test_polish.py
"""
import base64
import importlib.util
import json
import os
import sys
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://127.0.0.1:8088"


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CID = "polish-test-" + uuid.uuid4().hex[:8]


def post(path, payload, stream=False):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "makers-conversation-id": CID},
        method="POST",
    )
    resp = urllib.request.urlopen(req, timeout=300)
    if not stream:
        return json.load(resp)
    return resp


WEAK_RESUME = """# 王小明

**求职意向：数据分析**

## 个人经历

- 负责参与公司的一些数据处理工作，配合团队完成相关任务
- 协助上级完成各类报表，参与部门日常事务
- 参与了数据平台项目，负责部分内容

## 专业技能

- 会使用 excel
- python 还行，会一点 sql
- 沟通能力强，学习能力强，有责任心

## 教育背景

某某大学 信息管理 本科
"""


def main():
    pdf_mod = load("pdf", "agents/resume_pdf.py")
    pdf_bytes = pdf_mod.build_pdf(WEAK_RESUME)
    print(f"[1] 生成测试简历 PDF：{len(pdf_bytes)} 字节")

    r = post("/parse-resume", {
        "file_name": "王小明-简历.pdf",
        "base64": base64.b64encode(pdf_bytes).decode(),
    })
    print(f"[2] 解析：ok={r.get('ok')} chars={r.get('chars')} pages={r.get('pages')}")
    if not r.get("ok"):
        print("    失败：", r.get("error"))
        return 1
    text = r["text"]
    print("    ---- 解析出的文本 ----")
    for line in text.splitlines():
        print("    |", line)

    prompt = "\n".join([
        "请帮我修改润色这份简历：保留全部真实经历，把表达改得更专业、更贴合数据分析岗位。",
        f"文件名：{r['filename']}",
        "<<<RESUME_SOURCE>>>",
        text,
        "<<<END_RESUME_SOURCE>>>",
    ])
    print(f"[3] 发送到 /chat（提示词 {len(prompt)} 字）…")

    resp = post("/chat", {"message": prompt, "userId": "polish-test"}, stream=True)
    counts, injected, notes = {}, 0, []
    current_event = None
    for raw in resp:
        line = raw.decode("utf-8").rstrip("\n")
        if line.startswith("event: "):
            current_event = line[7:]
        elif line.startswith("data: ") and current_event:
            counts[current_event] = counts.get(current_event, 0) + 1
            data = json.loads(line[6:])
            if current_event == "text_delta":
                injected += len(data.get("delta", ""))
            if current_event in ("error", "tool_called", "resume_ready"):
                print(f"    <{current_event}> {json.dumps(data, ensure_ascii=False)[:220]}")
            current_event = None

    print(f"[4] 事件统计：{counts}")
    print(f"[5] 下发的正文总量：{injected} 字")
    ok = counts.get("tool_called", 0) >= 1 and counts.get("resume_ready", 0) >= 1 and injected > 300
    print("[6] 结论：", "通过 ✅" if ok else "未通过 ❌")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
