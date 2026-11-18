"""
Markdown 简历 → PDF 渲染器（多模板）

模板一览（TEMPLATES 是唯一事实来源）：

| id       | 名称     | 版式 | 特点                                   |
|----------|----------|------|----------------------------------------|
| classic  | 经典蓝   | 单栏 | 蓝色标题 + 下划线，最通用的投递样式    |
| minimal  | 极简黑白 | 单栏 | 左对齐大标题、细黑线、无彩色           |
| sidebar  | 侧栏双栏 | 双栏 | 左侧深色侧栏放联系方式与技能           |
| academic | 学术严谨 | 单栏 | 居中标题、上下细线，偏正式/升学         |
| campus   | 清新校园 | 单栏 | 页头浅绿横幅 + 绿色标题色块             |

设计要点：
- 不依赖任何外部字体文件：使用 reportlab 内置 CID 字体 STSong-Light 渲染中文，
  这样在 EdgeOne Makers 的沙箱里也能直接跑，不需要额外上传 ttf。
- 只识别 generate_resume / polish_resume 产出的那套 Markdown 结构
  （# 姓名 / ## 章节 / - 列表 / **粗体** / --- 分隔 / > 提示），兼容简单表格。
- 模板只影响排版，不改写任何文字内容。
"""

import io
import re
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    FrameBreak,
    HRFlowable,
    NextPageTemplate,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

HexColor = colors.HexColor

# ---------- 模板注册表 ----------
TEMPLATES: "dict[str, dict]" = {
    "classic": {
        "label": "经典蓝",
        "desc": "蓝色标题下划线，通用投递",
        "layout": "single",
        "heading": "underline",
        "header_align": "center",
        "band": False,
        "accent": "#1f4e79",
        "accent_soft": "#eef4fa",
        "text": "#1f2937",
        "muted": "#4b5563",
        "name": "#111827",
        "scale": 1.0,
    },
    "minimal": {
        "label": "极简黑白",
        "desc": "左对齐大标题，大量留白",
        "layout": "single",
        "heading": "rule",
        "header_align": "left",
        "band": False,
        "accent": "#111827",
        "accent_soft": "#f3f4f6",
        "text": "#1f2937",
        "muted": "#6b7280",
        "name": "#0f172a",
        "scale": 1.0,
    },
    "sidebar": {
        "label": "侧栏双栏",
        "desc": "左侧深色栏放联系方式与技能",
        "layout": "sidebar",
        "heading": "sidebar",
        "header_align": "left",
        "band": False,
        "accent": "#1e3a5f",
        "accent_soft": "#e8eef6",
        "text": "#1f2937",
        "muted": "#4b5563",
        "name": "#ffffff",
        "scale": 1.0,
    },
    "academic": {
        "label": "学术严谨",
        "desc": "居中标题细线分隔，偏正式",
        "layout": "single",
        "heading": "center_rule",
        "header_align": "center",
        "band": False,
        "accent": "#334155",
        "accent_soft": "#f1f5f9",
        "text": "#1f2937",
        "muted": "#475569",
        "name": "#0f172a",
        "scale": 0.98,
    },
    "campus": {
        "label": "清新校园",
        "desc": "浅绿页头 + 绿色标题色块",
        "layout": "single",
        "heading": "bar",
        "header_align": "left",
        "band": True,
        "accent": "#0f766e",
        "accent_soft": "#ecfdf5",
        "text": "#1f2937",
        "muted": "#4b5563",
        "name": "#0f172a",
        "scale": 1.0,
    },
}

DEFAULT_TEMPLATE = "classic"


def list_templates() -> "list[dict]":
    """给前端/工具描述用的模板清单。"""
    return [
        {"id": tid, "label": t["label"], "desc": t["desc"], "layout": t["layout"]}
        for tid, t in TEMPLATES.items()
    ]


def normalize_template(template: Optional[str]) -> str:
    key = (template or "").strip().lower()
    return key if key in TEMPLATES else DEFAULT_TEMPLATE


def _theme(template: Optional[str]) -> dict:
    th = dict(TEMPLATES[normalize_template(template)])
    th["id"] = normalize_template(template)
    return th


# ---------- 字体 ----------
_FONT_CN = "STSong-Light"
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
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


_INLINE_BOLD = re.compile(r"\*\*(.+?)\*\*")
_INLINE_CODE = re.compile(r"`([^`]+)`")


def _inline(text: str) -> str:
    """把行内 **粗体** 与 `代码` 转成 Paragraph 支持的标记。"""
    text = _esc(_clean(text))
    text = _INLINE_BOLD.sub(r"<b>\1</b>", text)
    text = _INLINE_CODE.sub(r'<font name="Courier" size="9">\1</font>', text)
    return text


# ---------- 样式 ----------
def _styles(th: dict, dark: bool = False) -> dict:
    f = _font()
    s = th.get("scale", 1.0)

    def sz(x: float) -> float:
        return round(x * s, 1)

    if dark:
        # 侧栏（深色底）专用配色
        return {
            "name": ParagraphStyle(
                "SName", fontName=f, fontSize=sz(19), leading=sz(24),
                textColor=HexColor("#ffffff"), spaceAfter=5,
            ),
            "target": ParagraphStyle(
                "STarget", fontName=f, fontSize=sz(9.5), leading=sz(14),
                textColor=HexColor("#cfe0f2"), spaceAfter=11,
            ),
            "contact": ParagraphStyle(
                "SContact", fontName=f, fontSize=sz(8.5), leading=sz(13.5),
                textColor=HexColor("#c3d3e4"), spaceAfter=4,
            ),
            "section": ParagraphStyle(
                "SSection", fontName=f, fontSize=sz(9.8), leading=sz(14),
                textColor=HexColor("#ffffff"), spaceBefore=13, spaceAfter=3,
            ),
            "body": ParagraphStyle(
                "SBody", fontName=f, fontSize=sz(8.6), leading=sz(13),
                textColor=HexColor("#dbe7f3"), spaceAfter=2,
            ),
            "bullet1": ParagraphStyle(
                "SBullet1", fontName=f, fontSize=sz(8.6), leading=sz(13),
                textColor=HexColor("#dbe7f3"), leftIndent=10, bulletIndent=0,
                spaceAfter=2, bulletFontName="Helvetica", bulletFontSize=7.5,
            ),
            "bullet2": ParagraphStyle(
                "SBullet2", fontName=f, fontSize=sz(8.2), leading=sz(12.5),
                textColor=HexColor("#c3d3e4"), leftIndent=20, bulletIndent=10,
                spaceAfter=1.5, bulletFontName="Helvetica", bulletFontSize=7,
            ),
            "note": ParagraphStyle(
                "SNote", fontName=f, fontSize=sz(8), leading=sz(12),
                textColor=HexColor("#a9bfd6"), spaceBefore=6,
            ),
            "cell": ParagraphStyle(
                "SCell", fontName=f, fontSize=sz(8.2), leading=sz(12),
                textColor=HexColor("#dbe7f3"),
            ),
            "cell_head": ParagraphStyle(
                "SCellHead", fontName=f, fontSize=sz(8.2), leading=sz(12),
                textColor=HexColor("#1e3a5f"),
            ),
        }

    centered = th.get("header_align") == "center"
    hdr_align = TA_CENTER if centered else TA_LEFT
    return {
        "name": ParagraphStyle(
            "Name", fontName=f, fontSize=sz(21), leading=sz(27),
            alignment=hdr_align, textColor=HexColor(th["name"]), spaceAfter=3,
        ),
        "target": ParagraphStyle(
            "Target", fontName=f, fontSize=sz(10.5), leading=sz(15),
            alignment=hdr_align, textColor=HexColor(th["accent"]), spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "Contact", fontName=f, fontSize=sz(9), leading=sz(13),
            alignment=hdr_align, textColor=HexColor(th["muted"]), spaceAfter=4,
        ),
        "section": ParagraphStyle(
            "Section", fontName=f, fontSize=sz(11.5), leading=sz(16),
            textColor=HexColor(th["accent"]), spaceBefore=9, spaceAfter=1,
        ),
        "section_center": ParagraphStyle(
            "SectionCenter", fontName=f, fontSize=sz(11), leading=sz(15),
            alignment=TA_CENTER, textColor=HexColor(th["accent"]),
            spaceBefore=3, spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "Body", fontName=f, fontSize=sz(10), leading=sz(15.5),
            textColor=HexColor(th["text"]), spaceAfter=2,
        ),
        "bullet1": ParagraphStyle(
            "Bullet1", fontName=f, fontSize=sz(10), leading=sz(15.5),
            textColor=HexColor(th["text"]),
            leftIndent=13, bulletIndent=3, spaceAfter=1.5,
            # CID 中文字体没有 • 字形，项目符号改用 Helvetica 绘制
            bulletFontName="Helvetica", bulletFontSize=8,
        ),
        "bullet2": ParagraphStyle(
            "Bullet2", fontName=f, fontSize=sz(9.5), leading=sz(14.5),
            textColor=HexColor("#374151"),
            leftIndent=27, bulletIndent=17, spaceAfter=1,
            bulletFontName="Helvetica", bulletFontSize=8,
        ),
        "note": ParagraphStyle(
            "Note", fontName=f, fontSize=sz(8.5), leading=sz(13),
            textColor=HexColor(th["muted"]), spaceBefore=8,
        ),
        "cell": ParagraphStyle(
            "Cell", fontName=f, fontSize=sz(8.5), leading=sz(12),
            textColor=HexColor(th["text"]),
        ),
        "cell_head": ParagraphStyle(
            "CellHead", fontName=f, fontSize=sz(8.5), leading=sz(12),
            textColor=colors.white,
        ),
    }


# ---------- Markdown 结构解析 ----------
_SECTION_SPLIT = re.compile(r"^\s{0,3}##\s+(.+?)\s*$")


def _split(markdown: str):
    """拆成 (页头行, [{title, lines}])。页头 = 第一个 ## 之前的内容。"""
    text = (markdown or "").replace("\r\n", "\n").replace("\r", "\n")
    header: "list[str]" = []
    sections: "list[dict]" = []
    for raw in text.split("\n"):
        m = _SECTION_SPLIT.match(raw)
        if m:
            sections.append({"title": m.group(1).strip(), "lines": []})
        elif sections:
            sections[-1]["lines"].append(raw)
        else:
            header.append(raw)

    if not sections:
        # 兜底：没有 ## 章节时，把 # 标题当姓名，其余内容当正文
        name_line = ""
        rest: "list[str]" = []
        for line in header:
            if line.strip().startswith("# ") and not name_line:
                name_line = line
            else:
                rest.append(line)
        return [name_line], [{"title": "", "lines": rest}]
    return header, sections


def _parse_header(lines: "list[str]"):
    """从页头行里拆出 姓名 / 求职意向 / 联系方式。"""
    name = ""
    target = ""
    contacts: "list[str]" = []
    for raw in lines:
        s = raw.strip()
        if not s or re.fullmatch(r"-{3,}|\*{3,}|_{3,}", s):
            continue
        if s.startswith("# "):
            if not name:
                name = s[2:].strip()
            else:
                contacts.append(s[2:].strip())
            continue
        m = re.fullmatch(r"\*\*(.+?)\*\*", s)
        if m and not target:
            target = m.group(1).strip()
            continue
        contacts.append(s)
    return name, target, contacts


# ---------- 页头 / 章节 ----------
def _header_flowables(name: str, target: str, contacts: "list[str]", st: dict, th: dict, avail: float):
    flow: "list" = []
    if name:
        flow.append(Paragraph(_inline(name), st["name"]))
    if target:
        flow.append(Paragraph(_inline(target), st["target"]))
    if contacts:
        flow.append(
            Paragraph(
                "&nbsp;&nbsp;|&nbsp;&nbsp;".join(_inline(c) for c in contacts),
                st["contact"],
            )
        )

    if th.get("band"):
        # 浅色页头横幅 + 左色条
        band = Table([[flow]], colWidths=[avail])
        band.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), HexColor(th["accent_soft"])),
                    ("LINEBEFORE", (0, 0), (0, -1), 4, HexColor(th["accent"])),
                    ("LEFTPADDING", (0, 0), (-1, -1), 11),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        return [Spacer(1, 2), band, Spacer(1, 9)]

    if th["heading"] == "center_rule":
        flow.append(Spacer(1, 5))
        flow.append(HRFlowable(width="100%", thickness=1.2, color=HexColor(th["accent"]), spaceAfter=1))
        flow.append(HRFlowable(width="100%", thickness=0.4, color=HexColor("#94a3b8"), spaceBefore=1, spaceAfter=5))
    elif th["heading"] == "rule":
        flow.append(Spacer(1, 3))
        flow.append(HRFlowable(width="100%", thickness=0.9, color=HexColor(th["accent"]), spaceAfter=7))
    else:
        flow.append(HRFlowable(width="100%", thickness=1.4, color=HexColor(th["accent"]), spaceBefore=7, spaceAfter=3))
    return flow


def _section_flowables(title: str, st: dict, th: dict, avail: float):
    if not title.strip():
        return [Spacer(1, 4)]

    kind = th["heading"]
    if kind == "underline":
        return [
            Paragraph(_inline(title), st["section"]),
            HRFlowable(width="100%", thickness=1.1, color=HexColor(th["accent"]), spaceAfter=5),
        ]
    if kind == "rule":
        return [
            Paragraph(_inline(title), st["section"]),
            HRFlowable(width="100%", thickness=0.5, color=HexColor("#9ca3af"), spaceAfter=5),
        ]
    if kind == "center_rule":
        return [
            HRFlowable(width="100%", thickness=0.4, color=HexColor("#cbd5e1"), spaceBefore=8, spaceAfter=2),
            Paragraph(_inline(title), st["section_center"]),
            HRFlowable(width="100%", thickness=0.4, color=HexColor("#cbd5e1"), spaceAfter=5),
        ]
    if kind == "bar":
        bar = Table([[Paragraph(_inline(title), st["section"])]], colWidths=[avail])
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), HexColor(th["accent_soft"])),
                    ("LINEBEFORE", (0, 0), (0, -1), 3, HexColor(th["accent"])),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ]
            )
        )
        return [Spacer(1, 7), bar, Spacer(1, 5)]
    if kind == "sidebar":
        return [
            Paragraph(_inline(title), st["section"]),
            HRFlowable(width="100%", thickness=0.6, color=HexColor("#47678c"), spaceAfter=4),
        ]
    return [Paragraph(_inline(title), st["section"])]


# ---------- 正文 ----------
def _render_table(rows: "list[str]", st: dict, th: dict, avail: float):
    """渲染简单 Markdown 表格，忽略 |---| 分隔行。"""
    parsed = []
    for row in rows:
        cells = [c.strip() for c in row.strip().strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{2,}:?", c or "") for c in cells):
            continue
        parsed.append(cells)

    if not parsed:
        return []

    width = max(len(r) for r in parsed)
    data = []
    for idx, row in enumerate(parsed):
        cells = row + [""] * (width - len(row))
        style = st["cell_head"] if idx == 0 else st["cell"]
        data.append([Paragraph(_inline(c), style) for c in cells])

    col_width = avail / width
    table = Table(data, colWidths=[col_width] * width, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor(th["accent"])),
                ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#d5dde6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#f6f9fc")]),
            ]
        )
    )
    return [Spacer(1, 4), table, Spacer(1, 6)]


def _body_flowables(lines: "list[str]", st: dict, th: dict, avail: float):
    flow: "list" = []
    i = 0
    n = len(lines)
    while i < n:
        raw = lines[i]
        stripped = raw.strip()

        if not stripped:
            flow.append(Spacer(1, 3))
            i += 1
            continue

        if re.fullmatch(r"-{3,}|\*{3,}|_{3,}", stripped):
            flow.append(Spacer(1, 2))
            flow.append(
                HRFlowable(
                    width="100%", thickness=0.6,
                    color=HexColor("#dfe6ee"), spaceBefore=1, spaceAfter=5,
                )
            )
            i += 1
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            block = []
            while i < n and lines[i].strip().startswith("|"):
                block.append(lines[i].strip())
                i += 1
            flow.extend(_render_table(block, st, th, avail))
            continue

        if stripped.startswith(">"):
            flow.append(Paragraph(_inline(stripped.lstrip("> ").strip()), st["note"]))
            i += 1
            continue

        # 二级缩进列表（先判断，避免被一级列表吞掉）
        if re.match(r"^\s{2,}[-*+]\s+", raw):
            content = re.sub(r"^\s+[-*+]\s+", "", raw)
            flow.append(Paragraph(_inline(content), st["bullet2"], bulletText="–"))
            i += 1
            continue

        if re.match(r"^\s*[-*+]\s+", raw):
            content = re.sub(r"^\s*[-*+]\s+", "", raw)
            flow.append(Paragraph(_inline(content), st["bullet1"], bulletText="•"))
            i += 1
            continue

        flow.append(Paragraph(_inline(stripped), st["body"]))
        i += 1

    return flow


# ---------- 页脚 ----------
def _footer(canvas, doc, th: dict, center_x: float):
    canvas.saveState()
    canvas.setFont(_font(), 8)
    canvas.setFillColor(HexColor("#9aa5b1"))
    canvas.drawCentredString(center_x, 12 * mm, f"— {doc.page} —")
    canvas.restoreState()


def _trim_tail(story: "list") -> "list":
    """去掉结尾的 Spacer / HR，避免内容刚好排满时被挤出一张空白页。"""
    while story and isinstance(story[-1], (Spacer, HRFlowable)):
        story.pop()
    return story


# ---------- 单栏版式 ----------
def _build_single(buf, markdown: str, th: dict) -> None:
    st = _styles(th)
    header, sections = _split(markdown)
    name, target, contacts = _parse_header(header)

    lm = rm = 16 * mm
    tm, bm = 14 * mm, 18 * mm
    avail = A4[0] - lm - rm

    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=lm,
        rightMargin=rm,
        topMargin=tm,
        bottomMargin=bm,
        title=name or "简历",
        author="AI 简历生成",
    )
    frame = Frame(lm, bm, avail, A4[1] - tm - bm, id="main",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates(
        [PageTemplate(id="page", frames=[frame], onPage=lambda c, d: _footer(c, d, th, A4[0] / 2))]
    )

    story = _header_flowables(name, target, contacts, st, th, avail)
    for sec in sections:
        story.extend(_section_flowables(sec["title"], st, th, avail))
        story.extend(_body_flowables(sec["lines"], st, th, avail))

    doc.build(_trim_tail(story))


# ---------- 侧栏双栏版式 ----------
SIDEBAR_W = 70 * mm
_SIDE_KEYS = ("技能", "证书", "资格", "语言", "兴趣", "爱好", "特长", "联系方式", "个人信息")


def _build_sidebar(buf, markdown: str, th: dict) -> None:
    st = _styles(th)
    sd = _styles(th, dark=True)
    header, sections = _split(markdown)
    name, target, contacts = _parse_header(header)

    side_secs, main_secs = [], []
    for sec in sections:
        key = re.sub(r"[\s:：·]", "", sec["title"])
        has_table = any(l.strip().startswith("|") for l in sec["lines"])
        if not has_table and any(k in key for k in _SIDE_KEYS):
            side_secs.append(sec)
        else:
            main_secs.append(sec)

    # 全部内容都被判定进侧栏时，正文会空掉，此时把内容全部还给主栏
    if not main_secs:
        main_secs, side_secs = side_secs, []

    nx = SIDEBAR_W + 11 * mm
    main_w = A4[0] - nx - 14 * mm
    side_pad_l, side_pad_r = 12 * mm, 6 * mm
    side_avail = SIDEBAR_W - side_pad_l - side_pad_r

    doc = BaseDocTemplate(
        buf, pagesize=A4, title=name or "简历", author="AI 简历生成",
    )
    side_frame = Frame(
        0, 0, SIDEBAR_W, A4[1], id="side",
        leftPadding=side_pad_l, rightPadding=side_pad_r,
        topPadding=16 * mm, bottomPadding=16 * mm,
    )
    main_frame = Frame(
        nx, 18 * mm, main_w, A4[1] - 32 * mm, id="main",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    # 续页：侧栏内容只在第 1 页，第 2 页起改用整页宽度，避免正文挤在右侧留白
    lw = 16 * mm
    full_frame = Frame(
        lw, 18 * mm, A4[0] - 2 * lw, A4[1] - 32 * mm, id="main_full",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    def _on_sidebar_page(canvas, d):
        canvas.saveState()
        canvas.setFillColor(HexColor(th["accent"]))
        canvas.rect(0, 0, SIDEBAR_W, A4[1], stroke=0, fill=1)
        canvas.restoreState()
        _footer(canvas, d, th, nx + main_w / 2)

    doc.addPageTemplates(
        [
            PageTemplate(id="sidebar_page", frames=[side_frame, main_frame], onPage=_on_sidebar_page),
            PageTemplate(id="main_only", frames=[full_frame],
                         onPage=lambda c, d: _footer(c, d, th, A4[0] / 2)),
        ]
    )

    story: "list" = [NextPageTemplate("main_only")]
    if name:
        story.append(Paragraph(_inline(name), sd["name"]))
    if target:
        story.append(Paragraph(_inline(target), sd["target"]))
    if contacts:
        story.append(
            Paragraph("<br/>".join(_inline(c) for c in contacts), sd["contact"])
        )
    for sec in side_secs:
        story.extend(_section_flowables(sec["title"], sd, th, side_avail))
        story.extend(_body_flowables(sec["lines"], sd, th, side_avail))

    story.append(FrameBreak())

    for sec in main_secs:
        story.extend(_section_flowables(sec["title"], st, th, main_w))
        story.extend(_body_flowables(sec["lines"], st, th, main_w))

    doc.build(_trim_tail(story))


# ---------- 对外 API ----------
def build_pdf(markdown: str, template: str = DEFAULT_TEMPLATE) -> bytes:
    """把 Markdown 简历渲染成 PDF，返回 bytes。template 见 TEMPLATES。"""
    _ensure_font()
    th = _theme(template)
    buf = io.BytesIO()
    if th["layout"] == "sidebar":
        _build_sidebar(buf, markdown or "", th)
    else:
        _build_single(buf, markdown or "", th)
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


def export_payload(markdown: str, file_name: str = "", template: str = DEFAULT_TEMPLATE) -> dict:
    """把 Markdown 直接渲染成可下发的 JSON 载荷（供 /export-pdf 路由与本地服务共用）。

    返回 {"ok": True, "filename", "size", "template", "base64"} 或 {"ok": False, "error"}。
    """
    import base64

    if not isinstance(markdown, str) or len(markdown.strip()) < 30:
        return {"ok": False, "error": "markdown 内容过短，无法生成 PDF"}

    tid = normalize_template(template)
    try:
        pdf = build_pdf(markdown, tid)
    except Exception as e:
        return {"ok": False, "error": f"PDF 渲染失败：{e}"}

    name = (file_name or "").strip()
    # 调用方可能已经把后缀写进文件名了，避免出现 "xxx.pdf.pdf"
    if name.lower().endswith(".pdf"):
        name = name[:-4].strip()
    return {
        "ok": True,
        "filename": f"{name}.pdf" if name else suggest_filename(markdown),
        "size": len(pdf),
        "template": tid,
        "base64": base64.b64encode(pdf).decode(),
    }
