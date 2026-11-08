"""
简历文件解析 —— 把用户上传的 PDF / DOCX / TXT 变成纯文本
================================================================

用途：用户上传一份已有简历，Agent 在此基础上修改润色。模型只能读文本，
所以这里负责把二进制文件里的文字抽出来。

依赖策略：
  - PDF  ：pypdf（requirements.txt 里已声明）
  - DOCX ：标准库 zipfile + XML（docx 本质是 zip 包里的 word/document.xml），
           这样不必引入 lxml / python-docx，云端构建更快
  - TXT/MD：直接解码，utf-8 → gbk → utf-16 → latin-1 逐个尝试

对 .doc（97-2003 二进制格式）不做支持，明确提示另存为 docx/pdf ——
硬解二进制 doc 得不偿失，误解析出的乱码比报错更糟。
"""

from __future__ import annotations

import base64
import io
import re
import zipfile
from xml.etree import ElementTree as ET

# 单文件上限：10MB。简历极少超过，同时防止云端内存被打爆
MAX_BYTES = 10 * 1024 * 1024

# 送进模型的字符上限。一份简历通常 1~3 千字，2 万字足够容纳长篇作品集，
# 超出部分截断并明确告知，避免把上下文撑爆。
MAX_CHARS = 20000

SUPPORTED_EXT = (".pdf", ".docx", ".txt", ".md", ".markdown")

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _ext_of(name: str) -> str:
    name = (name or "").strip().lower()
    dot = name.rfind(".")
    return name[dot:] if dot >= 0 else ""


def _decode_bytes(data: bytes) -> str:
    """按常见编码顺序尝试解码纯文本文件。"""
    for enc in ("utf-8-sig", "utf-8", "gb18030", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("utf-8", errors="ignore")


def _from_pdf(data: bytes) -> tuple[str, int]:
    """返回 (文本, 页数)。"""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = len(reader.pages)
    chunks: list[str] = []
    for page in reader.pages:
        try:
            chunks.append(page.extract_text() or "")
        except Exception:
            # 单页解析失败不该拖垮整份文件
            chunks.append("")
    return "\n".join(chunks), pages


def _from_docx(data: bytes) -> str:
    """用标准库从 docx 的 document.xml 里按段落抽文字。"""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        try:
            xml = z.read("word/document.xml")
        except KeyError:
            raise ValueError("这不是有效的 docx 文件（缺少 word/document.xml）")

    root = ET.fromstring(xml)
    lines: list[str] = []
    for para in root.iter(_W + "p"):
        parts = [node.text or "" for node in para.iter(_W + "t")]
        lines.append("".join(parts))
    return "\n".join(lines)


# PDF 里常见的页码噪声行：— 1 —、- 2 -、第 3 页、Page 4 of 9
_PAGE_MARKER = re.compile(
    r"^\s*(?:[—–-]\s*\d+\s*[—–-]|第\s*\d+\s*页(?:\s*[/／]\s*共?\s*\d+\s*页)?"
    r"|page\s*\d+(?:\s*of\s*\d+)?)\s*$",
    re.IGNORECASE,
)

# PDF 字体缺字形时，项目符号常被抽成控制字符（\x7f 等）
_BULLET_CHARS = "\x7f\x01\x02\x0b"


def _normalize(text: str) -> str:
    """统一换行、清掉控制字符与页码、压掉多余空行，保留段落结构。"""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u3000", " ").replace("\xa0", " ")
    for ch in _BULLET_CHARS:
        text = text.replace(ch, "• ")
    # 其余控制字符直接删除（保留换行/制表）
    text = "".join(c for c in text if c == "\n" or c == "\t" or ord(c) >= 0x20)

    lines = [line.rstrip() for line in text.split("\n")]
    out: list[str] = []
    blank = 0
    for line in lines:
        if line and _PAGE_MARKER.match(line):
            continue
        if line:
            blank = 0
            out.append(line)
        else:
            blank += 1
            # 连续空行最多保留一行，避免 PDF 抽取出的碎片把文本拉得很长
            if blank <= 1:
                out.append("")
    return "\n".join(out).strip()


def parse_resume_payload(file_name: str, b64: str) -> dict:
    """解析上传的简历文件，返回 {ok, filename, chars, pages, text, note} 或 {ok: False, error}。"""
    name = (file_name or "").strip()
    ext = _ext_of(name)

    if not name:
        return {"ok": False, "error": "缺少文件名，请重新选择文件。"}

    if ext == ".doc":
        return {
            "ok": False,
            "error": "暂不支持老版 .doc 格式。请用 Word 另存为 .docx，或导出成 PDF 后再上传。",
        }

    if ext not in SUPPORTED_EXT:
        return {
            "ok": False,
            "error": f"不支持的文件类型「{ext or '未知'}」。请上传 PDF、DOCX 或 TXT。",
        }

    if not b64:
        return {"ok": False, "error": "文件内容为空，请重新选择文件。"}

    # 去掉 data URL 前缀（有些前端会连 mime 一起塞进来）
    if b64.startswith("data:"):
        comma = b64.find(",")
        if comma >= 0:
            b64 = b64[comma + 1:]

    try:
        data = base64.b64decode(b64, validate=False)
    except Exception as e:
        return {"ok": False, "error": f"文件解码失败：{e}"}

    size = len(data)
    if size == 0:
        return {"ok": False, "error": "文件内容为空，请重新选择文件。"}
    if size > MAX_BYTES:
        return {
            "ok": False,
            "error": f"文件 {size / 1024 / 1024:.1f}MB，超过 10MB 上限。请压缩或只保留简历正文。",
        }

    pages = 0
    try:
        if ext == ".pdf":
            raw, pages = _from_pdf(data)
        elif ext == ".docx":
            raw = _from_docx(data)
        else:
            raw = _decode_bytes(data)
    except Exception as e:
        return {"ok": False, "error": f"解析失败：{type(e).__name__}: {e}"}

    text = _normalize(raw)

    if len(text) < 30:
        hint = "这份 PDF 可能扫描件（图片）" if ext == ".pdf" else "文件里几乎没有可用文字"
        return {
            "ok": False,
            "error": (
                f"{hint}，无法提取文字。"
                "扫描版简历请先用 Word/在线 OCR 转成可复制文字的版本，或直接把简历内容粘贴到对话框里。"
            ),
        }

    note = ""
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
        note = f"原文较长，已截取前 {MAX_CHARS} 字用于润色。"

    return {
        "ok": True,
        "filename": name,
        "ext": ext,
        "chars": len(text),
        "pages": pages,
        "size": size,
        "text": text,
        "note": note,
    }
