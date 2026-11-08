# 部署指南：「简历生成 + 工作匹配」Agent 如何上线

> 这份指南假设你**完全没接触过部署**，按从上到下的顺序做就行。每一步都告诉你"点什么 / 输什么"。
> 本 Agent 已经写好代码（`agents/_tools.py` 里是真实工具），你只需要把它"放到网上让别人能访问"。

---

## 一、先搞懂：要部署到哪里、为什么

**EdgeOne Makers** 是腾讯云的 AI Agent 托管平台。它一次性帮你搞定普通人最头疼的几件事：

| 你本来要做的 | Makers 帮你做 |
|---|---|
| 买云服务器、装环境 | ❌ 不用，云端直接跑 |
| 申请域名、配 HTTPS 证书 | ❌ 不用，自动给 `*.makershost.com` 域名 + 免费证书 |
| 自己申请大模型 API Key 并写进代码 | ❌ 不用（见第三步，框架声明后自动配） |
| 抗 DDoS / 防攻击 | ✅ 自带 |

**结论**：你只负责"把代码传上去 + 点部署"，其余 Makers 包了。

---

## 二、整体流程（一张图就够）

```
你本地(这个zip)  ──push到GitHub──▶  Makers 绑定仓库  ──点部署──▶  线上可访问的 Agent
   (已写好代码)         │                    │                      │
                       └─ 也可用 Makers 模板 ─┘                      └─ *.makershost.com 域名
                          (官方原版，不含简历功能)                       (可选再绑自己的域名)
```

**两条路线，选一条：**

- **路线 A（推荐，含简历/匹配功能）**：把你这个改造过的项目推到 GitHub → Makers 绑定 → 部署。
- **路线 B（最快 3 分钟验证，但只有原版玩具工具）**：Makers 控制台直接"从模板创建"官方 OpenAI Agents Starter，先看看效果。

下面以**路线 A** 为主讲，路线 B 放在最后"备选方案"。

---

## 三、路线 A：部署你的"简历+匹配"Agent（详细步骤）

### 第 1 步：注册 GitHub（没有就先注册）
- 打开 https://github.com → 注册一个免费账号。
- 登录后，点右上角 **"+" → New repository**。
- 仓库名随便起，比如 `resume-job-agent`。
- **关键**：不要勾 "Add a README"，保持空仓库 → 点 **Create repository**。
- 创建后会看到一个空仓库页面，里面有一行 `https://github.com/你的用户名/resume-job-agent.git`，先复制留着。

### 第 2 步：把本项目的 zip 弄到本地并解压
- 把 WorkBuddy 工作区里的 `resume-job-agent.zip` 下载到你的电脑（比如 D 盘根目录）。
- 右键解压，得到 `resume-job-agent` 文件夹。

### 第 3 步：安装 Git（电脑上还没装的话）
- 下载 https://git-scm.com/download/win 安装，**一路 Next** 即可。
- 装完在解压目录里**右键 → "Open Git Bash here"**（或在文件夹地址栏输入 `bash` 回车）。

### 第 4 步：把代码推到你的 GitHub 仓库
在 Git Bash 里**逐行**粘贴执行（把 `你的用户名` 换成你真实的）：

```bash
cd resume-job-agent
git init
git add .
git commit -m "简历生成+工作匹配 Agent 初始版本"
git branch -M main
git remote add origin https://github.com/你的用户名/resume-job-agent.git
git push -u origin main
```

> 第一次 push 会弹出 GitHub 登录框，用浏览器授权即可（或用个人访问令牌 Personal access token 代替密码）。

看到 `main -> main` 类似提示就成功了。刷新你的 GitHub 页面，能看到代码就在里面了。

### 第 5 步：在 Makers 绑定仓库并部署
1. 打开 Makers 控制台：https://edgeone.ai/makers （或腾讯云控制台搜 EdgeOne → Makers）。
2. 首次使用点 **开通 Makers**（免费）。
3. 点 **新建 → 从 Git 仓库创建**（或"绑定代码仓库"），**授权连接 GitHub**。
4. 在列表里选你刚推上去的 `resume-job-agent` 仓库。
5. 框架**自动识别**为 `openai-agents-sdk`（因为项目根目录 `edgeone.json` 里已声明 `framework`）。

   > 💡 **重要**：正因为声明了框架，Makers 部署后会**自动注入** `AI_GATEWAY_API_KEY` / `AI_GATEWAY_BASE_URL` / `AI_GATEWAY_MODEL` 三个环境变量。你**不需要自己填 Key**，开箱即用，默认用免费模型 `@makers/deepseek-v4-flash`。
6. 点 **部署**。等几十秒～一两分钟，页面会显示一个 `https://xxxx.makershost.com` 的链接。

### 第 6 步：打开试一试
- 点那个 `*.makershost.com` 链接，就能看到聊天界面。
- 试着发："帮我生成一份简历，我是计算机专业学生，会 Python 和数据分析，做过医疗 NER 项目" → Agent 会调 `generate_resume` 生成 Markdown 简历。
- 再发："帮我匹配适合的工作" → Agent 调 `match_jobs` 对你 `jobs.json` 里 40 条真实岗位打分排序。

### 第 7 步（可选）：绑定你自己的域名
- 预览域名 `*.makershost.com` **有时效限制**，正式长期用建议绑自己的域名。
- 在 Makers 项目 **设置 → 自定义域名** 里填入你的域名（如 `resume.example.com`）。
- 按提示去你的域名服务商做一条 **CNAME 解析**指向 Makers 给的地址。
- Makers **自动申请并续期免费 HTTPS 证书**，不用你管。

---

## 四、路线 B（备选）：3 分钟先看看原版长啥样
如果你只想先验证平台、不急着上简历功能：
1. Makers 控制台 → **新建 → 从模板创建**。
2. 选 **OpenAI Agents Starter (Python)**。
3. 点部署，几秒后得到预览链接，直接聊天体验。
（这个不含简历/匹配工具，仅用于熟悉平台。要上功能还是走路线 A。）

---

## 五、本地调试（可选，想在自己电脑跑起来看效果）
**最省事：双击项目根目录的 `启动本地版.bat`**，浏览器会自动打开 http://127.0.0.1:8088 。
它不需要注册 EdgeOne、不需要 GitHub，只要能连上模型就行（`.env` 里填 Key）。

手动方式：
```bash
npm install                     # 前端依赖
python -m venv .venv            # Python 环境
.venv/Scripts/python.exe -m pip install -r requirements.txt
npm run build                   # 构建 dist/
.venv/Scripts/python.exe dev/local_server.py
```
本地地址：http://127.0.0.1:8088

> 官方 CLI 方式（`npm i -g edgeone` 然后 `edgeone makers dev`）**必须先登录**：
> 要么浏览器授权，要么设置 `EDGEONE_PAGES_API_TOKEN`。没登录会直接报
> `You are not authenticated`，所以新手建议先用上面的 `启动本地版.bat`。

---

## 六、常见问题 / 排错

| 现象 | 原因 | 解决 |
|---|---|---|
| 部署后聊天无响应 | 没声明框架 / 环境变量没注入 | 确认根目录 `edgeone.json` 含 `"agents":{"framework":"openai-agents-sdk"}`（本项目已有） |
| 本地 `edgeone` 命令不存在 | 没装 CLI | 执行 `npm install -g edgeone` |
| push 时被拒 / 要密码 | GitHub 已不支持密码登录 | 用浏览器授权弹窗，或用 Personal access token 当密码 |
| 预览链接打不开/过期 | 预览域名有时效 | 走第 7 步绑定自己的域名 |
| 匹配结果很少 | `jobs.json` 为空 | 确认 `jobs.json` 有数据（本项目已内置 40 条真实岗位）；或用对话里 `save_jobs` 补充 |
| 想换更强模型 | 默认免费模型额度有限 | Makers → Models 绑定自己的付费 Key（BYOK），改 `AI_GATEWAY_MODEL` |

---

## 七、费用说明（学生友好）
- **免费额度**：`@makers/deepseek-v4-flash` 内置模型免费（有用量上限），原型/课程作业够用。
- 绑自己域名：HTTPS 证书免费，域名本身需自备（几元～几十元/年）。
- 超出免费额度或绑付费模型：按用量计费，先从低价档起，课程演示基本花不到钱。

---

## 八、如果你想让我帮你推
你也可以在 WorkBuddy 里直接把 GitHub 仓库地址 + 一个 **Personal access token**（勾 `repo` 权限）发我，我可以在当前环境帮你 `git push` 上去，你只差最后一步去 Makers 点"部署"。
