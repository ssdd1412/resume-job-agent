"""
Parse-Resume handler — EdgeOne Makers
========================================

文件路径 agents/parse-resume/index.py 自动映射为 **POST /parse-resume**。

用途：用户上传已有的 PDF / DOCX / TXT 简历，这里把文字抽出来返回给前端。
前端拿到纯文本后，会把它拼进对话消息发给 /chat，由模型做诊断与润色。

请求：{ "file_name": "陈静-简历.pdf", "base64": "..." }
返回：{ "ok": true, "filename": ..., "chars": 1234, "pages": 1, "text": "...", "note": "" }
"""

from .._logger import create_logger

logger = create_logger("parse-resume")

# 与 agents/resume_parser.py 的 MAX_BYTES 呼应：base64 比原文件大 4/3
MAX_B64_CHARS = 14 * 1024 * 1024


async def handler(context):
    body = context.request.body or {}
    if not isinstance(body, dict):
        body = {}

    file_name = (body.get("file_name") or body.get("filename") or "").strip()
    b64 = body.get("base64") or body.get("content") or ""

    if isinstance(b64, str) and len(b64) > MAX_B64_CHARS:
        return {
            "status_code": 413,
            "body": {"ok": False, "error": "文件超过 10MB 上限，请压缩后再上传。"},
        }

    # 延迟导入，避免解析依赖出问题时整个路由无法启动
    try:
        from ..resume_parser import parse_resume_payload
    except Exception as e:
        logger.error(f"import resume_parser failed: {type(e).__name__}: {e}")
        return {
            "status_code": 500,
            "body": {"ok": False, "error": f"文件解析组件加载失败：{e}"},
        }

    result = parse_resume_payload(file_name, b64)
    if not result.get("ok"):
        logger.error(f"parse failed: {file_name} -> {result.get('error')}")
        return {"status_code": 400, "body": result}

    logger.log(
        f"parsed {result['filename']} -> {result['chars']} chars"
        + (f", {result['pages']} pages" if result.get("pages") else "")
    )
    return {"status_code": 200, "body": result}
