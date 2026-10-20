/**
 * Каталог историй как контракт (docs/16-design-system.md, «Storybook как
 * контракт», R-0054, R-0055, R-0056). Консоль Storybook не запускает: читает
 * его выгрузку `index.json` (v5 `entries`, прежние v3/v4 `stories`) — у проекта
 * и у каждого стека, где её собирает CI (Storybook RN, Compose @Preview/Showkase,
 * SwiftUI Previews приводятся CI к тому же виду). Чистые функции над текстом и
 * объектами: ни файловой системы, ни Nuxt.
 *
 * Свойства истории читаются из необязательных `args`/`argTypes` записи: в
 * стандартном `index.json` их нет, их добавляет выгрузка проекта; нет — сверка
 * свойств молчит, а не придумывает расхождение.
 */

import type { DesignComponent } from './design';

/** Опорный каталог проекта (веб-Storybook), остальные — стеки из манифеста. */
export const REFERENCE_STACK = 'storybook';

export interface CatalogStory {
  id: string;
  /** Путь в дереве историй: `Components/Button`. */
  title: string;
  name: string;
  /** Последний сегмент `title`: имя компонента. */
  component: string;
  /** Имена свойств из `args`/`argTypes`; `null` — выгрузка их не несёт. */
  props: string[] | null;
}

export interface CatalogSource {
  /** `storybook` — опорный каталог; иначе id стека. */
  stack: string;
  label: string;
  /** Путь от корня проекта (как в манифесте). */
  path: string;
  /** Текст файла; `null` — файла нет. */
  text: string | null;
}

export type CatalogState = 'ok' | 'missing' | 'invalid';

export interface ParsedCatalog {
  state: CatalogState;
  stories: CatalogStory[];
  problem?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Нормализация имён: `Disabled`, `disabled`, `is-disabled` сравниваются как слова. */
function tokens(value: string): string[] {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9а-яё]+/).filter((part) => part !== '');
}
const squash = (value: string): string => tokens(value).join('');

function propNames(entry: Record<string, unknown>): string[] | null {
  const argTypes = entry['argTypes'];
  const args = entry['args'];
  const bag = isRecord(argTypes) ? argTypes : isRecord(args) ? args : null;
  return bag ? Object.keys(bag) : null;
}

export function parseCatalog(text: string | null): ParsedCatalog {
  if (text === null) return { state: 'missing', stories: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { state: 'invalid', stories: [], problem: 'не JSON' };
  }
  let bag: Record<string, unknown> | null = null;
  if (isRecord(raw)) {
    const entries = raw['entries'];
    const stories = raw['stories'];
    bag = isRecord(entries) ? entries : isRecord(stories) ? stories : null;
  }
  if (!bag) return { state: 'invalid', stories: [], problem: 'нет `entries` (Storybook 7+) или `stories` (прежние версии)' };

  const stories: CatalogStory[] = [];
  for (const [key, value] of Object.entries(bag)) {
    if (!isRecord(value)) continue;
    // Страницы документации в сверку не входят: это не вид компонента.
    if (value['type'] === 'docs') continue;
    const title = typeof value['title'] === 'string' ? value['title'] : typeof value['kind'] === 'string' ? value['kind'] : '';
    const name = typeof value['name'] === 'string' ? value['name'] : typeof value['story'] === 'string' ? value['story'] : '';
    if (title === '' || name === '') continue;
    stories.push({
      id: typeof value['id'] === 'string' ? value['id'] : key,
      title,
      name,
      component: title.split('/').pop() ?? title,
      props: propNames(value)
    });
  }
  return { state: 'ok', stories };
}

/** Путь каталога: файл `.json` как есть, иначе каталог выгрузки с `index.json`. */
export function catalogPath(declared: string): string {
  const clean = declared.replace(/\\/g, '/').replace(/\/+$/, '');
  return clean.toLowerCase().endsWith('.json') ? clean : `${clean}/index.json`;
}

/** Что компонент обязан показать: его варианты и состояния (без них — хотя бы одна история). */
export interface Expected {
  item: string;
  kind: 'variant' | 'state' | 'any';
}

export function expectedOf(component: DesignComponent): Expected[] {
  const items: Expected[] = [
    ...(component.variants ?? []).map((item) => ({ item, kind: 'variant' as const })),
    ...(component.states ?? []).map((item) => ({ item, kind: 'state' as const }))
  ];
  return items.length > 0 ? items : [{ item: component.name, kind: 'any' }];
}

/** История показывает пункт, если все слова пункта есть в её имени: `Outline Disabled` ⊇ `disabled`. */
export function storyShows(story: CatalogStory, expected: Expected): boolean {
  if (expected.kind === 'any') return true;
  const words = new Set(tokens(story.name));
  const need = tokens(expected.item);
  return need.length > 0 && need.every((word) => words.has(word));
}

export interface MatrixCell {
  stack: string;
  /** Идентификаторы историй, закрывающих пункт; пусто — пробел. */
  stories: string[];
}

export interface MatrixRow {
  component: string;
  item: string;
  kind: Expected['kind'];
  cells: MatrixCell[];
}

export type CatalogFindingCode = 'design_story_missing' | 'design_contract_drift';

export interface CatalogFinding {
  code: CatalogFindingCode;
  stack: string;
  component: string;
  message: string;
}

export interface CatalogColumn {
  stack: string;
  label: string;
  path: string;
  state: CatalogState;
  problem?: string;
  stories: number;
}

export interface CatalogReport {
  columns: CatalogColumn[];
  rows: MatrixRow[];
  findings: CatalogFinding[];
  /** Истории по компонентам и стекам: для карточки компонента. */
  storiesOf: Record<string, Record<string, CatalogStory[]>>;
}

/**
 * Сверка каталогов с контрактом: матрица «компонент × состояние (вариант) ×
 * стек», пробелы (`design_story_missing`) и расхождения (`design_contract_drift`).
 * Нет объявленных каталогов — нет и отчёта: сверка включается манифестом.
 */
export function buildCatalogReport(components: readonly DesignComponent[], sources: readonly CatalogSource[]): CatalogReport {
  const parsed = sources.map((source) => ({ source, catalog: parseCatalog(source.text) }));
  const findings: CatalogFinding[] = [];
  const storiesOf: CatalogReport['storiesOf'] = {};

  const columns: CatalogColumn[] = parsed.map(({ source, catalog }) => ({
    stack: source.stack,
    label: source.label,
    path: source.path,
    state: catalog.state,
    ...(catalog.problem ? { problem: catalog.problem } : {}),
    stories: catalog.stories.length
  }));

  for (const { source, catalog } of parsed) {
    if (catalog.state === 'ok') continue;
    const why = catalog.state === 'missing' ? 'файла нет (выгрузку кладёт CI проекта)' : `не разобрался: ${catalog.problem ?? 'неизвестная причина'}`;
    findings.push({ code: 'design_story_missing', stack: source.stack, component: '',
      message: `Каталог историй \`${source.path}\` (${source.label}): ${why}.` });
  }

  const rows: MatrixRow[] = [];
  for (const component of components) {
    const key = squash(component.name);
    const expected = expectedOf(component);
    const perStack = new Map<string, CatalogStory[]>();
    for (const { source, catalog } of parsed) {
      perStack.set(source.stack, catalog.stories.filter((story) => squash(story.component) === key));
    }
    storiesOf[component.name] = Object.fromEntries(perStack);

    for (const item of expected) {
      rows.push({
        component: component.name,
        item: item.item,
        kind: item.kind,
        cells: parsed.map(({ source }) => ({
          stack: source.stack,
          stories: (perStack.get(source.stack) ?? []).filter((story) => storyShows(story, item)).map((story) => story.id)
        }))
      });
    }

    for (const { source, catalog } of parsed) {
      if (catalog.state !== 'ok') continue;
      const mine = perStack.get(source.stack) ?? [];
      for (const item of expected) {
        if (mine.some((story) => storyShows(story, item))) continue;
        const what = item.kind === 'any' ? 'ни одной истории' : `нет истории для ${item.kind === 'variant' ? 'варианта' : 'состояния'} \`${item.item}\``;
        findings.push({ code: 'design_story_missing', stack: source.stack, component: component.name,
          message: `Компонент \`${component.name}\` на ${source.label}: ${what}.` });
      }

      // Свойства: только по выгрузке, которая их несёт.
      if (mine.some((story) => story.props !== null)) {
        const seen = new Set(mine.flatMap((story) => story.props ?? []));
        const declared = new Map((component.props ?? []).map((prop) => [prop.name, prop]));
        const extra = [...seen].filter((name) => !declared.has(name));
        const lacking = [...declared.values()].filter((prop) => prop.required === true && !seen.has(prop.name)).map((prop) => prop.name);
        if (extra.length > 0) {
          findings.push({ code: 'design_contract_drift', stack: source.stack, component: component.name,
            message: `Компонент \`${component.name}\` на ${source.label}: свойства вне контракта — ${extra.map((name) => `\`${name}\``).join(', ')}.` });
        }
        if (lacking.length > 0) {
          findings.push({ code: 'design_contract_drift', stack: source.stack, component: component.name,
            message: `Компонент \`${component.name}\` на ${source.label}: нет обязательных свойств контракта — ${lacking.map((name) => `\`${name}\``).join(', ')}.` });
        }
      }
    }
  }

  // История компонента, которого нет в реестре, — контракт отстал или история лишняя.
  const known = new Set(components.map((component) => squash(component.name)));
  for (const { source, catalog } of parsed) {
    const orphans = [...new Set(catalog.stories.map((story) => story.component).filter((name) => !known.has(squash(name))))];
    for (const name of orphans) {
      findings.push({ code: 'design_contract_drift', stack: source.stack, component: name,
        message: `На ${source.label} есть истории компонента \`${name}\`, а в реестре дизайна его нет.` });
    }
  }
  return { columns, rows, findings, storiesOf };
}

/** Каталоги из манифеста: опорный `design.catalog` и по одному на стек, где он назван. */
export function catalogSources(
  design: { catalog?: string | undefined; stacks?: readonly { id: string; catalog?: string | undefined }[] | undefined } | undefined,
  labels: Readonly<Record<string, string>>,
  read: (path: string) => string | null
): CatalogSource[] {
  const out: CatalogSource[] = [];
  const add = (stack: string, label: string, declared: string | undefined) => {
    if (!declared) return;
    const path = catalogPath(declared);
    // Путь за пределами корня не читаем: у него нет безопасного вида.
    const safe = !path.startsWith('/') && !/^[A-Za-z]:/.test(path) && !path.split('/').includes('..');
    out.push({ stack, label, path, text: safe ? read(path) : null });
  };
  add(REFERENCE_STACK, 'Storybook проекта', design?.catalog);
  for (const stack of design?.stacks ?? []) add(stack.id, labels[stack.id] ?? stack.id, stack.catalog);
  return out;
}
