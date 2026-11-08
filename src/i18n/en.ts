const en = {
  // Header
  "app.title": "Resume · Job Match Agent",
  "app.subtitle": "OpenAI Agents SDK + EdgeOne Makers · real data only, nothing fabricated",

  // Empty state
  "empty.title": "Resume Builder + Job Matcher",
  "empty.hint": "Tell me your real name, target role, education, skills and experience — I'll turn it into a ready-to-send Markdown resume. Then paste real job postings and I'll score each requirement: what matches, and what's still missing.",
  "empty.features": "Resume Builder · Job Matching · Job Store · Session Memory",

  // Chat input
  "chat.placeholder": "Type a message...  ⏎ Send · Shift+⏎ Newline",
  "chat.hint": "Powered by OpenAI Agents SDK + EdgeOne Makers · no fabricated experience or jobs",

  // Preset questions
  "preset.1": "Build my resume: I'm Zhang San, CS undergrad, Python/SQL/data analysis, built a medical NER project and an e-commerce dashboard",
  "preset.2": "Match me against the real jobs in the job store and tell me where my gaps are",

  // Tool indicators
  "tool.resume": "Resume",
  "tool.match": "Match",
  "tool.save": "Save jobs",

  // Status & errors
  "status.error": "Request failed. Please check if the backend service is running.",
  "status.stopped": "⏹ *Generation stopped*",
  "status.backendError": "Backend abort request failed. The server may still be running.",

  // Debug panel
  "debug.title": "Trace",
  "debug.events": "events",
  "debug.clear": "Clear",
  "debug.empty": "Waiting for SSE events...",
  "debug.emptyHint": "After sending a message, all raw backend data will be displayed here.",

  // Conversation sidebar
  "sidebar.label": "Conversation list",
  "sidebar.title": "Chats",
  "sidebar.newChat": "New chat",
  "sidebar.loading": "Loading conversations...",
  "sidebar.loadMore": "Load more",
  "sidebar.loadingMore": "Loading...",
  "sidebar.emptyTitle": "No conversations yet",
  "sidebar.emptyHint": "Click \"New chat\" to start your first conversation.",
  "sidebar.delete": "Delete conversation",
  "sidebar.deleteConfirm": "Permanently delete this conversation? This cannot be undone.",

  // Aria labels (button hover/screen-reader)
  "aria.send": "Send",
  "aria.clearHistory": "Clear history",
  "aria.stopGeneration": "Stop generation",

  // Language toggle
  "lang.switch": "中文",

  // ─── Floating bottom-right action badges ─────────────────────────────
  "floatingLink.deploy": "Deploy",
  "floatingLink.github": "GitHub",
} as const;

export default en;
