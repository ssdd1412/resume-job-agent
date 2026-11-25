const en = {
  // Header
  "app.title": "Resume · Job Match Agent",
  "app.subtitle": "OpenAI Agents SDK + EdgeOne Makers · real data only, nothing fabricated",

  // Empty state
  "empty.title": "Resume Builder + Job Matcher",
  "empty.hint": "Tell me your name, target role, education, skills and experience and I'll turn it into a ready-to-send resume. You can also upload an existing resume (PDF / DOCX) and I'll rewrite it line by line and flag the wording a recruiter would skip. Then paste real job postings and I'll score each requirement: what matches, and what's still missing.",
  "empty.features": "Resume Builder · Resume Polish · Job Matching · Job Store · PDF Export · Session Memory",

  // Welcome guide panel
  "welcome.kicker": "AI resume & job-hunt assistant",
  "welcome.tagline": "Tell your story clearly. See the job market truly.",
  "welcome.truth": "Real data only",
  "welcome.stat1": "6 features",
  "welcome.stat1sub": "Full resume workflow",
  "welcome.stat2": "55 jobs",
  "welcome.stat2sub": "Real open positions",
  "welcome.stat3": "5 templates",
  "welcome.stat3sub": "Professional layouts",
  "welcome.section": "Pick a capability to get started",
  "welcome.c1.title": "Build a resume",
  "welcome.c1.desc": "Describe your experience naturally, get a structured resume",
  "welcome.c2.title": "Polish a resume",
  "welcome.c2.desc": "Upload an existing resume, rewrite it line by line",
  "welcome.c2.prompt": "I want to polish an existing resume. Please ask me to upload a PDF or DOCX; once received, keep every real experience and make the wording more professional and better aligned with my target role.",
  "welcome.c3.title": "Match real jobs",
  "welcome.c3.desc": "Score each requirement, find matches and gaps",
  "welcome.c4.title": "Search & store jobs",
  "welcome.c4.desc": "Search live openings and save them to the job store",
  "welcome.c4.prompt": "Search for real open positions for me (specify the job title and city), save the results to the job store, and include the source links.",
  "welcome.c5.title": "Export to PDF",
  "welcome.c5.desc": "5 templates to choose from, download and apply",
  "welcome.c6.title": "Session memory",
  "welcome.c6.desc": "Conversations saved automatically, resume anytime",
  "welcome.c6.prompt": "Please summarize the resume details and job preferences we have confirmed in this conversation.",
  "welcome.foot": "Click any card to start, or just type below · only the real information you provide is used",

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
  "pdf.templateTitle": "Pick a resume template",
  "pdf.templateHint": "Tap one to re-export and download in that style",
  "pdf.templateFoot": "Templates only change the layout, never a word of content. Your pick is remembered.",
  "tpl.classic": "Classic Blue",
  "tpl.classic.desc": "Blue headings, ruled",
  "tpl.minimal": "Minimal Mono",
  "tpl.minimal.desc": "No color, lots of air",
  "tpl.sidebar": "Sidebar",
  "tpl.sidebar.desc": "Dark column for skills",
  "tpl.academic": "Academic",
  "tpl.academic.desc": "Centered, fine rules",
  "tpl.campus": "Campus",
  "tpl.campus.desc": "Green header band",

  // Job matches
  "jobs.title": "Matching open roles",
  "jobs.subtitle": "Tap “Search live” to see roles open right now — the original link may be delisted",
  "jobs.match": "Match",
  "jobs.view": "View role",
  "jobs.search": "Search live",
  "jobs.more": "more not shown",
  "jobs.source": "Source",
  "jobs.missing": "Gaps",

  // Missing-info dialog
  "followup.title": "Fill these in for a stronger resume",
  "followup.hint": "Your resume is missing the details below (including projects and skills — you can add them now even if they're absent). Fill them in and I'll update the resume and create the missing sections automatically — or just skip.",
  "followup.placeholder": "Your answer (leave blank to skip)",
  "followup.skip": "Skip & generate with what I have",
  "followup.submit": "Submit & update resume",
  "followup.sending": "Updating…",
  "followup.count": "{n} item(s) to fill in",

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

  // Layout controls
  "layout.openSidebar": "Open conversations",
  "layout.closeSidebar": "Close conversations",
  "layout.togglePanel": "Toggle code panel",

  // Language toggle
  "lang.switch": "中文",

  // Theme switcher
  "theme.title": "Switch theme",
  "theme.accent": "Accent color",
  "theme.mode": "Appearance",
  "theme.gold": "Gold",
  "theme.blue": "Blue",
  "theme.purple": "Purple",
  "theme.green": "Green",
  "theme.pink": "Pink",
  "theme.dark": "Dark",
  "theme.light": "Light",

  // ─── Floating bottom-right action badges ─────────────────────────────
  "floatingLink.deploy": "Deploy",
  "floatingLink.github": "GitHub",
} as const;

export default en;
