import { useState, useRef, useCallback, KeyboardEvent, DragEvent, ChangeEvent } from 'react';
import { useT, MessageKeys } from '../i18n';
import { parseResumeFile } from '../api';
import type { ResumeAttachment } from '../types';
import styles from './ChatInput.module.css';

interface Props {
  onSend: (text: string, attachment?: ResumeAttachment) => void;
  onStop: () => void;
  onClear: () => void;
  disabled: boolean;
}

const PRESET_KEYS = ['preset.1', 'preset.2', 'preset.3'] as const;

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown';

export default function ChatInput({ onSend, onStop, onClear, disabled }: Props) {
  const [value, setValue] = useState('');
  const [attachment, setAttachment] = useState<ResumeAttachment | null>(null);
  const [parsingName, setParsingName] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  const canSend = Boolean(value.trim() || attachment) && !disabled && !parsingName;

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && !attachment) || disabled || parsingName) return;
    onSend(trimmed, attachment ?? undefined);
    setValue('');
    setAttachment(null);
    setAttachError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, attachment, disabled, parsingName, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handlePreset = (text: string) => {
    if (disabled) return;
    onSend(text);
  };

  /** 选中/拖入文件后立刻解析，解析结果以 chip 形式挂在输入框上方。 */
  const ingestFile = useCallback(async (file: File | undefined | null) => {
    if (!file || disabled) return;
    setAttachError(null);
    setParsingName(file.name);
    try {
      const parsed = await parseResumeFile(file);
      setAttachment(parsed);
      // 用户没写要求时预填一句，省得他再想怎么开口
      setValue(prev => (prev.trim() ? prev : t('attach.defaultPrompt')));
    } catch (e) {
      setAttachment(null);
      setAttachError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsingName(null);
    }
  }, [disabled, t]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空 input，否则连续选同一个文件不会再触发 change
    e.target.value = '';
    void ingestFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void ingestFile(e.dataTransfer?.files?.[0]);
  };

  return (
    <div
      className={`${styles.bar} ${dragging ? styles.barDragging : ''}`}
      onDragOver={e => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className={styles.presets}>
        {PRESET_KEYS.map(key => (
          <button
            key={key}
            className={styles.presetChip}
            onClick={() => handlePreset(t(key as MessageKeys))}
            disabled={disabled}
          >
            {t(key as MessageKeys)}
          </button>
        ))}
      </div>

      {attachment && (
        <div className={styles.attachChip}>
          <span className={styles.attachIcon} aria-hidden="true">📄</span>
          <span className={styles.attachName}>{attachment.name}</span>
          <span className={styles.attachMeta}>
            {attachment.chars} 字
            {attachment.pages ? ` · ${attachment.pages} 页` : ''}
          </span>
          <button
            type="button"
            className={styles.attachRemove}
            onClick={() => {
              setAttachment(null);
              setAttachError(null);
            }}
            aria-label={t('attach.remove')}
            title={t('attach.remove')}
          >
            ×
          </button>
        </div>
      )}

      {parsingName && (
        <div className={`${styles.attachChip} ${styles.attachChipMuted}`}>
          <span className={styles.attachIcon} aria-hidden="true">⏳</span>
          <span className={styles.attachName}>{parsingName}</span>
          <span className={styles.attachMeta}>{t('attach.parsing')}</span>
        </div>
      )}

      {attachError && <div className={styles.attachError}>{t('attach.failed')}：{attachError}</div>}

      <div className={`${styles.inputWrap} ${disabled ? styles.inputDisabled : ''}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className={styles.fileInput}
          onChange={handleFileChange}
          tabIndex={-1}
        />
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || Boolean(parsingName)}
          aria-label={t('attach.button')}
          title={t('attach.hint')}
        >
          <svg viewBox="0 0 24 24" fill="none" width="17" height="17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={t('chat.placeholder')}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          disabled={disabled}
        />
        <button
          className={`${styles.sendBtn} ${!canSend ? styles.sendDisabled : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          aria-label={t('aria.send')}
        >
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M3 10L17 3l-4 7 4 7L3 10z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={styles.clearBtn}
          onClick={onClear}
          disabled={disabled}
          aria-label={t("aria.clearHistory")}
          title={t("aria.clearHistory")}
        >
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
        {disabled && (
          <button
            className={styles.stopBtn}
            onClick={onStop}
            aria-label={t("aria.stopGeneration")}
            title={t("aria.stopGeneration")}
          >
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>
      <p className={styles.hint}>{t('chat.hint')}</p>
    </div>
  );
}
