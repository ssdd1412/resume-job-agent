/**
 * Backend API (EdgeOne Makers)
 *
 * Route mapping (file → route):
 *   agents/chat/index.ts                         → POST /chat                  Main chat endpoint (SSE)
 *   agents/export-pdf/index.ts                   → POST /export-pdf           Resume Markdown → PDF (base64)
 *   agents/stop/index.ts                         → POST /stop                  Abort the active agent run
 *   cloud-functions/history/index.ts             → POST /history               Get conversation history
 *   cloud-functions/conversations/index.ts       → POST /conversations         List conversations for a user
 *   cloud-functions/clear-history/index.ts       → POST /clear-history         Clear messages of one conversation
 *   cloud-functions/delete-conversation/index.ts → POST /delete-conversation   Permanently delete a conversation
 *
 * This file defines all API paths and request wrappers.
 */

import type {
  Message,
  PdfPayload,
  ResumeAttachment,
  ListConversationsParams,
  ListConversationsResponse,
} from './types';

export const API = {
  chat: '/chat',
  chatStop: '/stop',                        // Abort the active agent run
  exportPdf: '/export-pdf',                 // Render resume Markdown → PDF (base64)
  parseResume: '/parse-resume',             // Uploaded PDF/DOCX/TXT → plain text
  history: '/history',                      // Get conversation history
  clearHistory: '/clear-history',           // Clear messages in a conversation
  conversations: '/conversations',          // List conversations for a user
  deleteConversation: '/delete-conversation', // Permanently delete a conversation
} as const;

export interface RawSseEvent {
  eventType: string;
  data: unknown;
  raw: string;
  timestamp: number;
}

export interface StreamCallbacks {
  onTextDelta: (delta: string) => void;
  onToolCalled: (toolName: string) => void;
  /** Backend injected a resume into this message (resume_ready). */
  onResumeReady?: () => void;
  /** Backend pushed a ready-to-download PDF (pdf_ready). */
  onPdfReady?: (pdf: PdfPayload) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  onRawEvent?: (event: RawSseEvent) => void;
}

/** Get conversation history for restoring the chat window after page refresh. */
export async function fetchConversationHistory(
  conversationId: string,
  userId?: string,
): Promise<Message[]> {
  const startTime = Date.now();
  console.log(`[History] Request start time: ${new Date(startTime).toLocaleString()}`);

  try {
    const res = await fetch(API.history, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
    });

    if (!res.ok) {
      const endTime = Date.now();
      console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
      console.log(`[History] Total time: ${endTime - startTime}ms`);
      return [];
    }

    const data = await res.json().catch(() => null) as { messages?: Message[] } | null;
    const endTime = Date.now();
    console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
    console.log(`[History] Total time: ${endTime - startTime}ms`);
    return Array.isArray(data?.messages) ? data.messages : [];
  } catch {
    const endTime = Date.now();
    console.log(`[History] Request end time: ${new Date(endTime).toLocaleString()}`);
    console.log(`[History] Total time: ${endTime - startTime}ms (aborted with error)`);
    return [];
  }
}

/**
 * Stream POST /chat via SSE
 * Backend pushes events: text_delta / tool_called / done / error
 *
 * Returns an AbortController the caller can use to abort (or pair with /chat/stop for graceful abort).
 */
export function sendMessageStream(
  message: string,
  callbacks: StreamCallbacks,
  conversationId?: string,
  options?: { userId?: string; userMsgId?: string; botMsgId?: string },
): AbortController {
  const ctrl = new AbortController();

  // 本轮是否已经产出过任何事件。用来判断连接断了能不能安全重试：
  // 已经吐出内容还重试的话，用户会看到重复的半截回答。
  let producedOutput = false;

  const requestOnce = async (): Promise<void> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (conversationId) {
      headers['makers-conversation-id'] = conversationId;
    }

    const res = await fetch(API.chat, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        // userId is camelCase here for parity with claude-agent-starter's
        // chat handler convention. The backend reads body.userId ?? body.user_id
        // to be tolerant of both.
        userId: options?.userId,
        userMsgId: options?.userMsgId,
        botMsgId: options?.botMsgId,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream not supported');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let doneReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE format: events separated by \n\n
      const parts = buffer.split('\n\n');
      // Last segment may be incomplete — keep in buffer
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;
        producedOutput = true;
        dispatchSseChunk(part, callbacks, () => { doneReceived = true; });
      }
    }

    // Fallback: trigger done only if backend did not send done event
    if (!doneReceived) {
      callbacks.onDone();
    }
  };

  (async () => {
    try {
      await requestOnce();
    } catch (err) {
      // AbortError does not trigger error callback
      if (err instanceof DOMException && err.name === 'AbortError') return;

      // 后端重启会让浏览器手里的 keep-alive 连接变成死连接，第一次请求可能
      // 直接就失败。此时还没有任何输出，换条新连接重试一次是安全的。
      if (!producedOutput && !ctrl.signal.aborted) {
        try {
          await requestOnce();
          return;
        } catch (retryErr) {
          if (retryErr instanceof DOMException && retryErr.name === 'AbortError') return;
          callbacks.onError(decorate(retryErr));
          return;
        }
      }

      callbacks.onError(decorate(err));
    }
  })();

  /** 把「请求发到哪儿、页面在哪儿」附在错误上，否则远端和本地环境很难区分。 */
  function decorate(err: unknown): Error {
    const base = err instanceof Error ? err : new Error(String(err));
    const target = `${window.location.origin}${API.chat}`;
    return new Error(`${base.message}（请求地址 ${target}）`);
  }

  return ctrl;
}

/**
 * 调试面板只需要知道「发生了一个 pdf_ready」，不需要把整份 PDF 的 Base64
 * 铺满屏幕。这里把字节字段换成体积摘要，其余字段原样保留。
 */
function stripHeavyPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.base64 !== 'string') return parsed;

  const { base64, ...rest } = obj;
  const bytes = Math.round((base64.length * 3) / 4);
  return { ...rest, base64: `<${bytes} bytes 二进制，已在调试面板省略>` };
}

/** Parse a single SSE event and dispatch to the corresponding callback */
function dispatchSseChunk(part: string, cb: StreamCallbacks, markDone: () => void): void {
  let eventType = '';
  let data = '';

  for (const line of part.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7);
    } else if (line.startsWith('data: ')) {
      data = line.slice(6);
    }
  }

  if (!eventType || !data) return;

  try {
    const parsed = JSON.parse(data);

    if (cb.onRawEvent) {
      cb.onRawEvent({
        eventType,
        data: stripHeavyPayload(parsed),
        raw: data.length > 400 ? `${data.slice(0, 400)}…（已截断，共 ${data.length} 字符）` : data,
        timestamp: Date.now(),
      });
    }

    switch (eventType) {
      case 'text_delta':
        cb.onTextDelta(parsed.delta);
        break;
      case 'tool_called':
        cb.onToolCalled(parsed.tool);
        break;
      case 'resume_ready':
        cb.onResumeReady?.();
        break;
      case 'pdf_ready':
        cb.onPdfReady?.({
          filename: parsed.filename || '简历.pdf',
          base64: parsed.base64 || '',
          size: parsed.size,
        });
        break;
      case 'error':
        cb.onError(new Error(parsed.message || 'agent returned error'));
        break;
      case 'done':
        markDone();
        cb.onDone();
        break;
    }
  } catch {
    if (cb.onRawEvent) {
      cb.onRawEvent({
        eventType,
        data: null,
        raw: data,
        timestamp: Date.now(),
      });
    }
  }
}

/**
 * Request the backend to abort the currently running agent
 *
 * Note: the stop request header must NOT carry the same conversation_id as chat,
 * otherwise the runtime will overwrite chat's cancel_event with stop's cancel_event,
 * causing abort_active_run to fail. The target conversation_id is passed only via body.
 */
export async function stopAgent(conversationId?: string): Promise<boolean> {
  try {
    /**
     * EdgeOne agents/ runtime requires Markers-Conversation-Id on every
     * agents/* request (since 2026-06-05 platform upgrade) — without it
     * the runtime returns 400 (`AGENT_CONVERSATION_ID_REQUIRED`) before
     * the handler runs.
     *
     * Earlier comments in this codebase warned that adding the header on
     * /stop would overwrite chat's abort signal slot. The new runtime is
     * expected to no longer have that bug; if you observe stop succeeding
     * but chat not actually aborting, revisit this and use a different
     * cancellation channel.
     */
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (conversationId) {
      headers['makers-conversation-id'] = conversationId;
    }
    const res = await fetch(API.chatStop, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Clear backend conversation history for the given conversation ID. */
export async function clearConversationHistory(
  conversationId?: string,
  userId?: string,
): Promise<boolean> {
  if (!conversationId) return false;

  try {
    const res = await fetch(API.clearHistory, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List conversations for the given user (eo-uuid).
 * Returns at most `limit` (default 20) conversations ordered by lastMessageAt desc by default.
 */
export async function listConversations(
  params: ListConversationsParams,
): Promise<ListConversationsResponse> {
  const startTime = performance.now();
  console.log(`[conversations] start: ${new Date().toISOString()}`);

  const empty: ListConversationsResponse = { conversations: [] };

  try {
    const res = await fetch(API.conversations, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: params.userId,
        limit: params.limit,
        order: params.order,
        after: params.after,
        before: params.before,
      }),
    });

    if (!res.ok) {
      console.warn(`[conversations] HTTP ${res.status}`);
      console.log(`[conversations] end: ${new Date().toISOString()}, total: ${(performance.now() - startTime).toFixed(2)}ms`);
      return empty;
    }

    const data = (await res.json().catch(() => null)) as ListConversationsResponse | null;
    console.log(`[conversations] end: ${new Date().toISOString()}, total: ${(performance.now() - startTime).toFixed(2)}ms, count=${data?.conversations?.length ?? 0}`);
    if (!data || !Array.isArray(data.conversations)) return empty;
    return {
      conversations: data.conversations,
      nextCursor: data.nextCursor,
      previousCursor: data.previousCursor,
    };
  } catch (e) {
    console.warn('[conversations] request failed:', e);
    return empty;
  }
}

/** Permanently delete a conversation (irreversible). */
export async function deleteConversation(
  conversationId: string,
  userId?: string,
): Promise<boolean> {
  if (!conversationId) return false;

  try {
    const res = await fetch(API.deleteConversation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Render resume Markdown into a PDF and return the base64 payload.
 *
 * Stateless: the backend rebuilds the PDF from the Markdown every call, so
 * this works even when the original agent run happened in another instance.
 */
export async function exportResumePdf(
  markdown: string,
  fileName?: string,
): Promise<PdfPayload> {
  const res = await fetch(API.exportPdf, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, file_name: fileName }),
  });

  const data = (await res.json().catch(() => null)) as
    | (PdfPayload & { ok?: boolean; error?: string })
    | null;

  if (!res.ok || !data?.base64) {
    throw new Error(data?.error || `导出失败（HTTP ${res.status}）`);
  }

  return {
    filename: data.filename || '简历.pdf',
    base64: data.base64,
    size: data.size,
  };
}

/** 上传上限，和 agents/resume_parser.py 的 MAX_BYTES 保持一致。 */
export const MAX_RESUME_FILE_BYTES = 10 * 1024 * 1024;

/** FileReader → 去掉 data URL 前缀的裸 Base64。 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('读取文件失败，请重试'));
    reader.readAsDataURL(file);
  });
}

/**
 * 把用户上传的 PDF / DOCX / TXT 简历解析成纯文本。
 *
 * 解析放在后端做（pypdf + 标准库 docx 解析），前端只负责读成 Base64，
 * 这样浏览器不需要引入几百 KB 的 PDF 解析库。
 */
export async function parseResumeFile(file: File): Promise<ResumeAttachment> {
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new Error(
      `文件 ${(file.size / 1024 / 1024).toFixed(1)}MB，超过 10MB 上限，请压缩后再上传`,
    );
  }

  const base64 = await fileToBase64(file);

  const res = await fetch(API.parseResume, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name, base64 }),
  });

  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; filename?: string; text?: string; chars?: number; pages?: number; error?: string }
    | null;

  if (!res.ok || !data?.ok || !data.text) {
    throw new Error(data?.error || `解析失败（HTTP ${res.status}）`);
  }

  return {
    name: data.filename || file.name,
    text: data.text,
    chars: data.chars ?? data.text.length,
    pages: data.pages,
  };
}
