// Относительный путь, а не алиас Nuxt: этот модуль читает и тест, который
// собирается без Nuxt.
import type { IndexRecord, LinkKind } from '../../server/lib/types';

/**
 * Укладка графа по слоям (ADR-0006). Чистая функция: одни и те же записи дают
 * одну и ту же картинку, поэтому её видно тестом и она узнаваема при каждом
 * открытии.
 */

/** Колонки в порядке контракта: на что опираются — слева, чем проверяют — справа. */
const COLUMNS: readonly (readonly string[])[] = [
  ['requirement'],
  ['design', 'contract', 'decision'],
  ['task'],
  ['verification'],
  ['phase']
];

const COLUMN_TITLES = ['Требования', 'Документы и решения', 'Задачи', 'Проверки', 'Фазы'];

/**
 * Записи незнакомого типа собираются в последнюю колонку. Спрятать их значило бы
 * нарушить обещание контракта показывать такой файл как есть — а заодно тихо
 * убрать из графа то, о чём приложение уже сказало предупреждением.
 */
const OTHER_TITLE = 'Прочее';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 44;
const COLUMN_GAP = 90;
const ROW_GAP = 16;
const PADDING = 24;

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
  x: number;
  y: number;
  /** Узел, у которого нет ни одной связи ни в одну сторону. */
  dangling: boolean;
}

export interface GraphEdge {
  kind: LinkKind;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  columns: { title: string; x: number }[];
  width: number;
  height: number;
}

export function layoutGraph(records: readonly IndexRecord[]): GraphLayout {
  const ids = new Set(records.map((record) => record.id));
  const placed = new Map<string, GraphNode>();
  const columns: { title: string; x: number }[] = [];

  const known = new Set(COLUMNS.flat());
  const groups: { title: string; types: (record: IndexRecord) => boolean }[] = [
    ...COLUMNS.map((types, at) => ({
      title: COLUMN_TITLES[at] ?? '',
      types: (record: IndexRecord) => types.includes(record.type)
    })),
    { title: OTHER_TITLE, types: (record: IndexRecord) => !known.has(record.type) }
  ];

  let column = 0;
  let tallest = 0;

  for (const group of groups) {
    const inColumn = records
      .filter((record) => group.types(record))
      // Порядок внутри колонки — по идентификатору: он не зависит ни от чтения
      // папки, ни от порядка файлов в ней.
      .sort((a, b) => a.id.localeCompare(b.id));
    if (inColumn.length === 0) continue;

    const x = PADDING + column * (NODE_WIDTH + COLUMN_GAP);
    columns.push({ title: group.title, x });

    inColumn.forEach((record, row) => {
      const y = PADDING + 28 + row * (NODE_HEIGHT + ROW_GAP);
      placed.set(record.id, {
        id: record.id,
        title: record.title,
        type: record.type,
        status: record.status,
        x,
        y,
        dangling: isDangling(record, ids)
      });
      tallest = Math.max(tallest, y + NODE_HEIGHT);
    });

    column += 1;
  }

  const edges: GraphEdge[] = [];
  for (const record of records) {
    const from = placed.get(record.id);
    if (!from) continue;
    for (const [kind, ids] of Object.entries(record.links) as [LinkKind, string[]][]) {
      for (const id of ids) {
        const to = placed.get(id);
        // Ссылка в никуда рисоваться не может: о ней говорит link_broken.
        if (!to) continue;
        edges.push({
          kind,
          from: record.id,
          to: id,
          x1: from.x + (to.x >= from.x ? NODE_WIDTH : 0),
          y1: from.y + NODE_HEIGHT / 2,
          x2: to.x + (to.x >= from.x ? 0 : NODE_WIDTH),
          y2: to.y + NODE_HEIGHT / 2
        });
      }
    }
  }

  return {
    nodes: [...placed.values()],
    edges,
    columns,
    width: Math.max(PADDING * 2, columns.length * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP + PADDING * 2),
    height: tallest + PADDING
  };
}

/**
 * Висящий узел: ни одной связи ни от него, ни к нему. Именно их граф и должен
 * находить — запись, о которой все забыли.
 */
function isDangling(record: IndexRecord, known: ReadonlySet<string>): boolean {
  const outgoing = idsOf(record.links).filter((id) => known.has(id));
  return outgoing.length === 0 && idsOf(record.backlinks).length === 0;
}

function idsOf(links: IndexRecord['links'] | IndexRecord['backlinks']): string[] {
  return Object.values(links).flatMap((ids) => ids ?? []);
}

/** Цвет по типу, как обещано в 04-ui.md. Значения — токены Nuxt UI. */
export const TYPE_COLORS: Record<string, string> = {
  requirement: 'var(--ui-color-primary-500)',
  design: 'var(--ui-color-info-500)',
  contract: 'var(--ui-color-info-400)',
  decision: 'var(--ui-color-neutral-500)',
  task: 'var(--ui-color-warning-500)',
  verification: 'var(--ui-color-success-500)',
  phase: 'var(--ui-color-neutral-400)'
};

/**
 * Форма по статусу. Закрытое и подтверждённое — со срезанным углом, отменённое
 * — пунктиром: статус должен читаться, даже если цвет не различить.
 */
export function nodeShape(status: string): { rx: number; dashed: boolean; corner: boolean } {
  if (status === 'approved' || status === 'done') return { rx: 4, dashed: false, corner: true };
  if (status === 'dropped' || status === 'rejected' || status === 'superseded') {
    return { rx: 4, dashed: true, corner: false };
  }
  if (status === 'in_progress' || status === 'in_review' || status === 'review') {
    return { rx: 18, dashed: false, corner: false };
  }
  return { rx: 4, dashed: false, corner: false };
}
