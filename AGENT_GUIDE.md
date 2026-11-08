# 简历生成 + 工作匹配 Agent

基于 `TencentEdgeOne/openai-agent-starter-python` 改造：把默认的「天气 / 穿衣 / 翻译 / 统计」四个示例工具，
换成 **简历生成、岗位匹配、招聘入库** 三个真实工具，可本地运行，也可一键部署到 EdgeOne Makers。

- 文档1：从 0 到 1 做一个 AI Agent（环境搭建 → 开发 → 部署 → 绑域名）
- 文档2：EdgeOne Makers - WorkBuddy 智能体搭建手册（七步流程）

> 只想赶快看到效果 → 双击 **`启动本地版.bat`**，浏览器会自动打开 `http://127.0.0.1:8088`。

---

## 一、这个 Agent 能做什么

| 工具 | 作用 | 是否虚构数据 |
| --- | --- | --- |
| `generate_resume` | 结构化候选人信息 → 一份 Markdown 简历 | 否，只用你提供的真实信息 |
| `match_jobs` | 简历 × 真实招聘信息 → 匹配度打分 + Top 推荐 + 缺口分析 | 否，岗位必须来自真实数据 |
| `save_jobs` | 真实招聘信息写入 `jobs.json`（按 title+company 去重） | 否，由你提供 |
| `export_resume_pdf` | 简历 Markdown → 中文排版 PDF，推给前端一键下载 | 否，只渲染已有内容 |

匹配逻辑（透明、可解释）：
1. 简历与岗位要求都切成词元（英文按词、中文按二元组）；
2. 逐条比对 `requirements`，命中记 matched、未命中记 missing；
3. 匹配度 = 命中数 / 要求总数 × 100，标题相关 +5、地点一致 +3（封顶 100）；
4. 按匹配度降序返回，附命中点与待补强项。

仓库自带 `jobs.json`：**40 条真实在招岗位**，匹配结果里的公司名、薪资、匹配度全部来自这份数据。

---

## 二、四个工程细节（和原版 starter 的差异）

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
`/delete-conversation` `/export-pdf`），并**复用 `agents/chat/index.py` 里同一个 agent 和同一套 SSE 逻辑**，
所以本地看到的效果和线上一致。

> 它跑了一个**常驻事件循环**（独立线程）。不能在每个请求里 `asyncio.run()`——aiosqlite / httpx 的
> 连接会绑定到首次使用的循环，循环一关，下一轮就报 `RuntimeError: Event loop is closed`。

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
├── agents/_tools.py          # 四个真实工具
├── agents/resume_pdf.py      # Markdown 简历 → 中文 PDF（reportlab + STSong-Light）
├── agents/export-pdf/        # POST /export-pdf，无状态转换
├── agents/chat/stop.py       # 中断生成
├── cloud-functions/          # history / conversations / delete / clear
├── dev/local_server.py       # 免账号本地运行器
├── 启动本地版.bat            # Windows 一键启动
├── jobs.json                 # 40 条真实岗位
├── src/                      # React 前端
└── edgeone.json              # framework=openai-agents-sdk
```

相对官方 starter 的改动：

- `agents/_tools.py` —— 重写：四个玩具工具 → 简历 / 匹配 / 入库 / PDF 导出
- `agents/chat/index.py` —— 指令重写 + `tool_output` 简历注入 + `pdf_ready` 下发 + 丢弃空 delta
- `agents/resume_pdf.py`、`agents/export-pdf/` —— 新增，PDF 渲染与下载
- `src/types.ts`、`src/api.ts`、`src/lib/downloadPdf.ts`、`src/components/ChatBubble.tsx` ——
  新增 `pdf_ready` / `resume_ready` 事件处理与「下载 PDF」按钮
- `src/App.tsx`、`src/i18n/{zh,en}.ts`、`src/components/CodeViewer.tsx` ——
  指示灯 / 文案 / 代码示例全部换成简历与岗位语义
- `dev/local_server.py`、`启动本地版.bat` —— 新增，仅本地使用，不参与云端构建
- `jobs.json` —— 40 条真实岗位数据
- `requirements.txt` —— 新增 `reportlab`（云端构建会装）
