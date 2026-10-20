/**
 * Снимки историй и перенос компонента на стек (docs/16-design-system.md,
 * «Storybook как контракт», R-0056, R-0057). Снимки делает CI проекта, консоль
 * их только описывает; запрос «перенести компонент» — подстановка контракта,
 * историй и токенов стека в шаблон. Чистые функции: файлов не читают.
 */

import type { DesignComponent } from './design';
import { REFERENCE_STACK, type CatalogReport } from './design-catalog';

export const SNAPSHOT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

export const STORIES_MARKER = '<!-- ИСТОРИИ -->';
export const PORT_COMPONENT_MARKER = '<!-- КОМПОНЕНТ -->';
export const PORT_CONTRACT_MARKER = '<!-- КОНТРАКТ КОМПОНЕНТА -->';
export const PORT_TOKENS_MARKER = '<!-- ТОКЕНЫ СТЕКА -->';
export const PORT_NEIGHBORS_MARKER = '<!-- СОСЕДИ -->';
export const PORT_BRANCH_MARKER = '<!-- ВЕТКА -->';

/** Файл снимка истории: `<каталог>/<стек>/<id истории>.<расширение>`. */
export function snapshotPath(dir: string, stack: string, storyId: string, files: ReadonlySet<string>): string | null {
  const base = `${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/${stack}/${storyId}`;
  for (const extension of SNAPSHOT_EXTENSIONS) if (files.has(`${base}.${extension}`)) return `${base}.${extension}`;
  return null;
}

export interface StoryPair {
  component: string;
  item: string;
  stack: string;
  stackLabel: string;
  /** Эталон: снимок истории опорного Storybook; `null` — снимка нет. */
  reference: { story: string; shot: string | null };
  /** Снимок той же истории на стеке; `null` — нет. */
  port: { story: string; shot: string | null };
}

/**
 * Опись пар «эталон истории — снимок стека» по матрице. Пара есть для каждого
 * пункта, у которого есть история и в опорном каталоге, и на стеке; какой из
 * снимков отсутствует — видно в самой паре, чтобы запрос это сказал.
 */
export function storyPairs(report: CatalogReport, snapshotsDir: string, files: ReadonlySet<string>): StoryPair[] {
  const reference = report.columns.find((column) => column.stack === REFERENCE_STACK);
  if (!reference) return [];
  const pairs: StoryPair[] = [];
  for (const row of report.rows) {
    const base = row.cells.find((cell) => cell.stack === REFERENCE_STACK)?.stories[0];
    if (base === undefined) continue;
    for (const cell of row.cells) {
      const story = cell.stories[0];
      if (cell.stack === REFERENCE_STACK || story === undefined) continue;
      pairs.push({
        component: row.component,
        item: row.item,
        stack: cell.stack,
        stackLabel: report.columns.find((column) => column.stack === cell.stack)?.label ?? cell.stack,
        reference: { story: base, shot: snapshotPath(snapshotsDir, REFERENCE_STACK, base, files) },
        port: { story, shot: snapshotPath(snapshotsDir, cell.stack, story, files) }
      });
    }
  }
  return pairs;
}

export function storyPairLines(pairs: readonly StoryPair[]): string {
  if (pairs.length === 0) return 'Снимков историй нет: эту часть проверки пропусти одной строкой в выводе.';
  return pairs.map((pair) => {
    const ref = pair.reference.shot ? `\`${pair.reference.shot}\`` : 'эталона нет';
    const got = pair.port.shot ? `\`${pair.port.shot}\`` : 'снимка нет';
    return `- ${pair.component} · ${pair.item} · ${pair.stackLabel}: эталон ${ref} — снимок стека ${got}`;
  }).join('\n');
}

/** Подставляет опись пар в готовый запрос Pixel-Perfect; без метки в шаблоне запрос остаётся как есть. */
export function withStoryPairs(prompt: string, pairs: readonly StoryPair[]): string {
  return prompt.replace(STORIES_MARKER, () => storyPairLines(pairs));
}

/** Контракт компонента — текстом для модели: ровно то, что перенос обязан повторить. */
export function contractLines(component: DesignComponent): string {
  const out = [`Компонент: ${component.name}${component.summary ? ` — ${component.summary}` : ''}`];
  out.push(`Уровень: ${component.kind === 'composite' ? `составной, собран из ${(component.composedOf ?? []).join(', ') || 'не названо'}` : component.kind === 'base' ? 'базовый' : 'не заявлен'}`);
  if (component.variants?.length) out.push(`Варианты: ${component.variants.join(', ')}`);
  if (component.states?.length) out.push(`Состояния: ${component.states.join(', ')}`);
  if (component.parts?.length) out.push(`Слои: ${component.parts.join(', ')}`);
  if (component.props?.length) {
    out.push('Свойства:');
    for (const prop of component.props) {
      out.push(`- ${prop.name}: ${prop.type}${prop.default !== undefined ? `, по умолчанию ${prop.default}` : ''}${prop.values ? `, значения ${prop.values.join(' | ')}` : ''}${prop.required ? ', обязательное' : ''}`);
    }
  }
  if (component.slots?.length) out.push(`Слоты: ${component.slots.join(', ')}`);
  if (component.events?.length) out.push(`События: ${component.events.join(', ')}`);
  out.push(component.logic ? `Логика неотделима: ${component.logic}` : 'Бизнес-логики в контракте нет: не добавляй её.');
  return out.join('\n');
}

export interface PortInput {
  component: DesignComponent;
  stack: string;
  stackLabel: string;
  report: CatalogReport;
  /** Файлы выгрузки токенов стека: путь и текст. */
  tokenFiles: readonly { path: string; content: string }[];
  /** Все компоненты реестра: по ним ищутся уже перенесённые соседи. */
  components: readonly DesignComponent[];
  branch: string;
  snapshotsDir?: string;
  files?: ReadonlySet<string>;
}

const TOKEN_FILE_LIMIT = 6000;

/**
 * Запрос «перенести компонент на стек»: контракт, истории опорного каталога и
 * стека, токены стека и соседи, уже закрывшие свой контракт на этом стеке.
 */
export function portPrompt(template: string, input: PortInput): string {
  const { component, stack, report } = input;
  const body = template.replace(/^[\s\S]*?\r?\n---\r?\n/, '').trimStart();

  const mine = report.rows.filter((row) => row.component === component.name);
  const storyLines = mine.map((row) => {
    const ref = row.cells.find((cell) => cell.stack === REFERENCE_STACK)?.stories ?? [];
    const got = row.cells.find((cell) => cell.stack === stack)?.stories ?? [];
    const shots = (id: string | undefined, of: string): string => {
      const shot = id !== undefined && input.snapshotsDir && input.files ? snapshotPath(input.snapshotsDir, of, id, input.files) : null;
      return shot ? ` (снимок \`${shot}\`)` : '';
    };
    return `- ${row.item}: эталон ${ref.length ? `\`${ref[0]}\`${shots(ref[0], REFERENCE_STACK)}` : 'истории нет'}; на стеке ${got.length ? `\`${got[0]}\`${shots(got[0], stack)}` : 'не перенесено'}`;
  });

  const done = input.components.filter((other) => {
    if (other.name === component.name) return false;
    const rows = report.rows.filter((row) => row.component === other.name);
    return rows.length > 0 && rows.every((row) => (row.cells.find((cell) => cell.stack === stack)?.stories.length ?? 0) > 0);
  });

  const tokens = input.tokenFiles.map((file) =>
    `### \`${file.path}\`\n\n\`\`\`\n${file.content.length > TOKEN_FILE_LIMIT ? `${file.content.slice(0, TOKEN_FILE_LIMIT)}\n… (обрезано)` : file.content}\n\`\`\``).join('\n\n');

  return body
    .replace(PORT_COMPONENT_MARKER, () => `${component.name} → ${input.stackLabel} (\`${stack}\`)`)
    .replace(PORT_CONTRACT_MARKER, () => `${contractLines(component)}\n\nИстории:\n${storyLines.join('\n') || 'каталог историй не объявлен или компонента в нём нет.'}`)
    .replace(PORT_TOKENS_MARKER, () => tokens || 'Выгрузки токенов для этого стека нет.')
    .replace(PORT_NEIGHBORS_MARKER, () => done.length
      ? done.map((other) => `- ${other.name} (${other.kind ?? 'уровень не заявлен'})`).join('\n')
      : 'Перенесённых соседей на этом стеке пока нет: образцом служит только контракт.')
    .split(PORT_BRANCH_MARKER).join(input.branch);
}
