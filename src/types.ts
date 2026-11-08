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
}

export interface PdfPayload {
  filename: string;
  /** Base64 of the raw PDF bytes (no data: prefix). */
  base64: string;
  size?: number;
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
