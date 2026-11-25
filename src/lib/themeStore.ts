/**
 * Theme store — accent color + light/dark mode.
 *
 * Persists choices in localStorage and reflects them as data-accent / data-mode
 * attributes on <html>, which index.css uses to swap the full token set.
 * No React dependency so it can be applied immediately at module load.
 */

export type Accent = 'gold' | 'blue' | 'purple' | 'green' | 'pink';
export type Mode = 'dark' | 'light';

const ACCENT_KEY = 'theme-accent';
const MODE_KEY = 'theme-mode';

export const ACCENTS: { id: Accent; swatch: string; labelKey: string }[] = [
  { id: 'gold', swatch: '#f5c842', labelKey: 'theme.gold' },
  { id: 'blue', swatch: '#5b8cff', labelKey: 'theme.blue' },
  { id: 'purple', swatch: '#a77afa', labelKey: 'theme.purple' },
  { id: 'green', swatch: '#3ed699', labelKey: 'theme.green' },
  { id: 'pink', swatch: '#f472b6', labelKey: 'theme.pink' },
];

export function readAccent(): Accent {
  const v = localStorage.getItem(ACCENT_KEY) as Accent | null;
  return v && ACCENTS.some(a => a.id === v) ? v : 'blue';
}

export function readMode(): Mode {
  const v = localStorage.getItem(MODE_KEY);
  if (v === 'light' || v === 'dark') return v;
  // Default to a clean light + blue look; users can still switch any time.
  return 'light';
}

export function applyAccent(accent: Accent) {
  document.documentElement.setAttribute('data-accent', accent);
  localStorage.setItem(ACCENT_KEY, accent);
}

export function applyMode(mode: Mode) {
  document.documentElement.setAttribute('data-mode', mode);
  localStorage.setItem(MODE_KEY, mode);
}

/** Apply the persisted theme as early as possible (called at module load). */
export function initTheme() {
  applyAccent(readAccent());
  applyMode(readMode());
}
