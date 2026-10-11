import { contrastRatio, paletteContrast, type BaseTheme } from './design';

/**
 * Конструктор тем (docs/16-design-system.md, «Цветовые темы»): чистые функции
 * под экран. Тема — это база (`light` или `dark`) и переопределённые роли;
 * конструктор показывает контраст по тем же правилам, что и проверка токенов
 * (`paletteContrast`), и отдаёт готовый блок `docdd-design` — черновик записи,
 * который человек подтверждает, как любой другой.
 */

export interface ThemeDraft {
  name: string;
  label: string;
  mode: BaseTheme;
  /** Порог контраста текста; `null` — общий 4.5. */
  minContrast: number | null;
  /** Роли, которые тема меняет; остальные берутся у базы. */
  overrides: Record<string, string>;
}

export const THEME_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const RESERVED = ['light', 'dark'];

/** Что мешает принять черновик темы: пусто — можно. */
export function themeProblems(draft: ThemeDraft, taken: readonly string[]): string[] {
  const problems: string[] = [];
  if (!THEME_NAME_PATTERN.test(draft.name)) problems.push('name');
  else if (RESERVED.includes(draft.name)) problems.push('reserved');
  else if (taken.includes(draft.name)) problems.push('taken');
  if (Object.keys(draft.overrides).length === 0) problems.push('empty');
  return problems;
}

/** Итоговая палитра: база и поверх неё переопределённые роли. */
export function themeResolved(base: Record<string, string>, draft: Pick<ThemeDraft, 'overrides'>): Record<string, string> {
  return { ...base, ...draft.overrides };
}

/** Строки контраста итоговой палитры — те же, что увидит проверка токенов. */
export function themeContrast(base: Record<string, string>, draft: ThemeDraft) {
  return paletteContrast(themeResolved(base, draft), draft.minContrast);
}

/**
 * Блок `docdd-design` для записи `design`: только роли, которые тема меняет.
 * Если цвет совпал с базой, он не попадает в блок — наследование делает своё.
 */
export function themeBlockText(base: Record<string, string>, draft: ThemeDraft): string {
  const palette = Object.fromEntries(
    Object.entries(draft.overrides).filter(([role, color]) => base[role] !== color).sort(([a], [b]) => a.localeCompare(b))
  );
  const block = {
    unit: 'rem',
    themes: {
      [draft.name]: {
        label: draft.label.trim() || draft.name,
        mode: draft.mode,
        ...(draft.minContrast !== null && draft.minContrast > 4.5 ? { minContrast: draft.minContrast } : {}),
        palette
      }
    }
  };
  return ['```docdd-design', JSON.stringify(block, null, 2), '```'].join('\n');
}

const hex = (value: number) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0').toUpperCase();

function mix(color: string, target: number, share: number): string {
  const channel = (at: number) => parseInt(color.slice(1 + at, 3 + at), 16);
  return `#${[0, 2, 4].map((at) => hex(channel(at) + (target - channel(at)) * share)).join('')}`;
}

/**
 * Ближайший цвет текста, который держит нужный контраст на фоне: цвет
 * сдвигается к белому на тёмном фоне и к чёрному на светлом, пока контраст не
 * дойдёт до порога. Подсказка для конструктора, а не решение за человека.
 */
export function suggestForeground(foreground: string, background: string, min: number): string {
  if (contrastRatio(foreground, background) >= min) return foreground;
  const channel = (at: number) => parseInt(background.slice(1 + at, 3 + at), 16);
  const lightBackground = 0.299 * channel(0) + 0.587 * channel(2) + 0.114 * channel(4) > 140;
  const target = lightBackground ? 0 : 255;
  for (let share = 0.04; share <= 1.0001; share += 0.04) {
    const candidate = mix(foreground, target, share);
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  return lightBackground ? '#000000' : '#FFFFFF';
}
