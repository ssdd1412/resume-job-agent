"""
Agent Tools — 简历生成 + 工作匹配（替换 openai-agent-starter-python 默认示例工具）

每个工具的函数体就是你需要改的业务逻辑。这里完全用 Python 标准库实现，
不依赖任何外部接口，保证在 EdgeOne Makers 沙箱里可直接运行。

关键约定：
- 招聘信息必须来自用户提供的真实数据（对话中粘贴，或 save_jobs 写入 jobs.json）。
  本模块绝不虚构岗位，符合"只用真实数据"的要求。
- jobs.json 位于项目根目录，match_jobs 会优先读取对话中传入的 jobs_json，
  为空时回退读取 jobs.json。
"""

import json
import os
import re
from typing import Annotated

from agents import function_tool

# jobs.json 位于项目根目录（agents/_tools.py -> ../.. -> 项目根）
_JOBS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs.json")


# ========== 工具函数 ==========
def _load_jobs() -> list:
    """读取 jobs.json 中的真实招聘信息。"""
    try:
        if os.path.exists(_JOBS_PATH):
            with open(_JOBS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception:
        pass
    return []


def _save_jobs(jobs: list) -> None:
    """覆盖式写回 jobs.json。"""
    with open(_JOBS_PATH, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)


def _merge_jobs(incoming: list) -> int:
    """按 (title, company) 去重合并，返回新增条数。"""
    existing = _load_jobs()
    seen = {(j.get("title"), j.get("company")) for j in existing if isinstance(j, dict)}
    added = 0
    for j in incoming:
        if not isinstance(j, dict):
            continue
        key = (j.get("title"), j.get("company"))
        if key not in seen:
            existing.append(j)
            seen.add(key)
            added += 1
    _save_jobs(existing)
    return added


def _tokenize(text: str) -> set:
    """把文本转成可比较的词元集合：英文/数字按词，中文按二元组。"""
    text = (text or "").lower()
    tokens: set = set(re.findall(r"[a-z0-9]+", text))
    cn = re.findall(r"[一-鿿]+", text)
    for w in cn:
        if len(w) == 1:
            tokens.add(w)
        else:
            for i in range(len(w) - 1):
                tokens.add(w[i:i + 2])
    return tokens


# ========== Tool 1: 生成简历 ==========
@function_tool
def generate_resume(
    profile_json: Annotated[
        str,
        "候选人结构化信息 JSON 字符串。字段：name(姓名), target_role(求职意向), "
        "contact{phone,email,location,links}, summary(个人简介), skills[技能], "
        "education[{school,degree,major,start,end,detail}], "
        "experience[{company,role,start,end,bullets[]}], "
        "projects[{name,role,bullets[]}], certifications[], languages[]",
    ]
) -> str:
    """根据结构化候选人信息生成一份排版清晰的 Markdown 简历，返回简历正文。"""
    try:
        p = json.loads(profile_json)
    except Exception as e:
        return f"简历信息解析失败：{e}。请检查 profile_json 是否为合法 JSON。"
    if not isinstance(p, dict):
        return "profile_json 必须是 JSON 对象。"

    lines = []
    name = p.get("name") or "候选人"
    lines.append(f"# {name}")

    target = p.get("target_role") or p.get("targetRole")
    if target:
        lines.append(f"**求职意向：{target}**")

    contact = p.get("contact", {}) or {}
    cparts = []
    for k in ("phone", "email", "location", "links"):
        v = contact.get(k)
        if v:
            cparts.append(str(v))
    if cparts:
        lines.append("📞 " + "  |  ".join(cparts))
    lines.append("")

    summary = p.get("summary")
    if summary:
        lines.append("## 个人简介")
        lines.append(str(summary))
        lines.append("")

    skills = p.get("skills") or []
    if skills:
        lines.append("## 专业技能")
        lines.append("、".join(str(s) for s in skills))
        lines.append("")

    edu = p.get("education") or []
    if edu:
        lines.append("## 教育背景")
        for e in edu:
            if not isinstance(e, dict):
                continue
            school = e.get("school", "")
            degree = e.get("degree", "")
            major = e.get("major", "")
            period = f"{e.get('start', '')} - {e.get('end', '')}".strip(" -")
            head = f"- **{school}**"
            if degree or major:
                head += f"　{degree}　{major}"
            lines.append(head)
            if period:
                lines.append(f"  - {period}")
            if e.get("detail"):
                lines.append(f"  - {e.get('detail')}")
        lines.append("")

    exp = p.get("experience") or []
    if exp:
        lines.append("## 工作经历")
        for x in exp:
            if not isinstance(x, dict):
                continue
            role = x.get("role", "")
            company = x.get("company", "")
            period = f"{x.get('start', '')} - {x.get('end', '')}".strip(" -")
            tail = f"（{period}）" if period else ""
            lines.append(f"- **{role} @ {company}**　{tail}".strip())
            for b in (x.get("bullets") or []):
                lines.append(f"  - {b}")
        lines.append("")

    proj = p.get("projects") or []
    if proj:
        lines.append("## 项目经历")
        for pr in proj:
            if not isinstance(pr, dict):
                continue
            lines.append(f"- **{pr.get('name', '')}**　{pr.get('role', '')}".rstrip())
            for b in (pr.get("bullets") or []):
                lines.append(f"  - {b}")
        lines.append("")

    cert = p.get("certifications") or []
    if cert:
        lines.append("## 证书 / 荣誉")
        for c in cert:
            lines.append(f"- {c}")
        lines.append("")

    langs = p.get("languages") or []
    if langs:
        lines.append("## 语言")
        lines.append("、".join(str(l) for l in langs))
        lines.append("")

    lines.append("---")
    lines.append("> 本简历依据你提供的信息自动生成，投递前请逐条核对经历、时间与数字是否属实。")

    return "\n".join(lines).strip() + "\n"


# ========== Tool 2: 工作匹配 ==========
@function_tool
def match_jobs(
    resume_text: Annotated[str, "已生成的简历正文（Markdown）或候选人的技能/经历摘要"],
    jobs_json: Annotated[
        str,
        "可选：本轮对话中粘贴的真实招聘信息 JSON 数组；留空则读取已保存的 jobs.json",
    ] = "",
) -> str:
    """根据简历与真实招聘信息做匹配度打分，返回按匹配度排序的推荐清单（含匹配点/缺口/建议）。"""
    jobs: list = []
    if jobs_json and jobs_json.strip():
        try:
            parsed = json.loads(jobs_json)
            if isinstance(parsed, list):
                jobs = parsed
        except Exception as e:
            return f"jobs_json 解析失败：{e}。请确认是合法 JSON 数组。"
    if not jobs:
        jobs = _load_jobs()

    if not jobs:
        return json.dumps({
            "error": "no_jobs",
            "hint": (
                "未找到招聘信息。请用真实数据：\n"
                "① 直接在对话里粘贴招聘信息 JSON 数组传入 jobs_json；或\n"
                "② 调用 save_jobs 写入 jobs.json（例如 "
                '[{"title":"后端开发工程师","company":"某公司","location":"深圳",'
                '"salary":"15-25K","requirements":["Python","MySQL","FastAPI"],'
                '"description":"负责交易系统后端","url":"https://..."}]）。'
            )
        }, ensure_ascii=False)

    resume_tokens = _tokenize(resume_text)
    # 岗位/意向关键词，用于加成判断
    resume_lower = resume_text.lower()

    results = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        reqs = job.get("requirements") or []
        req_text = " ".join(str(r) for r in reqs) + " " + str(job.get("description", ""))
        job_tokens = _tokenize(req_text)

        matched, missing = [], []
        for r in reqs:
            rt = _tokenize(str(r))
            # 技能词元与简历有交集即视为命中
            if rt and (rt & resume_tokens):
                matched.append(str(r))
            else:
                missing.append(str(r))

        score = 0.0
        if reqs:
            score = round(100 * len(matched) / len(reqs), 1)

        # 岗位标题与求职意向/简历相关度加成
        title = str(job.get("title", "")).lower()
        if title and any(t in resume_lower for t in title.split() if t):
            score = min(100.0, score + 5)

        # 工作地点与简历所在地一致加成
        loc = str(job.get("location", ""))
        if loc and loc in resume_text:
            score = min(100.0, score + 3)

        results.append({
            "title": job.get("title"),
            "company": job.get("company"),
            "location": job.get("location"),
            "salary": job.get("salary"),
            "url": job.get("url"),
            "match_score": score,
            "matched_requirements": matched,
            "missing_requirements": missing,
        })

    results.sort(key=lambda x: x["match_score"], reverse=True)
    return json.dumps(
        {"count": len(results), "recommendations": results},
        ensure_ascii=False,
        indent=2,
    )


# ========== Tool 4: 导出 PDF ==========
@function_tool
def export_resume_pdf(
    resume_markdown: Annotated[
        str,
        "要导出的简历正文（Markdown，通常就是 generate_resume 的返回值原文）。不要传摘要或改写版本。",
    ],
    file_name: Annotated[str, "可选：自定义文件名（不带扩展名）"] = "",
) -> str:
    """把简历正文渲染成 PDF 文件供用户下载，返回导出结果（文件名/页数/体积）。"""
    # 延迟导入：reportlab 缺失时不应连带整个 chat 路由启动失败
    try:
        from .resume_pdf import build_pdf, suggest_filename, cache_put
    except Exception as e:  # pragma: no cover
        return json.dumps(
            {"ok": False, "error": f"PDF 组件加载失败：{e}"}, ensure_ascii=False
        )

    md = (resume_markdown or "").strip()
    if len(md) < 30:
        return json.dumps(
            {"ok": False, "error": "简历内容太短，请先调用 generate_resume 生成简历再导出。"},
            ensure_ascii=False,
        )

    try:
        pdf = build_pdf(md)
    except Exception as e:
        return json.dumps({"ok": False, "error": f"PDF 渲染失败：{e}"}, ensure_ascii=False)

    pdf_id = cache_put(pdf)
    name = (file_name or "").strip()
    filename = f"{name}.pdf" if name else suggest_filename(md)

    return json.dumps(
        {
            "ok": True,
            "pdf_id": pdf_id,
            "filename": filename,
            "size_kb": round(len(pdf) / 1024, 1),
            "note": "系统会自动在回复下方附加「下载 PDF」按钮，你不需要粘贴 Base64 或链接。",
        },
        ensure_ascii=False,
    )


# ========== Tool 3: 保存真实招聘信息 ==========
@function_tool
def save_jobs(
    jobs_json: Annotated[
        str,
        "真实招聘信息 JSON 数组，例如 "
        '[{"title":"后端开发","company":"某公司","location":"深圳",'
        '"salary":"15-25K","requirements":["Python","MySQL"],"url":"https://..."}]',
    ]
) -> str:
    """把真实招聘信息写入 jobs.json（按 title+company 去重合并），供后续 match_jobs 复用。"""
    try:
        data = json.loads(jobs_json)
        if not isinstance(data, list):
            return "jobs_json 必须是 JSON 数组。"
    except Exception as e:
        return f"解析失败：{e}。"
    added = _merge_jobs(data)
    total = len(_load_jobs())
    return f"写入完成：本次新增 {added} 条，jobs.json 当前共 {total} 条真实招聘信息。"
