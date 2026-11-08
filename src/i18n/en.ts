const en = {
  // Header
  "app.title": "Resume · Job Match Agent",
  "app.subtitle": "OpenAI Agents SDK + EdgeOne Makers · real data only, nothing fabricated",

  // Empty state
  "empty.title": "Resume Builder + Job Matcher",
  "empty.hint": "Tell me your name, target role, education, skills and experience and I'll turn it into a ready-to-send resume. You can also upload an existing resume (PDF / DOCX) and I'll rewrite it line by line and flag the wording a recruiter would skip. Then paste real job postings and I'll score each requirement: what matches, and what's still missing.",
  "empty.features": "Resume Builder · Resume Polish · Job Matching · Job Store · PDF Export · Session Memory",

  // Chat input
  "chat.placeholder": "Type a message, or drop a resume file here...  ⏎ Send · Shift+⏎ Newline",
  "chat.hint": "Powered by OpenAI Agents SDK + EdgeOne Makers · no fabricated experience or jobs",

  // Resume upload & polish
  "tool.polish": "Polish",
  "attach.button": "Upload resume",
  "attach.parsing": "Parsing...",
  "attach.remove": "Remove attachment",
  "attach.hint": "Upload a PDF / DOCX / TXT resume and I'll rewrite it in place (max 10MB)",
  "attach.failed": "Parse failed",
  "attach.defaultPrompt": "Please polish this resume: keep every real experience, and make the wording more professional and better aligned with the target role.",

  // Preset questions
  "preset.1": "Build my resume: I'm Zhang San, CS undergrad, Python/SQL/data analysis, built a medical NER project and an e-commerce dashboard",
  "preset.2": "Match me against the real jobs in the job store and tell me where my gaps are",
  "preset.3": "Export the resume you just built as a PDF so I can send it out",

  // Tool indicators
  "tool.resume": "Resume",
  "tool.match": "Match",
  "tool.save": "Save jobs",
  "tool.pdf": "PDF export",

  // PDF export
  "pdf.download": "Download PDF",
  "pdf.generating": "Generating...",
  "pdf.failed": "Export failed",

  // Status & errors
  "status.error": "⚠️ Connection lost. Refresh the page and try again.",
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
