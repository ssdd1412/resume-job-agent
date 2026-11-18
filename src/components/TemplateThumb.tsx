/**
 * 简历模板缩略图。
 *
 * 用纯 SVG 画“一页纸”的抽象版式，让用户一眼看出差异
 * （页头居中还是左对齐、有没有侧栏、标题是下划线还是色块）。
 * 颜色与 agents/resume_pdf.py 里各模板的主色保持一致。
 */
import type { ResumeTemplateLayout } from '../lib/resumeTemplates';

const INK = '#334155';
const LINE = '#cbd5e1';
const FAINT = '#e2e8f0';

interface Props {
  id: string;
  accent: string;
  layout: ResumeTemplateLayout;
  className?: string;
}

function Single({ id, accent }: { id: string; accent: string }) {
  if (id === 'minimal') {
    return (
      <>
        <rect x="6" y="7" width="16" height="4.5" fill="#0f172a" />
        <rect x="6" y="14" width="21" height="1.4" fill="#9ca3af" />
        <rect x="6" y="18" width="36" height="0.6" fill="#111827" />
        <rect x="6" y="23" width="7" height="1.8" fill="#111827" />
        <rect x="6" y="27.4" width="33" height="1.3" fill={LINE} />
        <rect x="6" y="30.8" width="29" height="1.3" fill={LINE} />
        <rect x="6" y="34.2" width="32" height="1.3" fill={LINE} />
        <rect x="6" y="41" width="8" height="1.8" fill="#111827" />
        <rect x="6" y="45.4" width="33" height="1.3" fill={LINE} />
        <rect x="6" y="48.8" width="27" height="1.3" fill={LINE} />
      </>
    );
  }

  if (id === 'academic') {
    return (
      <>
        <rect x="15" y="6" width="18" height="4" fill="#0f172a" />
        <rect x="19" y="12" width="10" height="1.3" fill="#94a3b8" />
        <rect x="16" y="15.4" width="16" height="1.2" fill={LINE} />
        <rect x="6" y="19" width="36" height="0.8" fill={accent} />
        <rect x="6" y="21" width="36" height="0.4" fill="#94a3b8" />
        <rect x="17" y="25" width="14" height="1.8" fill={accent} />
        <rect x="6" y="28.2" width="36" height="0.4" fill={LINE} />
        <rect x="6" y="31.6" width="33" height="1.3" fill={LINE} />
        <rect x="6" y="35" width="29" height="1.3" fill={LINE} />
        <rect x="17" y="41.5" width="14" height="1.8" fill={accent} />
        <rect x="6" y="44.7" width="36" height="0.4" fill={LINE} />
        <rect x="6" y="48.1" width="33" height="1.3" fill={LINE} />
        <rect x="6" y="51.5" width="30" height="1.3" fill={LINE} />
      </>
    );
  }

  if (id === 'campus') {
    return (
      <>
        <rect x="0" y="0" width="48" height="16" fill="#ecfdf5" />
        <rect x="0" y="0" width="2" height="16" fill={accent} />
        <rect x="4.5" y="5" width="14" height="4" fill="#0f172a" />
        <rect x="4.5" y="11.5" width="10" height="1.3" fill={accent} />
        <rect x="6" y="20.5" width="36" height="5" fill="#ecfdf5" />
        <rect x="6" y="20.5" width="1.6" height="5" fill={accent} />
        <rect x="6" y="28.6" width="33" height="1.3" fill={LINE} />
        <rect x="6" y="32" width="29" height="1.3" fill={LINE} />
        <rect x="6" y="38" width="36" height="5" fill="#ecfdf5" />
        <rect x="6" y="38" width="1.6" height="5" fill={accent} />
        <rect x="6" y="46.1" width="33" height="1.3" fill={LINE} />
        <rect x="6" y="49.5" width="27" height="1.3" fill={LINE} />
      </>
    );
  }

  // classic（默认）
  return (
    <>
      <rect x="15" y="6" width="18" height="4" rx="0.6" fill={INK} />
      <rect x="17" y="12" width="14" height="1.5" fill="#93a9c0" />
      <rect x="16" y="15.4" width="16" height="1.2" fill="#b9c6d4" />
      <rect x="6" y="21" width="9" height="2" fill={accent} />
      <rect x="6" y="24.4" width="36" height="0.7" fill="#c9d7e5" />
      <rect x="6" y="27.4" width="34" height="1.3" fill={LINE} />
      <rect x="6" y="30.8" width="30" height="1.3" fill={LINE} />
      <rect x="6" y="34.2" width="33" height="1.3" fill={LINE} />
      <rect x="6" y="40.5" width="11" height="2" fill={accent} />
      <rect x="6" y="43.9" width="36" height="0.7" fill="#c9d7e5" />
      <rect x="6" y="46.9" width="33" height="1.3" fill={LINE} />
      <rect x="6" y="50.3" width="28" height="1.3" fill={LINE} />
    </>
  );
}

function Sidebar({ accent }: { accent: string }) {
  return (
    <>
      <rect x="0.5" y="0.5" width="15.5" height="61" rx="0.5" fill={accent} />
      <rect x="3" y="6" width="8" height="2.6" fill="#ffffff" />
      <rect x="3" y="11" width="6" height="1.2" fill="#b9cde0" />
      <rect x="3" y="14" width="9" height="1" fill="#8fabca" />
      <rect x="3" y="21" width="5.5" height="1.2" fill="#dbe7f3" />
      <rect x="3" y="24" width="10" height="0.5" fill="#4b6a8f" />
      <rect x="3" y="26.6" width="9.5" height="1" fill="#9db9d4" />
      <rect x="3" y="29.4" width="8" height="1" fill="#9db9d4" />
      <rect x="3" y="36" width="5" height="1.2" fill="#dbe7f3" />
      <rect x="3" y="39" width="10" height="0.5" fill="#4b6a8f" />
      <rect x="3" y="41.6" width="9" height="1" fill="#9db9d4" />
      <rect x="3" y="44.4" width="7" height="1" fill="#9db9d4" />

      <rect x="19" y="6" width="8" height="1.8" fill={accent} />
      <rect x="19" y="9.4" width="23" height="0.6" fill="#c9d7e5" />
      <rect x="19" y="12.6" width="21" height="1.1" fill={LINE} />
      <rect x="19" y="15.6" width="17" height="1.1" fill={LINE} />
      <rect x="19" y="21" width="10" height="1.8" fill={accent} />
      <rect x="19" y="24.4" width="23" height="0.6" fill="#c9d7e5" />
      <rect x="19" y="27.6" width="21" height="1.1" fill={LINE} />
      <rect x="19" y="30.6" width="18" height="1.1" fill={LINE} />
      <rect x="19" y="33.6" width="20" height="1.1" fill={LINE} />
      <rect x="19" y="39" width="9" height="1.8" fill={accent} />
      <rect x="19" y="42.4" width="23" height="0.6" fill="#c9d7e5" />
      <rect x="19" y="45.6" width="20" height="1.1" fill={LINE} />
      <rect x="19" y="48.6" width="16" height="1.1" fill={LINE} />
    </>
  );
}

export default function TemplateThumb({ id, accent, layout, className }: Props) {
  return (
    <svg viewBox="0 0 48 62" className={className} aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="47" height="61" rx="2" fill="#ffffff" stroke={FAINT} />
      {layout === 'sidebar' ? <Sidebar accent={accent} /> : <Single id={id} accent={accent} />}
    </svg>
  );
}
