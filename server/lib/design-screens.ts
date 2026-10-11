import type { DesignTokens } from './design';

/**
 * Проверка экранов моделью (docs/16-design-system.md, «Проверка экранов моделью»):
 * имена снимков, запросы Responsive и Pixel-Perfect, разбор ответа в находки. Чистые
 * функции: ни файловой системы, ни браузера — снимки уже сняты, сюда приходят их пути.
 */

export type FindingKind = 'responsive' | 'pixel';
export type Theme = 'light' | 'dark';

export const DEFAULT_VIEWPORTS: readonly number[] = [375, 768, 1280];
export const THEMES: readonly Theme[] = ['light', 'dark'];

export interface Snapshot {
  screen: string;
  viewport: number;
  theme: Theme;
  /** Путь от корня проекта. */
  path: string;
}

export interface Finding {
  screen: string;
  viewport: number | null;
  theme: Theme | null;
  kind: FindingKind;
  what: string;
}

/** Имя файла снимка: экран, ширина и тема в имени — опись не нужна, она читается с диска. */
export function snapshotFile(screen: string, viewport: number, theme: Theme): string {
  return `${screen.replace(/[^A-Za-z0-9._-]+/g, '_')}__${viewport}__${theme}.png`;
}

export function parseSnapshotFile(name: string): { screen: string; viewport: number; theme: Theme } | null {
  const match = /^(.+)__(\d+)__(light|dark)\.png$/.exec(name);
  if (!match) return null;
  return { screen: match[1] as string, viewport: Number(match[2]), theme: match[3] as Theme };
}

export const SNAPSHOTS_MARKER = '<!-- СНИМКИ -->';
export const TOKENS_MARKER = '<!-- ТОКЕНЫ -->';
export const REFS_MARKER = '<!-- МАКЕТЫ -->';

const LF = String.fromCharCode(10);

function withoutFrontNote(template: string): string {
  const match = /\r?\n---\r?\n/.exec(template);
  return match ? template.slice(match.index + match[0].length).trimStart() : template;
}

/** Токены в запрос — коротко, одним столбцом на тему: модель сверяет по ним, а не угадывает. */
export function tokensText(tokens: DesignTokens): string {
  const list = (record: Record<string, number | string>) => Object.entries(record).map(([key, value]) => `${key} ${value}`).join(', ');
  return [
    `Зона нажатия не меньше ${tokens.constraints.minTap}, контраст не ниже ${tokens.constraints.minContrast}:1, отступ по краю ${tokens.constraints.gutter}.`,
    `Кегли: ${list(tokens.typography)}.`,
    `Отступы: ${list(tokens.spacing)}.`,
    `Радиусы: ${list(tokens.radii)}.`,
    `Светлая тема: ${list(tokens.palette.light)}.`,
    `Тёмная тема: ${list(tokens.palette.dark)}.`,
    ...(tokens.components.length ? [`Компоненты: ${tokens.components.join(', ')}.`] : [])
  ].join(LF);
}

export interface DesignPromptInput {
  tokens: DesignTokens;
  snapshots: readonly Snapshot[];
  /** Эталонные макеты экранов: экран → путь от корня проекта. */
  refs?: Readonly<Record<string, string>>;
}

export function designPrompt(template: string, input: DesignPromptInput): string {
  const snapshots = input.snapshots.length
    ? input.snapshots.map((item) => `- ${item.screen} · ${item.viewport} · ${item.theme} — ${item.path}`).join(LF)
    : 'Снимков нет.';
  const refs = Object.entries(input.refs ?? {});
  return withoutFrontNote(template)
    .replace(TOKENS_MARKER, () => tokensText(input.tokens))
    .replace(SNAPSHOTS_MARKER, () => snapshots)
    .replace(REFS_MARKER, () => (refs.length ? refs.map(([screen, path]) => `- ${screen} — ${path}`).join(LF) : 'Эталонных макетов нет: сверяй только с токенами.'));
}

const BLOCK = /```docdd-design-findings\s*\n([\s\S]*?)```/;

export interface ParsedFindings {
  findings: Finding[];
  /** Что отброшено и почему: разбор молча не выдумывает. */
  problems: string[];
}

/**
 * Ответ модели в находки. Блока нет — `null`: экран покажет ответ текстом. Строка не из
 * известных экранов или без описания отбрасывается и называется.
 */
export function parseFindings(answer: string, knownScreens?: readonly string[]): ParsedFindings | null {
  const match = BLOCK.exec(answer);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch (error) {
    return { findings: [], problems: [`Блок \`docdd-design-findings\` не разобран: ${error instanceof Error ? error.message : String(error)}.`] };
  }
  const list = (parsed && typeof parsed === 'object' && Array.isArray((parsed as { findings?: unknown }).findings)
    ? (parsed as { findings: unknown[] }).findings
    : []);
  const findings: Finding[] = [];
  const problems: string[] = [];
  const known = knownScreens ? new Set(knownScreens) : null;
  list.forEach((item, at) => {
    const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const screen = typeof entry['screen'] === 'string' ? entry['screen'].trim() : '';
    const what = typeof entry['what'] === 'string' ? entry['what'].trim() : '';
    const kind = entry['kind'] === 'responsive' || entry['kind'] === 'pixel' ? entry['kind'] : null;
    if (!screen || !what || !kind) {
      problems.push(`Находка ${at + 1} отброшена: нужны \`screen\`, \`kind\` (responsive|pixel) и \`what\`.`);
      return;
    }
    if (known && !known.has(screen)) {
      problems.push(`Находка ${at + 1} отброшена: экрана \`${screen}\` нет среди проверяемых.`);
      return;
    }
    const viewport = typeof entry['viewport'] === 'number' ? entry['viewport'] : null;
    const theme = entry['theme'] === 'light' || entry['theme'] === 'dark' ? entry['theme'] : null;
    findings.push({ screen, viewport, theme, kind, what });
  });
  return { findings, problems };
}
