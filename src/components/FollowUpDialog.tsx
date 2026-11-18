import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import styles from './FollowUpDialog.module.css';

interface Props {
  questions: string[];
  busy: boolean;
  onSkip: () => void;
  onSubmit: (answers: string[]) => void;
}

/**
 * 待补充信息弹窗。
 *
 * 模型生成/润色简历后，把缺的信息以问句清单下发（followups_ready），
 * 这里逐条收集。用户填完点提交 → 自动回填成一条消息让 agent 更新简历；
 * 不想填就跳过，不影响已生成的简历。
 */
export default function FollowUpDialog({ questions, busy, onSkip, onSubmit }: Props) {
  const { t } = useT();
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    setAnswers({});
  }, [questions]);

  const filledCount = useMemo(
    () => Object.values(answers).filter(v => v.trim()).length,
    [answers],
  );

  const handleSubmit = () => {
    if (busy || filledCount === 0) return;
    // 只提交填了的项，保留「问题 → 答案」对应关系，模型才知道补在哪
    const pairs = questions
      .map((q, i) => ({ q, a: (answers[i] || '').trim() }))
      .filter(x => x.a);
    onSubmit(pairs.map(x => `「${x.q}」${x.a}`));
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={e => {
      if (e.target === e.currentTarget) onSkip();
    }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('followup.title')}>
        <div className={styles.head}>
          <span className={styles.badge}>✎</span>
          <div>
            <h2 className={styles.title}>{t('followup.title')}</h2>
            <p className={styles.count}>{t('followup.count').replace('{n}', String(questions.length))}</p>
          </div>
        </div>

        <p className={styles.hint}>{t('followup.hint')}</p>

        <div className={styles.fields}>
          {questions.map((q, i) => (
            <label className={styles.field} key={`${i}-${q}`}>
              <span className={styles.question}>{i + 1}. {q}</span>
              <textarea
                className={styles.input}
                rows={2}
                value={answers[i] || ''}
                disabled={busy}
                placeholder={t('followup.placeholder')}
                onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.skip} onClick={onSkip} type="button">
            {t('followup.skip')}
          </button>
          <button
            className={styles.submit}
            onClick={handleSubmit}
            disabled={busy || filledCount === 0}
            type="button"
          >
            {busy ? t('followup.sending') : t('followup.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
