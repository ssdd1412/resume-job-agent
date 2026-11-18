import { memo, useEffect, useRef, useState } from 'react';
import type { Message, PdfPayload, JobCard } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useT } from '../i18n';
import type { MessageKeys } from '../i18n';
import { exportResumePdf } from '../api';
import { downloadPdf } from '../lib/downloadPdf';
import { foldResumeSource } from '../lib/resumeAttachment';
import {
  RESUME_TEMPLATES,
  DEFAULT_TEMPLATE,
  loadTemplate,
  saveTemplate,
} from '../lib/resumeTemplates';
import TemplateThumb from './TemplateThumb';
import styles from './ChatBubble.module.css';

interface Props {
  message: Message;
  conversationId?: string;
}

/**
 * 岗位匹配卡片。
 *
 * 招聘库是抓取时的快照，原链接可能在用户点开前就下架了，所以每张卡都同时给
 * 「看原岗位」和三家平台的实时搜索入口 —— 后者永远指向当下在招的同类岗位。
 */
function JobBoard({ jobs, total }: { jobs: JobCard[]; total?: number }) {
  const { t } = useT();

  return (
    <div className={styles.jobs}>
      <div className={styles.jobsHead}>
        <strong>{t('jobs.title')}</strong>
        <span>{t('jobs.subtitle')}</span>
      </div>

      <ul className={styles.jobList}>
        {jobs.map((job, index) => {
          const score = typeof job.match_score === 'number' ? Math.round(job.match_score) : null;
          const meta = [job.company, job.location, job.salary].filter(Boolean).join(' · ');
          const gaps = (job.missing_requirements || []).slice(0, 4);

          return (
            <li key={`${job.title || 'job'}-${job.company || index}-${index}`} className={styles.jobItem}>
              <div className={styles.jobTop}>
                <span className={styles.jobTitle}>{job.title || '—'}</span>
                {score !== null && (
                  <span className={styles.jobScore} title={t('jobs.match')}>
                    <span className={styles.jobScoreBar} aria-hidden="true">
                      <span
                        className={styles.jobScoreFill}
                        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                      />
                    </span>
                    <span className={styles.jobScoreNum}>{score}%</span>
                  </span>
                )}
              </div>

              {meta && <div className={styles.jobMeta}>{meta}</div>}
              {gaps.length > 0 && (
                <div className={styles.jobGap}>
                  {t('jobs.missing')}: {gaps.join('、')}
                </div>
              )}

              <div className={styles.jobActions}>
                {job.url && (
                  <a
                    className={styles.jobBtn}
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('jobs.view')}
                  </a>
                )}
                {(job.search_urls || []).map((link) => (
                  <a
                    key={link.site}
                    className={`${styles.jobBtn} ${styles.jobBtnSearch}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.site}
                  </a>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {!!total && total > jobs.length && (
        <div className={styles.jobsMore}>
          {total - jobs.length} {t('jobs.more')}
        </div>
      )}
    </div>
  );
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

const templateNameKey = (id: string) => `tpl.${id}` as MessageKeys;
const templateDescKey = (id: string) => `tpl.${id}.desc` as MessageKeys;

export default memo(function ChatBubble({ message, conversationId }: Props) {
  const { t, lang } = useT();
  const isUser = message.role === 'user';

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [template, setTemplate] = useState<string>(() => loadTemplate());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rendered, setRendered] = useState<PdfPayload | undefined>(message.pdf);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  // 后端新推下来的 PDF（pdf_ready）优先，它对应模型选的模板
  useEffect(() => {
    if (message.pdf) setRendered(message.pdf);
  }, [message.pdf]);

  // 点面板外面 / 按 Esc 收起模板选择器
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  if (!isUser && !message.content) return null;

  // 刷新页面后从 /history 恢复的消息没有 isResume 标记，
  // 用简历的固定结构特征兜底识别，保证历史消息也能下载 PDF。
  const looksLikeResume =
    !isUser &&
    /^#\s+\S+/m.test(message.content) &&
    /##\s*(个人简介|专业技能|教育背景|工作经历|项目经历|技能|经历)/.test(message.content);

  const canDownloadPdf =
    !isUser && (message.isResume || !!message.pdf || looksLikeResume) && !message.streaming;

  /** 换模板只能重排简历本体：优先用 resume_ready 带下来的原文。 */
  const resumeSource = message.resumeMarkdown || message.content;

  const renderPdf = async (templateId: string): Promise<PdfPayload | null> => {
    setPdfError(null);
    try {
      const pdf = await exportResumePdf(resumeSource, undefined, templateId, conversationId);
      setRendered(pdf);
      return pdf;
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const handleDownloadPdf = async () => {
    // 已经为当前模板渲染过就直接用字节，避免二次请求
    const cached =
      rendered?.base64 && (rendered.template ?? DEFAULT_TEMPLATE) === template
        ? rendered
        : undefined;
    if (cached) {
      downloadPdf(cached);
      return;
    }
    setPdfBusy(true);
    const pdf = await renderPdf(template);
    if (pdf) downloadPdf(pdf);
    setPdfBusy(false);
  };

  const handlePickTemplate = async (templateId: string) => {
    setTemplate(templateId);
    saveTemplate(templateId);
    setPickerOpen(false);
    // 选完立刻按新样式重排并下载，省掉“再点一次下载”的一步
    const cached =
      rendered?.base64 && (rendered.template ?? DEFAULT_TEMPLATE) === templateId
        ? rendered
        : undefined;
    if (cached) {
      downloadPdf(cached);
      return;
    }
    setPdfBusy(true);
    const pdf = await renderPdf(templateId);
    if (pdf) downloadPdf(pdf);
    setPdfBusy(false);
  };

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.botRow}`}>
      {!isUser && <div className={styles.avatar}>⬡</div>}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
        {isUser ? (
          // 上传简历时后端存的是带原文的整段消息，气泡里折回一行附件说明
          foldResumeSource(message.content)
        ) : (
          <div className={`${styles.markdown} ${message.streaming ? styles.markdownStreaming : ''}`}>
            <Markdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(message.content)}</Markdown>
          </div>
        )}

        {canDownloadPdf && (
          <>
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

              <button
                type="button"
                ref={toggleRef}
                className={`${styles.tplBtn} ${pickerOpen ? styles.tplBtnOpen : ''}`}
                onClick={() => setPickerOpen((open) => !open)}
                disabled={pdfBusy}
                aria-expanded={pickerOpen}
                aria-haspopup="true"
                title={t('pdf.templateHint')}
              >
                <span aria-hidden="true">🎨</span>
                <span className={styles.tplBtnLabel}>{t(templateNameKey(template))}</span>
                <span className={styles.tplCaret} aria-hidden="true">
                  {pickerOpen ? '▲' : '▼'}
                </span>
              </button>

              {rendered?.size ? (
                <span className={styles.pdfMeta}>
                  {rendered.filename} · {Math.max(1, Math.round(rendered.size / 1024))} KB
                </span>
              ) : null}
              {pdfError && <span className={styles.pdfErr}>{t('pdf.failed')}: {pdfError}</span>}
            </div>

            {pickerOpen && (
              <div className={styles.tplPanel} role="dialog" aria-label={t('pdf.templateTitle')} ref={panelRef}>
                <div className={styles.tplPanelHead}>
                  <strong>{t('pdf.templateTitle')}</strong>
                  <span>{t('pdf.templateHint')}</span>
                </div>
                <div className={styles.tplGrid}>
                  {RESUME_TEMPLATES.map((item) => {
                    const active = item.id === template;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.tplItem} ${active ? styles.tplItemActive : ''}`}
                        onClick={() => handlePickTemplate(item.id)}
                        disabled={pdfBusy}
                        aria-pressed={active}
                      >
                        <TemplateThumb
                          id={item.id}
                          accent={item.accent}
                          layout={item.layout}
                          className={styles.tplThumb}
                        />
                        <span className={styles.tplName}>{t(templateNameKey(item.id))}</span>
                        <span className={styles.tplDesc}>{t(templateDescKey(item.id))}</span>
                        {active && (
                          <span className={styles.tplCheck} aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className={styles.tplFoot}>{t('pdf.templateFoot')}</p>
              </div>
            )}
          </>
        )}

        {!isUser && message.jobs && message.jobs.length > 0 && (
          <JobBoard jobs={message.jobs} total={message.jobsTotal} />
        )}

        <span className={styles.time}>
          {new Date(message.timestamp).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isUser && <div className={`${styles.avatar} ${styles.userAvatar}`}>U</div>}
    </div>
  );
});
