/**
 * Подсветка синтаксиса для просмотра кода в карточке узла карты
 * (`MapInspector.vue`). Shiki — те же грамматики и темы, что в VS Code:
 * подсветка узнаваемая, стили инлайновые (свой CSS не нужен), тем две —
 * под светлый и тёмный интерфейс.
 *
 * Движок грузится динамически при первом обращении, как mermaid у диаграмм:
 * пока карточку не открыли, в бандл он не тянется.
 */

/** Один кусок строки: текст и цвет. `italic`/`bold` — если тема их задала. */
export interface CodeToken {
  content: string;
  color?: string;
  italic?: boolean;
  bold?: boolean;
}

/** Язык по расширению файла. Незнакомое — без подсветки (plain). */
const BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  vue: 'vue',
  py: 'python',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  css: 'css',
  html: 'html',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  toml: 'toml'
};

const LANGS = [...new Set(Object.values(BY_EXTENSION))];
const LIGHT = 'github-light';
const DARK = 'github-dark';

export function languageOf(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let highlighterPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function highlighter(): Promise<any> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((shiki) =>
      shiki.createHighlighter({ themes: [LIGHT, DARK], langs: LANGS })
    );
  }
  return highlighterPromise;
}

/**
 * Строки кода, разбитые на цветные токены. `dark` — какую из двух тем взять
 * (компонент решает по классу `dark` на `<html>`, как MermaidDiagram). Язык
 * не распознан или движок не осилил — возвращаем строки одним токеном без
 * цвета: показать код важнее, чем подсветить его.
 */
export async function highlightCode(
  code: string,
  path: string,
  dark: boolean
): Promise<CodeToken[][]> {
  const lang = languageOf(path);
  const plain = (): CodeToken[][] => code.split(/\r?\n/).map((line) => [{ content: line }]);
  if (!lang) return plain();

  try {
    const hl = await highlighter();
    const { tokens } = hl.codeToTokens(code, { lang, theme: dark ? DARK : LIGHT });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tokens as any[][]).map((line) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      line.map((token: any) => ({
        content: token.content,
        color: token.color,
        // fontStyle — битовая маска shiki: 1 italic, 2 bold.
        italic: (token.fontStyle & 1) === 1,
        bold: (token.fontStyle & 2) === 2
      }))
    );
  } catch {
    return plain();
  }
}
