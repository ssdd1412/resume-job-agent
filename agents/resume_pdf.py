"""
Markdown 简历 → PDF 渲染器

设计要点：
- 不依赖任何外部字体文件：使用 reportlab 内置的 CID 字体 STSong-Light 渲染中文，
  这样在 EdgeOne Makers 的沙箱里也能直接跑，不需要额外上传 ttf。
- 只识别 generate_resume 产出的那套 Markdown 结构（# 姓名 / ## 章节 / - 列表 /
  **粗体** / --- 分隔 / > 提示），同时兼容简单表格，避免渲染出乱码。
- 生成结果是 bytes，调用方可以决定是走 SSE 下发还是写文件。
"""

import io
import re
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ---------- 字体 ----------
_FONT_CN = "STSong-Light"
_FONT_CN_BOLD = "STSong-Light"  # CID 字体无独立粗体，用字号/颜色区分层级
_font_ready = False


def _ensure_font() -> None:
    global _font_ready
    if _font_ready:
        return
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(_FONT_CN))
        _font_ready = True
    except Exception:
        # 字体注册失败时退回 Helvetica（英文简历仍可用）
        _font_ready = False


def _font() -> str:
    return _FONT_CN if _font_ready else "Helvetica"


# ---------- 文本清洗 ----------
_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\uFE0F]+"
)


def _clean(text: str) -> str:
    """去掉 emoji（CID 字体无对应字形，会渲染成方块）。"""
    return _EMOJI.sub("", text).strip()


def _esc(text: str) -> str:
    """转义 reportlab Paragraph 的 XML 标记。"""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


_INLINE_BOLD = re.compile(r"\*\*(.+?)\*\*")
_INLINE_CODE = re.compile(r"`([^`]+)`")


def _inline(text: str) -> str:
    """把行内 **粗体** 与 `代码` 转成 Paragraph 支持的标记。"""
    text = _esc(_clean(text))
    text = _INLINE_BOLD.sub(r"<b>\1</b>", text)
    text = _INLINE_CODE.sub(r'<font name="Courier" size="9">\1</font>', text)
    return text


# ---------- 样式 ----------
def _styles() -> dict:
    f = _font()
    return {
        "name": ParagraphStyle(
            "Name", fontName=f, fontSize=21, leading=26,
            alignment=TA_CENTER, textColor=colors.HexColor("#111827"),
            spaceAfter=2,
        ),
        "target": ParagraphStyle(
            "Target", fontName=f, fontSize=10.5, leading=15,
            alignment=TA_CENTER, textColor=colors.HexColor("#1f4e79"),
            spaceAfter=1,
        ),
        "contact": ParagraphStyle(
            "Contact", fontName=f, fontSize=9, leading=13,
            alignment=TA_CENTER, textColor=colors.HexColor("#4b5563"),
            spaceAfter=6,
        ),
        "section": ParagraphStyle(
            "Section", fontName=f, fontSize=12, leading=16,
            textColor=colors.HexColor("#1f4e79"), spaceBefore=9, spaceAfter=1,
        ),
        "body": ParagraphStyle(
            "Body", fontName=f, fontSize=10, leading=15.5,
            textColor=colors.HexColor("#1f2937"), spaceAfter=2,
        ),
        "bullet1": ParagraphStyle(
            "Bullet1", fontName=f, fontSize=10, leading=15.5,
            textColor=colors.HexColor("#1f2937"),
            leftIndent=13, bulletIndent=3, spaceAfter=1.5,
            # CID 中文字体没有 • 字形，项目符号改用 Helvetica 绘制
            bulletFontName="Helvetica", bulletFontSize=8,
        ),
        "bullet2": ParagraphStyle(
            "Bullet2", fontName=f, fontSize=9.5, leading=14.5,
            textColor=colors.HexColor("#374151"),
            leftIndent=27, bulletIndent=17, spaceAfter=1,
            bulletFontName="Helvetica", bulletFontSize=8,
        ),
        "note": ParagraphStyle(
            "Note", fontName=f, fontSize=8.5, leading=13,
            textColor=colors.HexColor("#6b7280"), spaceBefore=8,
        ),
        "cell": ParagraphStyle(
            "Cell", fontName=f, fontSize=8.5, leading=12,
            textColor=colors.HexColor("#1f2937"),
        ),
    }


def _build_flowables(markdown: str):
    st = _styles()
    flow = []

    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    header_done = False
    i = 0

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        # 空行
        if not stripped:
            flow.append(Spacer(1, 3))
            i += 1
            continue

        # 水平分隔线
        if re.fullmatch(r"-{3,}|\*{3,}|_{3,}", stripped):
            if header_done:
                flow.append(Spacer(1, 2))
                flow.append(HRFlowable(
                    width="100%", thickness=0.6,
                    color=colors.HexColor("#dfe6ee"),
                    spaceBefore=1, spaceAfter=5,
                ))
            i += 1
            continue

        # 表格（连续的 | 行）
        if stripped.startswith("|") and stripped.endswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i].strip())
                i += 1
            flow.extend(_render_table(block, st))
            continue

        # 引用 / 提示
        if stripped.startswith(">"):
            flow.append(Paragraph(_inline(stripped.lstrip("> ").strip()), st["note"]))
            i += 1
            continue

        # 章节标题
        if stripped.startswith("## "):
            flow.append(Paragraph(_inline(stripped[3:].strip()), st["section"]))
            flow.append(HRFlowable(
                width="100%", thickness=1.1,
                color=colors.HexColor("#1f4e79"), spaceBefore=0, spaceAfter=5,
            ))
            i += 1
            continue

        # 一级标题 = 姓名
        if stripped.startswith("# "):
            flow.append(Paragraph(_inline(stripped[2:].strip()), st["name"]))
            header_done = True
            i += 1
            continue

        # 二级缩进列表（先判断，避免被一级列表吞掉）
        if re.match(r"^\s{2,}[-*+]\s+", raw):
            content = re.sub(r"^\s+[-*+]\s+", "", raw)
            flow.append(Paragraph(_inline(content), st["bullet2"], bulletText="–"))
            i += 1
            continue

        # 一级列表
        if re.match(r"^\s*[-*+]\s+", raw):
            content = re.sub(r"^\s*[-*+]\s+", "", raw)
            flow.append(Paragraph(_inline(content), st["bullet1"], bulletText="•"))
            i += 1
            continue

        # 整行粗体（求职意向这类）
        m = re.fullmatch(r"\*\*(.+?)\*\*", stripped)
        if m and not header_done:
            flow.append(Paragraph(_inline(stripped), st["target"]))
            i += 1
            continue

        # 联系方式行（以手机/邮箱图标清洗后以电话或邮箱开头）
        if re.match(r"^(电话|手机|邮箱|Email|Tel|\+?\d)", _clean(stripped)) and not header_done:
            flow.append(Paragraph(_inline(stripped), st["contact"]))
            i += 1
            continue

        if stripped.startswith("**") and stripped.endswith("**"):
            flow.append(Paragraph(_inline(stripped), st["target"]))
            i += 1
            continue

        flow.append(Paragraph(_inline(stripped), st["body"]))
        i += 1

    if not flow:
        flow.append(Paragraph("（简历内容为空）", st["body"]))
    return flow


def _render_table(rows: list, st: dict):
    """渲染简单 Markdown 表格，忽略 |---| 分隔行。"""
    parsed = []
    for row in rows:
        cells = [c.strip() for c in row.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c or "") for c in cells if c is not None) and cells:
            continue
        parsed.append(cells)

    if not parsed:
        return []

    width = max(len(r) for r in parsed)
    data = []
    for idx, row in enumerate(parsed):
        cells = row + [""] * (width - len(row))
        style = ParagraphStyle(
            f"cell{idx}",
            parent=st["cell"],
            fontSize=8.5,
            textColor=colors.HexColor("#ffffff") if idx == 0 else colors.HexColor("#1f2937"),
        )
        data.append([Paragraph(_inline(c), style) for c in cells])

    col_width = (A4[0] - 92) / width
    table = Table(data, colWidths=[col_width] * width, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f4e79")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5dde6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f6f9fc")]),
    ]))
    return [Spacer(1, 4), table, Spacer(1, 6)]


def _on_page(canvas, doc):
    """页脚：姓名 + 页码。"""
    canvas.saveState()
    canvas.setFont(_font(), 8)
    canvas.setFillColor(colors.HexColor("#9aa5b1"))
    canvas.drawCentredString(A4[0] / 2, 12 * mm, f"— {doc.page} —")
    canvas.restoreState()


def build_pdf(markdown: str) -> bytes:
    """把 Markdown 简历渲染成 PDF，返回 bytes。"""
    _ensure_font()
    buf = io.BytesIO()

    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=18 * mm,
        title="简历",
        author="AI 简历生成",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height, id="main",
    )
    doc.addPageTemplates([PageTemplate(id="page", frames=[frame], onPage=_on_page)])
    doc.build(_build_flowables(markdown))
    return buf.getvalue()


def suggest_filename(markdown: str) -> str:
    """从简历正文推断文件名，例如「陈静-简历.pdf」。"""
    for line in (markdown or "").splitlines():
        s = line.strip()
        if s.startswith("# "):
            name = _clean(s[2:]).strip()
            name = re.sub(r"[\\/:*?\"<>|]", "", name)[:24]
            if name:
                return f"{name}-简历.pdf"
    return "简历.pdf"


# ---------- 进程内缓存（供 SSE 下发用） ----------
# 云函数实例内有效；仅作短时中转，最多保留 20 份，避免常驻内存膨胀。
PDF_CACHE: "dict[str, bytes]" = {}
_CACHE_ORDER: "list[str]" = []
_CACHE_MAX = 20


def cache_put(pdf: bytes, key: Optional[str] = None) -> str:
    import uuid
    key = key or uuid.uuid4().hex
    PDF_CACHE[key] = pdf
    _CACHE_ORDER.append(key)
    while len(_CACHE_ORDER) > _CACHE_MAX:
        old = _CACHE_ORDER.pop(0)
        PDF_CACHE.pop(old, None)
    return key


def cache_get(key: str) -> Optional[bytes]:
    return PDF_CACHE.get(key)


def export_payload(markdown: str, file_name: str = "") -> dict:
    """把 Markdown 直接渲染成可下发的 JSON 载荷（供 /export-pdf 路由与本地服务共用）。

    返回 {"ok": True, "filename", "size", "base64"} 或 {"ok": False, "error"}。
    """
    import base64

    if not isinstance(markdown, str) or len(markdown.strip()) < 30:
        return {"ok": False, "error": "markdown 内容过短，无法生成 PDF"}
    try:
        pdf = build_pdf(markdown)
    except Exception as e:
        return {"ok": False, "error": f"PDF 渲染失败：{e}"}

    name = (file_name or "").strip()
    return {
        "ok": True,
        "filename": f"{name}.pdf" if name else suggest_filename(markdown),
        "size": len(pdf),
        "base64": base64.b64encode(pdf).decode(),
    }
