import { groupCard, groupModules, type DeclaredGroup, type GroupImport, type GroupModule } from './groups';

/**
 * Индекс справочника (docs/13-reference.md, ADR-0016): один короткий файл «что уже
 * есть» — модули проекта из подтверждённой карты кода и справки о внешних
 * решениях. Чистая функция: файлы читает и пишет вызывающая сторона. Текст
 * детерминирован (без даты сборки), поэтому сравнивается с файлом на диске
 * как есть.
 */

export interface ReferenceEntry {
  id: string;
  title: string;
  summary: string;
  kind: string;
  fetched: string;
  /** Путь к файлу справки от корня проекта. */
  path: string;
  /** Метка источника у справок из общих практик (`docdd`); у своих её нет. */
  label?: string | undefined;
}

export interface ReferenceIndex {
  text: string;
  /** Строк с содержанием (без заголовков): то, что ограничено пределом. */
  lines: number;
  /** Порты групп без описания: индекс по ним от дублей не защищает. */
  undescribedModules: number;
}

/** Больше строк индекс не вмещает: его целиком читает модель в каждом запросе. */
export const INDEX_LINE_LIMIT = 300;

const PRACTICE_KINDS = new Set(['technique', 'data']);

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export function buildReferenceIndex(input: {
  references: readonly ReferenceEntry[];
  modules: readonly GroupModule[];
  imports: readonly GroupImport[];
  groups?: readonly DeclaredGroup[];
}): ReferenceIndex {
  const sorted = [...input.references].sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '') || a.id.localeCompare(b.id));
  const solutions = sorted.filter((item) => !PRACTICE_KINDS.has(item.kind));
  const practices = sorted.filter((item) => PRACTICE_KINDS.has(item.kind));

  const referenceLine = (item: ReferenceEntry) => {
    const meta = [`${item.label ? `[${item.label}] ` : ''}${item.id}`, item.kind, item.fetched].filter(Boolean).join(', ');
    return `- **${clean(item.title)}** (${meta}) — ${clean(item.summary) || 'описания нет'} → ${item.path}`;
  };

  const grouping = groupModules(input.modules, input.imports, input.groups ?? []);
  const moduleBlocks: { header: string; lines: string[] }[] = [];
  let undescribed = 0;
  for (const group of grouping.groups) {
    const card = groupCard(grouping, group.id);
    const surface = card?.surface ?? [];
    if (surface.length === 0 && !group.summary) continue;
    const lines = surface.map((port) => {
      const member = group.members.find((item) => item.id === port.id);
      const summary = member?.summary ? clean(member.summary) : '';
      if (!summary) undescribed += 1;
      return `- \`${member?.path ?? port.id}\` — ${summary || 'описания нет'}`;
    });
    moduleBlocks.push({ header: `### ${group.title}${group.summary ? ` — ${clean(group.summary)}` : ''}`, lines });
  }

  const refLines = solutions.length + practices.length;
  let budget = Math.max(0, INDEX_LINE_LIMIT - refLines);
  let hidden = 0;
  const moduleOut: string[] = [];
  for (const block of moduleBlocks) {
    const room = Math.min(block.lines.length, budget);
    if (room === 0 && block.lines.length > 0) {
      hidden += block.lines.length;
      continue;
    }
    moduleOut.push(block.header, ...block.lines.slice(0, room));
    hidden += block.lines.length - room;
    budget -= room;
  }

  const out = [
    '# Справочник проекта',
    '',
    'Сгенерировано приложением, не править: источник — справки (S-…) и подтверждённая карта кода (docs/13-reference.md).',
    '',
    '## Модули проекта',
    'Что уже написано. Прежде чем заводить новое — посмотри, нет ли такого.',
    '',
    ...(moduleOut.length ? moduleOut : ['Пока ничего: карта кода не описана или не подтверждена.']),
    ...(hidden > 0 ? [`…и ещё ${hidden}: смотри карту кода.`] : []),
    '',
    '## Внешние решения',
    ...(solutions.length ? solutions.map(referenceLine) : ['Пока ничего.']),
    '',
    '## Приёмы и данные',
    ...(practices.length ? practices.map(referenceLine) : ['Пока ничего.']),
    ''
  ];

  return {
    text: out.join('\n'),
    lines: moduleOut.filter((line) => line.startsWith('- ')).length + refLines,
    undescribedModules: undescribed
  };
}

/** Тот же текст на диске и в сборке: перевод строк и хвост не считаются расхождением. */
export function sameIndex(a: string | null, b: string): boolean {
  return a !== null && a.replace(/\r\n/g, '\n').trim() === b.replace(/\r\n/g, '\n').trim();
}
