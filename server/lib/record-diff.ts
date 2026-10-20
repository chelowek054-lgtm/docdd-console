import { parseMapRecord, type Vision } from './maps';
import { parseRecord } from './parse';

/**
 * Разница «было → станет» для записи на подтверждении (R-0068, R-0070, R-0071).
 * Чистые функции над строками: git и файлы живут в utils, чтобы это тестировалось
 * без окружения.
 */

export interface LineChange { kind: 'same' | 'add' | 'del'; text: string }
export interface FieldChange { field: string; before: string; after: string }
export interface LinkChange { sign: '+' | '-'; kind: string; target: string }
export interface VisionChange { field: string; before: LineChange[]; after: LineChange[]; changed: boolean }

export interface RecordDiff {
  id: string;
  type: string;
  /** `new` — базы нет (запись заводится впервые); `vision` — запись карты с вектором. */
  kind: 'text' | 'vision' | 'new';
  /** Откуда взято «было»: коммит или `null`. Своей базы снимков нет. */
  base: { commit: string; reason: 'approved' | 'previous' } | null;
  fields: FieldChange[];
  links: LinkChange[];
  text: LineChange[];
  vision?: { fields: VisionChange[]; touched: { id: string; title: string }[] };
  /** Разницы нет: с базой всё совпадает. */
  empty: boolean;
}

/** Построчная разница по наибольшей общей подпоследовательности. */
export function lineDiff(before: string, after: string): LineChange[] {
  const a = before === '' ? [] : before.split(/\r?\n/);
  const b = after === '' ? [] : after.split(/\r?\n/);
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: LineChange[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i]! }); i += 1; j += 1; }
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) { out.push({ kind: 'del', text: a[i]! }); i += 1; }
    else { out.push({ kind: 'add', text: b[j]! }); j += 1; }
  }
  for (; i < a.length; i += 1) out.push({ kind: 'del', text: a[i]! });
  for (; j < b.length; j += 1) out.push({ kind: 'add', text: b[j]! });
  return out;
}

const show = (value: unknown): string =>
  value === undefined || value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value);

/** Поля front matter без связей и дат правки: связи показываются отдельно, `updated` — шум. */
function fieldDiff(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((name) => name !== 'links' && name !== 'updated');
  return names
    .map((field) => ({ field, before: show(before[field]), after: show(after[field]) }))
    .filter((item) => item.before !== item.after);
}

function linkPairs(data: Record<string, unknown>): Set<string> {
  const links = data['links'];
  const set = new Set<string>();
  if (links && typeof links === 'object') {
    for (const [kind, value] of Object.entries(links as Record<string, unknown>)) {
      for (const target of Array.isArray(value) ? value : [value]) set.add(`${kind}\u0000${String(target)}`);
    }
  }
  return set;
}

function linkDiff(before: Record<string, unknown>, after: Record<string, unknown>): LinkChange[] {
  const was = linkPairs(before);
  const now = linkPairs(after);
  const split = (pair: string) => pair.split('\u0000') as [string, string];
  return [
    ...[...now].filter((pair) => !was.has(pair)).map((pair) => ({ sign: '+' as const, kind: split(pair)[0], target: split(pair)[1] })),
    ...[...was].filter((pair) => !now.has(pair)).map((pair) => ({ sign: '-' as const, kind: split(pair)[0], target: split(pair)[1] }))
  ];
}

const VISION_FIELDS: { key: keyof Vision; label: string }[] = [
  { key: 'problem', label: 'Проблема' },
  { key: 'audience', label: 'Для кого' },
  { key: 'outcome', label: 'Успех' },
  { key: 'not', label: 'Чего не делает' }
];

/** Слова от пяти букв: грубо, но достаточно, чтобы назвать задетые возможности. */
const words = (text: string): string[] => (text.toLowerCase().match(/[\p{L}]{5,}/gu) ?? []).map((word) => word.slice(0, 5));

export function visionDiff(
  before: Vision | undefined,
  after: Vision,
  capabilities: readonly { id: string; title?: string; summary?: string }[]
): NonNullable<RecordDiff['vision']> {
  const fields = VISION_FIELDS.map(({ key, label }) => {
    const lines = lineDiff(before?.[key] ?? '', after[key] ?? '');
    return {
      field: label,
      before: lines.filter((line) => line.kind !== 'add'),
      after: lines.filter((line) => line.kind !== 'del'),
      changed: lines.some((line) => line.kind !== 'same')
    };
  });
  const changedWords = new Set(
    fields.flatMap((item, index) => (item.changed ? words(`${before?.[VISION_FIELDS[index]!.key] ?? ''} ${after[VISION_FIELDS[index]!.key] ?? ''}`) : []))
  );
  const touched = capabilities
    .filter((cap) => words(`${cap.title ?? ''} ${cap.summary ?? ''}`).some((word) => changedWords.has(word)))
    .map((cap) => ({ id: cap.id, title: cap.title ?? cap.id }));
  return { fields, touched };
}

/**
 * Разница двух версий файла записи. `baseText` — `null`, когда сравнивать не с чем.
 */
export function diffRecordTexts(
  id: string,
  type: string,
  baseText: string | null,
  currentText: string,
  capabilities: readonly { id: string; title?: string; summary?: string }[] = []
): Omit<RecordDiff, 'base'> {
  const now = parseRecord(currentText, { path: id });
  const was = baseText === null ? null : parseRecord(baseText, { path: id });
  const nowData = now.ok ? now.record.data : {};
  const nowBody = now.ok ? now.record.body : currentText;
  const wasData = was?.ok ? was.record.data : {};
  const wasBody = was?.ok ? was.record.body : (baseText ?? '');

  const text = lineDiff(wasBody, nowBody);
  const fields = fieldDiff(wasData, nowData);
  const links = linkDiff(wasData, nowData);

  let vision: RecordDiff['vision'];
  if (type === 'map') {
    const next = parseMapRecord(nowBody).change.functional?.added?.vision;
    if (next) vision = visionDiff(parseMapRecord(wasBody).change.functional?.added?.vision, next, capabilities);
  }

  const empty = text.every((line) => line.kind === 'same') && fields.length === 0 && links.length === 0;
  return { id, type, kind: baseText === null ? 'new' : vision ? 'vision' : 'text', fields, links, text, ...(vision ? { vision } : {}), empty };
}
