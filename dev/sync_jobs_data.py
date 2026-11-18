"""把根目录 jobs.json 同步为 agents/jobs_data.py（云函数内嵌副本）。

每次增删岗位后运行一次：
    .venv/Scripts/python.exe dev/sync_jobs_data.py
"""
import io
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "jobs.json")
dst = os.path.join(ROOT, "agents", "jobs_data.py")

data = json.load(open(src, encoding="utf-8"))
raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
if "'''" in raw:
    raise SystemExit("岗位数据含三单引号，无法内嵌，请改用 JSON 文件方案")

with io.open(dst, "w", encoding="utf-8") as f:
    f.write('"""内嵌招聘库：云函数打包不保证带上根目录 jobs.json，改用模块保证一定能读到。\n')
    f.write("由 jobs.json 同步生成，新增岗位后运行 dev/sync_jobs_data.py 更新。\n")
    f.write('"""\n')
    f.write("JOBS_JSON = r'''" + raw + "'''\n")

print(f"已同步 {len(data)} 条岗位 -> {dst}")
