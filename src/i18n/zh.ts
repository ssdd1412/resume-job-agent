const zh = {
  // Header
  "app.title": "简历生成 · 工作匹配 Agent",
  "app.subtitle": "OpenAI Agents SDK + EdgeOne Makers · 只用真实数据，不虚构经历与岗位",

  // Empty state
  "empty.title": "简历生成 + 工作匹配 Agent",
  "empty.hint": "把你真实的姓名、求职意向、教育、技能、项目/实习经历告诉我，我帮你整理成一份可直接投递的 Markdown 简历；再把真实招聘信息贴给我，我会逐条比对岗位要求，给出匹配度、命中项和待补强缺口。",
  "empty.features": "简历生成 · 岗位匹配 · 招聘入库 · PDF 导出 · 会话记忆",

  // Chat input
  "chat.placeholder": "发消息…  ⏎ 发送 · Shift+⏎ 换行",
  "chat.hint": "由 OpenAI Agents SDK + EdgeOne Makers 驱动 · 不编造任何经历与岗位",

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

  // Language toggle
  "lang.switch": "English",

  // ─── Floating bottom-right action badges ─────────────────────────────
  "floatingLink.deploy": "一键部署",
  "floatingLink.github": "GitHub",
} as const;

export default zh;
