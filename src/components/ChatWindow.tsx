import { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { useT, MessageKeys } from '../i18n';
import ChatBubble from './ChatBubble';
import styles from './ChatWindow.module.css';

interface Props {
  messages: Message[];
  loading: boolean;
  conversationId?: string;
  /** Welcome-panel card click → send that prompt directly. */
  onQuickAsk: (text: string) => void;
}

/** Six capability cards shown on the empty welcome screen. */
const WELCOME_CARDS: { icon: string; titleKey: MessageKeys; descKey: MessageKeys; promptKey: MessageKeys }[] = [
  { icon: '📄', titleKey: 'welcome.c1.title', descKey: 'welcome.c1.desc', promptKey: 'preset.1' },
  { icon: '✨', titleKey: 'welcome.c2.title', descKey: 'welcome.c2.desc', promptKey: 'welcome.c2.prompt' },
  { icon: '🎯', titleKey: 'welcome.c3.title', descKey: 'welcome.c3.desc', promptKey: 'preset.2' },
  { icon: '💾', titleKey: 'welcome.c4.title', descKey: 'welcome.c4.desc', promptKey: 'welcome.c4.prompt' },
  { icon: '📤', titleKey: 'welcome.c5.title', descKey: 'welcome.c5.desc', promptKey: 'preset.3' },
  { icon: '🧠', titleKey: 'welcome.c6.title', descKey: 'welcome.c6.desc', promptKey: 'welcome.c6.prompt' },
];

const STATS: { valueKey: MessageKeys; subKey: MessageKeys }[] = [
  { valueKey: 'welcome.stat1', subKey: 'welcome.stat1sub' },
  { valueKey: 'welcome.stat2', subKey: 'welcome.stat2sub' },
  { valueKey: 'welcome.stat3', subKey: 'welcome.stat3sub' },
];

export default function ChatWindow({ messages, loading, conversationId, onQuickAsk }: Props) {
  const windowRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  useEffect(() => {
    if (messages.length === 0 && !loading) return;
    const el = windowRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const lastMsg = messages[messages.length - 1];
  /**
   * Three-dot typing row only fills the "waiting for first token" gap.
   * Once the assistant bubble has any content, the in-bubble streamingCaret
   * takes over the "still working" signal — so we never end up with two
   * stacked bot bubbles for the same in-flight turn.
   */
  const showTypingIndicator = loading && !(lastMsg?.role === 'assistant' && lastMsg.content.length > 0);

  return (
    <div ref={windowRef} className={styles.window}>
      {messages.length === 0 && (
        <div className={styles.welcome}>
          {/* Brand / hero */}
          <div className={styles.hero}>
            <div className={styles.heroMark} aria-hidden="true">
              <span>⬡</span>
            </div>
            <div className={styles.heroText}>
              <p className={styles.kicker}>
                <span className={styles.kickerDot} />{t('welcome.kicker')}
              </p>
              <h1 className={styles.heroTitle}>{t('empty.title')}</h1>
              <p className={styles.tagline}>{t('welcome.tagline')}</p>
            </div>
            <span className={styles.truthBadge}>✓ {t('welcome.truth')}</span>
          </div>

          {/* Stats strip */}
          <div className={styles.stats}>
            {STATS.map(s => (
              <div className={styles.stat} key={s.valueKey}>
                <span className={styles.statValue}>{t(s.valueKey)}</span>
                <span className={styles.statSub}>{t(s.subKey)}</span>
              </div>
            ))}
          </div>

          {/* Capability grid */}
          <p className={styles.sectionLabel}>
            <span className={styles.sectionRule} />
            {t('welcome.section')}
            <span className={styles.sectionRule} />
          </p>
          <div className={styles.cardGrid}>
            {WELCOME_CARDS.map((c, i) => (
              <button
                key={c.titleKey}
                type="button"
                className={styles.capCard}
                style={{ animationDelay: `${i * 45}ms` }}
                onClick={() => onQuickAsk(t(c.promptKey))}
                disabled={loading}
              >
                <span className={styles.capIcon} aria-hidden="true">{c.icon}</span>
                <span className={styles.capBody}>
                  <span className={styles.capTitle}>{t(c.titleKey)}</span>
                  <span className={styles.capDesc}>{t(c.descKey)}</span>
                </span>
                <span className={styles.capArrow} aria-hidden="true">→</span>
              </button>
            ))}
          </div>

          <p className={styles.welcomeFoot}>{t('welcome.foot')}</p>
        </div>
      )}

      {messages.map(msg => (
        <ChatBubble key={msg.id} message={msg} conversationId={conversationId} />
      ))}

      {showTypingIndicator && (
        <div className={styles.typingRow}>
          <div className={styles.avatar}>⬡</div>
          <div className={styles.typing}>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
