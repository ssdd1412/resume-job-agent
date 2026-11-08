import { memo, useState } from 'react';
import type { Message } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useT } from '../i18n';
import { exportResumePdf } from '../api';
import { downloadPdf } from '../lib/downloadPdf';
import styles from './ChatBubble.module.css';

interface Props {
  message: Message;
}

/**
 * Some LLMs (especially fast/streaming tiers) emit Markdown tables as a
 * single squashed line — the `|` row boundaries arrive without the line
 * breaks GFM needs to recognise the block as a table. Result: react-markdown
 * just renders pipes as plain text.
 *
 * The two helpers below split a "| ... | | --- | --- | | a | b |" line back
 * into one row per line — but only when the second logical row is the
 * `| --- | --- |` separator (so this can't fire on prose that happens to
 * contain a pipe). Code fences are passed through verbatim so we don't
 * mangle inline shell snippets like `ls | grep foo`.
 */
const TABLE_ROW_BOUNDARY = /\|\s+\|/g;
const TABLE_SEPARATOR_ROW = /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function normalizeCompactTableLine(line: string): string {
  if (!line.includes('| |')) return line;

  const pipeIndexes = [...line.matchAll(/\|/g)]
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);

  for (const index of pipeIndexes) {
    const table = line.slice(index);
    const normalizedTable = table.replace(TABLE_ROW_BOUNDARY, '|\n|');
    const rows = normalizedTable
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length >= 2 && TABLE_SEPARATOR_ROW.test(rows[1])) {
      const prefix = line.slice(0, index).trimEnd();
      return prefix ? `${prefix}\n${normalizedTable}` : normalizedTable;
    }
  }

  return line;
}

function normalizeMarkdown(content: string): string {
  let inCodeFence = false;

  return content
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inCodeFence = !inCodeFence;
        return line;
      }

      return inCodeFence ? line : normalizeCompactTableLine(line);
    })
    .join('\n');
}

export default memo(function ChatBubble({ message }: Props) {
  const { t, lang } = useT();
  const isUser = message.role === 'user';

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!isUser && !message.content) return null;

  // 刷新页面后从 /history 恢复的消息没有 isResume 标记，
  // 用简历的固定结构特征兜底识别，保证历史消息也能下载 PDF。
  const looksLikeResume =
    !isUser &&
    /^#\s+\S+/m.test(message.content) &&
    /##\s*(个人简介|专业技能|教育背景|工作经历|项目经历|技能|经历)/.test(message.content);

  const canDownloadPdf =
    !isUser && (message.isResume || !!message.pdf || looksLikeResume) && !message.streaming;

  const handleDownloadPdf = async () => {
    // 优先用后端已经推下来的字节，避免二次生成
    if (message.pdf?.base64) {
      downloadPdf(message.pdf);
      return;
    }
    setPdfBusy(true);
    setPdfError(null);
    try {
      const pdf = await exportResumePdf(message.content);
      downloadPdf(pdf);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.botRow}`}>
      {!isUser && <div className={styles.avatar}>⬡</div>}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
        {isUser ? (
          message.content
        ) : (
          <div className={`${styles.markdown} ${message.streaming ? styles.markdownStreaming : ''}`}>
            <Markdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(message.content)}</Markdown>
          </div>
        )}

        {canDownloadPdf && (
          <div className={styles.pdfBar}>
            <button
              type="button"
              className={styles.pdfBtn}
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
            >
              <span aria-hidden="true">{pdfBusy ? '⏳' : '⬇'}</span>
              {pdfBusy ? t('pdf.generating') : t('pdf.download')}
            </button>
            {message.pdf?.size ? (
              <span className={styles.pdfMeta}>
                {message.pdf.filename} · {Math.max(1, Math.round(message.pdf.size / 1024))} KB
              </span>
            ) : null}
            {pdfError && <span className={styles.pdfErr}>{t('pdf.failed')}: {pdfError}</span>}
          </div>
        )}

        <span className={styles.time}>
          {new Date(message.timestamp).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isUser && <div className={`${styles.avatar} ${styles.userAvatar}`}>U</div>}
    </div>
  );
});
