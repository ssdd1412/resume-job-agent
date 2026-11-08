/**
 * 简历附件的消息包装与折叠
 *
 * 上传的简历原文会整段发给后端（模型必须看到全文才能润色），但界面上不该
 * 把几千字铺在气泡里。所以约定一对标记：
 *   - 发给后端：要求 + 文件名 + <<<RESUME_SOURCE>>> 原文 <<<END_RESUME_SOURCE>>>
 *   - 界面展示：要求 + 一行「📎 文件名 · N 字（已折叠）」
 * 刷新后从 /history 恢复的是带原文的完整消息，ChatBubble 用 foldResumeSource
 * 折回同一行，两种来源的观感保持一致。
 */

import type { ResumeAttachment } from '../types';

export const RESUME_SOURCE_START = '<<<RESUME_SOURCE>>>';
export const RESUME_SOURCE_END = '<<<END_RESUME_SOURCE>>>';

const DEFAULT_INSTRUCTION = '请帮我修改润色这份简历。';
const NAME_PREFIX = '文件名：';

/** 拼成一条发给后端的消息。 */
export function buildResumePrompt(instruction: string, att: ResumeAttachment): string {
  const ask = instruction.trim() || DEFAULT_INSTRUCTION;
  return [
    ask,
    `${NAME_PREFIX}${att.name}`,
    RESUME_SOURCE_START,
    att.text,
    RESUME_SOURCE_END,
  ].join('\n');
}

/** 界面上展示的用户消息：不铺原文，只留一行附件说明。 */
export function attachmentDisplayText(instruction: string, att: ResumeAttachment): string {
  const ask = instruction.trim() || DEFAULT_INSTRUCTION;
  return `${ask}\n\n📎 ${att.name} · ${att.chars} 字（简历原文已折叠）`;
}

/** 历史消息里带着原文，渲染时折叠回一行。 */
export function foldResumeSource(content: string): string {
  const start = content.indexOf(RESUME_SOURCE_START);
  if (start < 0) return content;

  const end = content.indexOf(RESUME_SOURCE_END, start);
  const inner = end > start ? content.slice(start + RESUME_SOURCE_START.length, end).trim() : '';

  const headLines = content.slice(0, start).trim().split('\n');
  const nameLine = headLines.find(line => line.startsWith(NAME_PREFIX));
  const name = nameLine ? nameLine.slice(NAME_PREFIX.length).trim() : '简历文件';
  const head = headLines.filter(line => line !== nameLine).join('\n').trim();

  return `${head}\n\n📎 ${name} · ${inner.length} 字（简历原文已折叠）`;
}
