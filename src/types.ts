export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /**
   * True while the assistant is actively producing this message
   * (between the first text_delta and the final done/error event).
   * Drives the in-bubble blinking caret to give the user feedback
   * that more content is still streaming. Cleared once done/error fires.
   */
  streaming?: boolean;

  /**
   * True when this assistant message contains a generated resume, so the
   * bubble can offer a "下载 PDF" affordance even if the model never called
   * export_resume_pdf.
   */
  isResume?: boolean;

  /**
   * PDF payload pushed by the backend (pdf_ready event). Present after the
   * agent calls export_resume_pdf; lets the button download with no extra
   * round trip.
   */
  pdf?: PdfPayload;

  /**
   * 简历原文（resume_ready 带下来的 Markdown）。
   * 换模板重排 PDF 时用它，避免把模型后面补的说明文字也排进简历。
   */
  resumeMarkdown?: string;

  /**
   * 岗位匹配结果（jobs_ready 事件）。
   * 卡片式渲染，带原岗位链接和平台实时搜索入口。
   */
  jobs?: JobCard[];
  /** 匹配到的岗位总数（卡片只展示前几条）。 */
  jobsTotal?: number;

  /**
   * 待补充问题清单（followups_ready 事件）。
   * 模型生成/润色简历后提交，前端弹窗逐条收集，用户填完自动回填。
   */
  followups?: string[];
}

/** 平台实时搜索链接（如 BOSS直聘 · 数据分析 · 深圳） */
export interface JobSearchLink {
  site: string;
  url: string;
}

export interface JobCard {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  /** 原岗位详情页（抓取时的快照链接，可能已下线） */
  url?: string;
  source?: string;
  match_score?: number;
  matched_requirements?: string[];
  missing_requirements?: string[];
  search_urls?: JobSearchLink[];
}

export interface PdfPayload {
  filename: string;
  /** Base64 of the raw PDF bytes (no data: prefix). */
  base64: string;
  size?: number;
  /** 生成这份 PDF 用的模板 id，换模板时据此判断能否复用字节。 */
  template?: string;
}

/**
 * 用户上传的已有简历（已解析成纯文本）。
 * 只存在前端内存里，随消息一起发给后端；后端不落盘。
 */
export interface ResumeAttachment {
  /** 原始文件名，例如 陈静-简历.pdf */
  name: string;
  /** 解析出的纯文本正文 */
  text: string;
  /** 正文字数 */
  chars: number;
  /** PDF 页数（非 PDF 时为空） */
  pages?: number;
}

export interface ToolLampState {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  animKey: number;   // Incremented on each activation to remount and replay animation
}

/**
 * Lightweight summary of a conversation, returned by /conversations.
 * Used to render the left sidebar — does NOT contain full message content.
 */
export interface ConversationSummary {
  id: string;
  title: string;
  preview?: string;
  lastMessageAt?: number;
  createdAt?: number;
  userId?: string;
  messageCount?: number;
}

export interface ListConversationsParams {
  userId: string;
  limit?: number;
  order?: 'asc' | 'desc';
  after?: string;
  before?: string;
}

export interface ListConversationsResponse {
  conversations: ConversationSummary[];
  nextCursor?: string;
  previousCursor?: string;
}
