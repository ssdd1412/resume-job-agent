# 简历生成 + 工作匹配 Agent

基于 `TencentEdgeOne/openai-agent-starter-python` 改造：把默认的「天气 / 穿衣 / 翻译 / 统计」四个示例工具，
换成 **简历生成、简历润色、岗位匹配、招聘入库、PDF 导出** 五个真实工具，可本地运行，也可一键部署到 EdgeOne Makers。

- 文档1：从 0 到 1 做一个 AI Agent（环境搭建 → 开发 → 部署 → 绑域名）
- 文档2：EdgeOne Makers - WorkBuddy 智能体搭建手册（七步流程）

> 只想赶快看到效果 → 双击 **`启动本地版.bat`**，浏览器会自动打开 `http://127.0.0.1:8088`。

---

## 一、这个 Agent 能做什么

| 工具 | 作用 | 是否虚构数据 |
| --- | --- | --- |
| `generate_resume` | 结构化候选人信息 → 一份 Markdown 简历 | 否，只用你提供的真实信息 |
| `polish_resume` | 用户上传的已有简历 → 逐段改写润色后的定稿 | 否，后端会比对原文与定稿的数字，编造会被打回 |
| `match_jobs` | 简历 × 真实招聘信息 → 匹配度打分 + Top 推荐 + 缺口分析 | 否，岗位必须来自真实数据 |
| `save_jobs` | 真实招聘信息写入 `jobs.json`（按 title+company 去重） | 否，由你提供 |
| `export_resume_pdf` | 简历 Markdown → 中文排版 PDF（5 套模板可选），推给前端一键下载 | 否，只渲染已有内容 |

匹配逻辑（透明、可解释）：
1. 简历与岗位要求都切成词元（英文按词、中文按二元组）；
2. 逐条比对 `requirements`，命中记 matched、未命中记 missing；
3. 匹配度 = 命中数 / 要求总数 × 100，标题相关 +5、地点一致 +3（封顶 100）；
4. 按匹配度降序返回，附命中点与待补强项。

仓库自带 `jobs.json`：**40 条真实在招岗位**，匹配结果里的公司名、薪资、匹配度全部来自这份数据。

---

## 二、六个工程细节（和原版 starter 的差异）

### 1. 简历正文由后端直接推给前端
模型经常只回一句「简历已生成」，用户根本看不到简历。所以 `agents/chat/index.py` 在收到
`generate_resume` 的 `tool_output` 时，直接把简历 Markdown 作为 `text_delta` 事件推给前端，
不依赖模型是否愿意复述。

> 实现注意：`tool_output` 的 `raw_item` 是 **dict**（不是对象），`call_id` 要用 `item.call_id`
> 或 `raw["call_id"]` 取；`tool_called` 的 `raw_item` 才是对象，名字在 `item.tool_name`。

### 2. 指令里写死「少问、先做」和「不得编造」
- 拿到姓名 / 方向 / 技能 / 经历中的任意两项就先生成，缺失字段写「待补充」，最多追问一轮；
- 禁止以「合理凝练」的名义编造量化成果（如凭空写「提升 20%」）；
- 简历末尾自动加一行核对提示：`本简历依据你提供的信息自动生成，投递前请逐条核对…`。

### 3. PDF 导出：字节走事件通道，不进模型上下文

云函数没有持久存储，所以 PDF 不是"存文件给个 URL"，而是把字节直接下发给浏览器：

1. 模型调用 `export_resume_pdf(resume_markdown)`；
2. 工具用 `reportlab` 渲染 PDF，放进**进程内缓存**（最多 20 份），只回给模型一个 `pdf_id`；
3. `agents/chat/index.py` 拦截这条 `tool_output`，从缓存取字节，用 `pdf_ready` 事件下发 Base64；
4. 前端收到后转成 Blob → `a[download]` 触发下载。

这样做的原因：**不能让 Base64 进模型上下文**。一份 4KB 的 PDF 编码后约 5.4KB，若作为工具返回值
喂给模型，既浪费 token 又容易被模型「复述」到回复里。所以工具只回小 JSON，字节走后端到前端的直连通道。

另外还有一个无状态的 `POST /export-pdf` 路由（`agents/export-pdf/index.py`）：前端点简历气泡上的
「下载 PDF」时按需转换，不依赖任何服务端状态，刷新页面、换实例都能用。

> 中文字体用的是 reportlab 内置 CID 字体 `STSong-Light`，**不需要上传 ttf**，沙箱里直接可用。
> 代价是它没有 `•` 字形，所以列表符号改用 Helvetica 绘制（`bulletFontName`）。

### 4. 本地运行不需要 EdgeOne 账号

`dev/local_server.py` 实现了平台运行时的同一套路由（`/chat` `/stop` `/history` `/conversations`
`/delete-conversation` `/export-pdf` `/parse-resume`），并**复用 `agents/chat/index.py` 里同一个 agent 和同一套 SSE 逻辑**，
所以本地看到的效果和线上一致。

> 它跑了一个**常驻事件循环**（独立线程）。不能在每个请求里 `asyncio.run()`——aiosqlite / httpx 的
> 连接会绑定到首次使用的循环，循环一关，下一轮就报 `RuntimeError: Event loop is closed`。

### 5. 上传简历润色：文本抽取 + 事实校验

用户可以把已有的 PDF / DOCX / TXT 简历拖进输入框，Agent 在原稿上改写，而不是重写一份新的。

链路：

1. 前端 `FileReader` 读成 Base64 → `POST /parse-resume`；
2. `agents/resume_parser.py` 抽文本：PDF 用 `pypdf`，DOCX 用标准库 `zipfile` 直接读
   `word/document.xml`（不引入 lxml），TXT 按 utf-8 → gb18030 → utf-16 依次尝试解码；
   顺手清掉 PDF 里常见的控制字符与「— 1 —」页码噪声；
3. 前端把「用户要求 + 原文」包成一条消息发给模型，原文包在 `<<<RESUME_SOURCE>>>` 标记里；
   界面上只显示一行「📎 文件名 · N 字（已折叠）」，不会把几千字铺在气泡里；
4. 模型改写完调用 `polish_resume(resume_markdown)` 提交定稿，工具把正文放进进程内缓存、只回 `rid`，
   `chat/index.py` 按 `rid` 取回原文并作为 `text_delta` 下发，避免模型二次复述时摘要或截断。

**事实校验（重点）**：实测发现模型会「顺手」补上原文没有的量化成果（如「提升 30%」「覆盖 12 家门店」），
光靠提示词压不住。所以 `polish_resume` 会拿 `ContextVar` 里存的原文与定稿比对数字集合：

- 定稿出现原文没有的数字 → 第一次直接拒绝（`ok: false` + 列出具体数字），让模型改写后重新提交；
- 第二次仍出现 → 放行，但要求模型在回复里标注这些数字需要用户确认（避免反复重试把轮次耗光）。

> 用 `ContextVar` 而不是模块级全局变量：同一进程会并发处理多个会话，全局变量会把 A 用户的简历
> 拿去校验 B 用户的润色结果。另外，捕获原文的代码放在 `_event_stream` 而不是 `handler`，
> 因为本地运行器直接调用 `_event_stream`，写在 `handler` 里会让本地校验静默失效。

---

### 6. 五套简历模板（同一份内容，五种排版）

`agents/resume_pdf.py` 顶部的 `TEMPLATES` 是唯一事实来源，模板 id 通过 `POST /export-pdf`
的 `template` 字段传入，未知 id 自动回退 `classic`：

| id | 名称 | 版式 | 做法 |
| --- | --- | --- | --- |
| `classic` | 经典蓝 | 单栏 | 蓝色标题 + 下划线，最通用的投递样式 |
| `minimal` | 极简黑白 | 单栏 | 左对齐大标题、细黑线、无彩色，留白多 |
| `sidebar` | 侧栏双栏 | 双栏 | 左侧深色栏放联系方式与技能，右侧放经历 |
| `academic` | 学术严谨 | 单栏 | 居中标题 + 上下细线，偏正式/升学 |
| `campus` | 清新校园 | 单栏 | 页头浅绿横幅 + 绿色标题色块 |

实现要点：

- **模板只改排版，不动内容**。换模板时前端传的是 `resume_ready` 事件带下来的简历原文，
  而不是整条消息内容——否则模型在简历后面补的「改了什么/建议补充」会被一起排进 PDF。
- **双栏用两个 `Frame`**（侧栏 + 主栏）加 `FrameBreak()` 实现；`NextPageTemplate('main_only')`
  让第 2 页起改用整页宽的单栏模板，避免续页正文挤在右侧、左边留一片空白。
  侧栏放什么由章节标题关键词决定（技能/证书/语言/兴趣…），含表格的章节一律留在主栏；
  如果所有章节都被判进侧栏导致主栏为空，则全部退回主栏。
- **空白页**：内容刚好排满时，末尾的 `Spacer` 会把内容挤出一张只有页码的空白页。
  `_trim_tail()` 在 build 前去掉结尾的 `Spacer`/`HRFlowable`。
- 前端 `src/lib/resumeTemplates.ts` 保存模板清单与 localStorage 记忆，
  `src/components/TemplateThumb.tsx` 用纯 SVG 画 5 张缩略图（页头布局、有没有侧栏、标题是
  下划线还是色块一眼能看出来），点卡片即按新样式重排并下载。

---

### 7. 岗位匹配卡片 + 平台实时搜索

`jobs.json` 是招聘库快照（55 条，每条带 `url` 与 `fetched_at`/`verified_at`）。快照有两个天然缺陷：
岗位会下架、抓到的 JD 会过期。所以匹配结果不只是一份文字清单：

- `match_jobs` 给每条结果附 `search_urls`（BOSS直聘 / 智联招聘 / 猎聘 的实时搜索链接），
  关键词会先过 `_search_keyword()` 清洗——「数据分析（2027届校招）」要变成「数据分析」才能搜到东西，
  城市则用内置城市码映射（未知城市不带 city 参数，避免定位到错误城市）。
- `agents/chat/index.py` 拦截 `match_jobs` 的 `tool_output`，下发 `jobs_ready` 事件（最多 8 条），
  前端 `ChatBubble` 渲染成卡片：岗位名、匹配度进度条、公司·地点·薪资、缺口、原岗位 + 三个平台按钮。
- 指令里明确要求模型**不要复述卡片内容**（不列岗位表、不贴 URL、不念薪资和百分比），
  只讲「先投哪 1~2 个、为什么、共同缺口」。

两个容易踩的坑：

- **匹配度全 0**：模型有时把空串或只把姓名传给 `resume_text`，`_tokenize` 取不到任何词元 → 所有岗位 0 分。
  现在用 `_LAST_RESUME` ContextVar 兜底（`generate_resume` 写入），并且 `< 10` 字符时直接返回 `no_resume` 错误
  要求重传，而不是给出一份全 0 的结果。返回值里的 `resume_chars` 就是为排查这件事留的。
- **批次词进 requirements**：「2027届」「秋招」是招聘批次不是技能，留在 `requirements` 里会显示成
  「缺口：2027届」，误导用户。入库时要么去掉，要么只写进 `description`。

`save_jobs` 在云函数里写不进磁盘（无持久存储，实例重启即丢），所以**扩充岗位库的唯一可靠方式**
是改仓库里的 `jobs.json` 再部署；前端粘贴 JD 走的是单轮 `jobs_json` 参数，不落盘。

改完 `jobs.json` 必须再跑一次同步，否则线上仍读旧数据：

```bash
.venv/Scripts/python.exe dev/sync_jobs_data.py
```

原因：EdgeOne 云函数只打包 `agents/` 下的 Python 模块，根目录的 `jobs.json` 不会随行。
`agents/jobs_data.py` 是内嵌副本，`_load_jobs()` 在读不到文件时回退到它。

### 8. 待补充信息弹窗

简历缺项不再写在正文里，改为弹窗逐条收集：

- `generate_resume` 从 `profile_json` 的缺失字段直接算问题（姓名、手机、邮箱、城市、求职意向、
  简介、**项目经历**、实习/工作、教育、技能证书，最多 12 条），存进模块级变量；
  `chat/index.py` 下发 `resume_ready` 时一并推 `followups_ready`。**不依赖模型多调工具**——
  实测 qwen-plus 经常把「待补充」写进正文而不调 `report_missing_info`，所以必须有后端兜底。
- **空板块也问**：项目经历、专业技能/证书完全缺失时照样列进弹窗让用户补，
  不能因为字段为空就跳过；项目描述里已经带数字视为已量化，不再追问，避免反复弹同一句。
- 模型主动调 `report_missing_info(questions_json)` 时也能下发；两路用 `followups_sent` 去重。
- 前端 `FollowUpDialog` 弹窗收集答案，提交后自动拼成一条消息重新生成简历；
  已补的项在新一轮 profile 里不再缺失，所以弹窗会逐轮收敛。「暂时跳过」直接关闭。
- 注意：SDK 的 `function_tool` 可能在 `copy_context()` 里执行，`ContextVar` 的 `set()`
  不会回传到外层——`_FOLLOWUPS_CACHE` 用模块级变量而不是 ContextVar，就是这个原因。

---

## 三、本地运行

前置：Node ≥ 18、Python ≥ 3.10。

```bash
npm install
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
npm run build        # 构建前端到 dist/
```

配置 `.env`（复制 `.env.example` 后填）：

```ini
AI_GATEWAY_API_KEY=你的Key
AI_GATEWAY_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1   # 阿里百炼
AI_GATEWAY_MODEL=qwen-plus                                              # 需支持 function calling
```

启动：

```bash
.venv/Scripts/python.exe dev/local_server.py      # 或双击 启动本地版.bat
# http://127.0.0.1:8088
```

体验话术：
- 「帮我生成简历：我叫陈静，本科信息管理，会 SQL、Excel、Power BI，做过校园二手交易平台用户增长分析」
- 「用招聘库里的真实岗位帮我匹配，给我前 3 名和缺口」
- 「把这几条真实 JD 存到招聘库：<粘贴 JSON>」

> 也可以走官方 CLI：`npm i -g edgeone` + `edgeone makers dev`，但它**要求先登录**
> （浏览器授权或 `EDGEONE_PAGES_API_TOKEN`），非交互环境会直接报 `You are not authenticated`。

---

## 四、部署上线（EdgeOne Makers）

1. 代码推到 GitHub（空仓库，不要勾 README）；
2. Makers 控制台 → 新建 → 从 Git 仓库创建 → 授权 GitHub → 选这个仓库；
3. 框架自动识别为 `openai-agents-sdk`（根目录 `edgeone.json` 已声明），
   **平台会自动注入** `AI_GATEWAY_API_KEY` / `AI_GATEWAY_BASE_URL` / `AI_GATEWAY_MODEL`，
   默认用免费模型 `@makers/deepseek-v4-flash`，不配也能跑；
4. 点部署 → 拿到 `https://xxx.makershost.com`；
5. 想用自己的模型：在 Makers 环境变量里同时改 `AI_GATEWAY_API_KEY`、`AI_GATEWAY_BASE_URL`、
   `AI_GATEWAY_MODEL`（三个要一起改，不能只换 Key）。

详细傻瓜版步骤见 `DEPLOY_GUIDE.md`。

---

## 五、目录与改动清单

```text
├── agents/chat/index.py      # Agent 指令 + SSE 流（含简历注入、PDF 下发）
├── agents/_tools.py          # 五个真实工具
├── agents/resume_pdf.py      # Markdown 简历 → 中文 PDF（5 套模板，reportlab + STSong-Light）
├── agents/resume_parser.py   # PDF / DOCX / TXT → 纯文本（pypdf + 标准库 zipfile）
├── agents/export-pdf/        # POST /export-pdf，无状态转换
├── agents/parse-resume/      # POST /parse-resume，上传简历解析
├── agents/chat/stop.py       # 中断生成
├── cloud-functions/          # history / conversations / delete / clear
├── dev/local_server.py       # 免账号本地运行器
├── 启动本地版.bat            # Windows 一键启动
├── jobs.json                 # 55 条真实岗位（带 url / fetched_at）
├── agents/jobs_data.py       # jobs.json 的内嵌副本（云函数回退读取）
├── src/                      # React 前端
└── edgeone.json              # framework=openai-agents-sdk
```

相对官方 starter 的改动：

- `agents/_tools.py` —— 重写：四个玩具工具 → 简历 / 润色 / 匹配 / 入库 / PDF 导出，含数字事实校验
- `agents/chat/index.py` —— 指令重写 + `tool_output` 简历注入 + `pdf_ready` 下发 + 丢弃空 delta
- `agents/resume_pdf.py`、`agents/export-pdf/` —— 新增，PDF 渲染（5 套模板）与下载
- `agents/resume_parser.py`、`agents/parse-resume/` —— 新增，上传简历的文本抽取
- `src/lib/resumeTemplates.ts`、`src/components/TemplateThumb.tsx` —— 新增，模板清单 + SVG 缩略图
- `src/types.ts`、`src/api.ts`、`src/lib/downloadPdf.ts`、`src/components/ChatBubble.tsx` ——
  新增 `pdf_ready` / `resume_ready` 事件处理、「下载 PDF」按钮与模板挑选面板
- `src/components/ChatInput.tsx`、`src/lib/resumeAttachment.ts` —— 新增附件按钮 / 拖拽上传 /
  附件卡片 / 历史消息里的原文折叠
- `followups_ready` 事件 + `FollowUpDialog` 弹窗：缺项结构化收集，提交后自动回填重生成
- `jobs_ready` 事件 + `JobBoard` 卡片：岗位匹配结果结构化下发，每张卡带原岗位与三家平台实时搜索
- `src/App.tsx`、`src/i18n/{zh,en}.ts`、`src/components/CodeViewer.tsx` ——
  指示灯 / 文案 / 代码示例全部换成简历与岗位语义
- `dev/local_server.py`、`启动本地版.bat` —— 新增，仅本地使用，不参与云端构建
- `jobs.json` —— 55 条真实岗位数据，含 2027 届校招与深圳/广州实习岗，链接逐条探活
- `dev/sync_jobs_data.py` —— 改完 jobs.json 后同步内嵌副本
- `requirements.txt` —— 新增 `reportlab`、`pypdf`（云端构建会装）
