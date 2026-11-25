const zh = {
  // Header
  "app.title": "简历生成 · 工作匹配 Agent",
  "app.subtitle": "OpenAI Agents SDK + EdgeOne Makers · 只用真实数据，不虚构经历与岗位",

  // Empty state
  "empty.title": "简历生成 + 工作匹配 Agent",
  "empty.hint": "把你的姓名、求职意向、教育、技能、项目/实习经历告诉我，我帮你整理成一份可直接投递的简历；也可以直接上传一份已有简历（PDF / DOCX），我在原稿上逐段改写润色、指出哪句话最容易被筛掉。再把真实招聘信息贴给我，我会逐条比对岗位要求，给出匹配度、命中项和待补强缺口。",
  "empty.features": "简历生成 · 简历润色 · 岗位匹配 · 招聘入库 · PDF 导出 · 会话记忆",

  // Welcome guide panel
  "welcome.kicker": "AI 简历与求职助手",
  "welcome.tagline": "把经历说清楚，把岗位看明白",
  "welcome.truth": "仅用真实数据",
  "welcome.stat1": "6 项能力",
  "welcome.stat1sub": "覆盖简历全流程",
  "welcome.stat2": "55 条",
  "welcome.stat2sub": "真实在招岗位",
  "welcome.stat3": "5 套",
  "welcome.stat3sub": "专业简历模板",
  "welcome.section": "选择一项能力，立即开始",
  "welcome.c1.title": "智能生成简历",
  "welcome.c1.desc": "用自然语言描述经历，生成结构化简历",
  "welcome.c2.title": "简历润色优化",
  "welcome.c2.desc": "上传已有简历，逐段改写更专业",
  "welcome.c2.prompt": "我想润色已有简历，请提示我上传 PDF 或 DOCX；收到后保留全部真实经历，把表达改得更专业、更贴合目标岗位。",
  "welcome.c3.title": "真实岗位匹配",
  "welcome.c3.desc": "比对岗位要求，给出匹配度与缺口",
  "welcome.c4.title": "岗位搜索入库",
  "welcome.c4.desc": "实时搜索在招岗位并记录到岗位库",
  "welcome.c4.prompt": "帮我搜索当前真实在招的岗位（写明岗位名和城市），把找到的岗位记录到招聘库，并给出来源链接。",
  "welcome.c5.title": "PDF 一键导出",
  "welcome.c5.desc": "5 套模板任选，直接下载投递",
  "welcome.c6.title": "会话记忆",
  "welcome.c6.desc": "历史对话自动保存，随时继续",
  "welcome.c6.prompt": "请总结我们这次对话里已经确认的简历信息和岗位偏好。",
  "welcome.foot": "点击卡片即可开始，也可以在下方直接输入 · 全程只用你提供的真实信息",

  // Chat input
  "chat.placeholder": "发消息，或把简历文件拖进来…  ⏎ 发送 · Shift+⏎ 换行",
  "chat.hint": "由 OpenAI Agents SDK + EdgeOne Makers 驱动 · 不编造任何经历与岗位",

  // Resume upload & polish
  "tool.polish": "简历润色",
  "attach.button": "上传简历",
  "attach.parsing": "正在解析…",
  "attach.remove": "移除附件",
  "attach.hint": "上传 PDF / DOCX / TXT 简历，在原稿上改写润色（最大 10MB）",
  "attach.failed": "解析失败",
  "attach.defaultPrompt": "请帮我修改润色这份简历：保留全部真实经历，把表达改得更专业、更贴合目标岗位。",

  // Preset questions
  "preset.1": "帮我生成简历：我叫张三，本科计算机专业，会 Python/SQL/数据分析，做过医疗 NER 项目和电商数据看板",
  "preset.2": "按招聘库里的真实岗位帮我匹配，告诉我哪些岗位最合适、还缺哪些技能",
  "preset.3": "把刚才的简历导出成 PDF，我要直接拿去投递",

  // Tool indicators
  "tool.resume": "生成简历",
  "tool.match": "岗位匹配",
  "tool.save": "招聘入库",
  "tool.pdf": "PDF 导出",

  // PDF export
  "pdf.download": "下载 PDF",
  "pdf.generating": "正在生成…",
  "pdf.failed": "导出失败",
  "pdf.templateTitle": "挑选简历模板",
  "pdf.templateHint": "点一个模板，立刻按新样式重新导出并下载",
  "pdf.templateFoot": "模板只改变排版，不改一个字的内容；选过的样式会记住。",
  "tpl.classic": "经典蓝",
  "tpl.classic.desc": "蓝色标题下划线",
  "tpl.minimal": "极简黑白",
  "tpl.minimal.desc": "无彩色留白多",
  "tpl.sidebar": "侧栏双栏",
  "tpl.sidebar.desc": "左侧深色放技能",
  "tpl.academic": "学术严谨",
  "tpl.academic.desc": "居中标题细线",
  "tpl.campus": "清新校园",
  "tpl.campus.desc": "浅绿页头色块",

  // Job matches
  "jobs.title": "匹配到的在招岗位",
  "jobs.subtitle": "点「去平台搜」看此刻在招的同岗位，原链接可能已下线",
  "jobs.match": "匹配度",
  "jobs.view": "看原岗位",
  "jobs.search": "去平台搜",
  "jobs.more": "条未展示",
  "jobs.source": "来源",
  "jobs.missing": "缺口",

  // 待补充信息弹窗
  "followup.title": "补齐这几项，简历更完整",
  "followup.hint": "下面这些信息简历里还没有（包括项目经历、专业技能等，没有也可以现在补）。填完我会自动更新简历并新建对应板块；不想填可以直接跳过。",
  "followup.placeholder": "在这里填写（可留空）",
  "followup.skip": "跳过，用现有信息生成",
  "followup.submit": "提交并更新简历",
  "followup.sending": "正在更新…",
  "followup.count": "共 {n} 项待补充",

  // Status & errors
  "status.error": "⚠️ 连接已断开，请刷新页面后重新发送。",
  "status.stopped": "⏹ *已停止生成*",
  "status.backendError": "⚠️ 后端中断请求失败，服务端可能仍在运行。",

  // Debug panel
  "debug.title": "传输流",
  "debug.events": "事件",
  "debug.clear": "清除",
  "debug.empty": "等待 SSE 事件...",
  "debug.emptyHint": "发送消息后，所有原始后端数据将在此处显示。",

  // Conversation sidebar
  "sidebar.label": "会话列表",
  "sidebar.title": "会话",
  "sidebar.newChat": "新建聊天",
  "sidebar.loading": "正在加载会话...",
  "sidebar.loadMore": "加载更多",
  "sidebar.loadingMore": "加载中...",
  "sidebar.emptyTitle": "暂无会话",
  "sidebar.emptyHint": "点击「新建聊天」开始第一段对话。",
  "sidebar.delete": "删除会话",
  "sidebar.deleteConfirm": "确定要永久删除这个会话吗？此操作不可恢复。",

  // Aria labels (button hover/screen-reader)
  "aria.send": "发送",
  "aria.clearHistory": "清除历史",
  "aria.stopGeneration": "停止生成",

  // Layout controls
  "layout.openSidebar": "打开会话列表",
  "layout.closeSidebar": "关闭会话列表",
  "layout.togglePanel": "展开/收起代码面板",

  // Language toggle
  "lang.switch": "English",

  // Theme switcher
  "theme.title": "切换主题颜色",
  "theme.accent": "主题色",
  "theme.mode": "明暗模式",
  "theme.gold": "金色",
  "theme.blue": "蓝色",
  "theme.purple": "紫色",
  "theme.green": "绿色",
  "theme.pink": "粉色",
  "theme.dark": "深色",
  "theme.light": "浅色",

  // ─── Floating bottom-right action badges ─────────────────────────────
  "floatingLink.deploy": "一键部署",
  "floatingLink.github": "GitHub",
} as const;

export default zh;
