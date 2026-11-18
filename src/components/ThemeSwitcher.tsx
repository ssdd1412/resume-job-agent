import { useState, useRef, useEffect } from 'react';
import { useT, MessageKeys } from '../i18n';
import {
  ACCENTS, readAccent, readMode, applyAccent, applyMode,
  type Accent, type Mode,
} from '../lib/themeStore';
import styles from './ThemeSwitcher.module.css';

export default function ThemeSwitcher() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState<Accent>(() => readAccent());
  const [mode, setMode] = useState<Mode>(() => readMode());
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickAccent = (a: Accent) => { setAccent(a); applyAccent(a); };
  const pickMode = (m: Mode) => { setMode(m); applyMode(m); };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(v => !v)}
        title={t('theme.title' as MessageKeys)}
        aria-label={t('theme.title' as MessageKeys)}
      >
        <span className={styles.paletteIcon} aria-hidden>🎨</span>
        <span
          className={styles.swatchDot}
          style={{ background: 'var(--accent)' }}
          aria-hidden
        />
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('theme.accent' as MessageKeys)}</p>
            <div className={styles.swatches}>
              {ACCENTS.map(a => (
                <button
                  key={a.id}
                  className={`${styles.swatch} ${accent === a.id ? styles.swatchActive : ''}`}
                  style={{ '--swatch': a.swatch } as React.CSSProperties}
                  onClick={() => pickAccent(a.id)}
                  title={t(a.labelKey as MessageKeys)}
                  aria-label={t(a.labelKey as MessageKeys)}
                  aria-pressed={accent === a.id}
                >
                  {accent === a.id && <span className={styles.check}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('theme.mode' as MessageKeys)}</p>
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${mode === 'dark' ? styles.modeBtnActive : ''}`}
                onClick={() => pickMode('dark')}
                aria-pressed={mode === 'dark'}
              >
                <span className={styles.modeIcon} aria-hidden>🌙</span>
                <span>{t('theme.dark' as MessageKeys)}</span>
              </button>
              <button
                className={`${styles.modeBtn} ${mode === 'light' ? styles.modeBtnActive : ''}`}
                onClick={() => pickMode('light')}
                aria-pressed={mode === 'light'}
              >
                <span className={styles.modeIcon} aria-hidden>☀️</span>
                <span>{t('theme.light' as MessageKeys)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
