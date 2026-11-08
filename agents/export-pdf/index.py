"""
Export-PDF handler — EdgeOne Makers
========================================

文件路径 agents/export-pdf/index.py 自动映射为 **POST /export-pdf**。

用途：把前端已经拿到的简历 Markdown 无状态地渲染成 PDF，返回 Base64。
它和 /chat 里 export_resume_pdf 工具的区别：
  - 工具路径：模型决定导出 → 服务端内存缓存 → 通过 pdf_ready 事件下发字节
  - 本路由：前端点「下载 PDF」时按需转换，不依赖任何服务端状态
两者共用 agents/resume_pdf.py 的 export_payload()。

请求：{ "markdown": "...", "file_name": "可选" }
返回：{ "ok": true, "filename": "...", "size": 12345, "base64": "..." }
"""

from .._logger import create_logger

logger = create_logger("export-pdf")


async def handler(context):
    body = context.request.body or {}
    if not isinstance(body, dict):
        body = {}

    markdown = body.get("markdown") or ""
    file_name = (body.get("file_name") or "").strip()

    # 延迟导入，避免 PDF 依赖缺失时连带整个路由无法启动
    try:
        from ..resume_pdf import export_payload
    except Exception as e:
        logger.error(f"import resume_pdf failed: {type(e).__name__}: {e}")
        return {
            "status_code": 500,
            "body": {"ok": False, "error": f"PDF 组件加载失败：{e}"},
        }

    result = export_payload(markdown, file_name)
    if not result.get("ok"):
        logger.error(f"export failed: {result.get('error')}")
        return {"status_code": 400, "body": result}

    logger.log(f"generated {result['filename']} ({result['size']} bytes)")
    return {"status_code": 200, "body": result}
