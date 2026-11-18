/**
 * 简历 PDF 模板清单（前端侧）。
 *
 * id 必须与后端 agents/resume_pdf.py 的 TEMPLATES 完全一致；
 * 后端对未知 id 会回退到 classic，所以这里的顺序/命名只影响展示。
 */
export type ResumeTemplateLayout = 'single' | 'sidebar';

export interface ResumeTemplate {
  id: string;
  /** 缩略图主色，和后端模板配色保持一致 */
  accent: string;
  layout: ResumeTemplateLayout;
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  { id: 'classic', accent: '#1f4e79', layout: 'single' },
  { id: 'minimal', accent: '#111827', layout: 'single' },
  { id: 'sidebar', accent: '#1e3a5f', layout: 'sidebar' },
  { id: 'academic', accent: '#334155', layout: 'single' },
  { id: 'campus', accent: '#0f766e', layout: 'single' },
];

export const DEFAULT_TEMPLATE = 'classic';

const STORAGE_KEY = 'resume.pdf.template';

export function isKnownTemplate(id: string | undefined | null): boolean {
  return !!id && RESUME_TEMPLATES.some(t => t.id === id);
}

/** 读取上次选中的模板（localStorage 不可用时静默回退）。 */
export function loadTemplate(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isKnownTemplate(saved) ? (saved as string) : DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function saveTemplate(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* 隐私模式下会抛异常，忽略即可 */
  }
}
