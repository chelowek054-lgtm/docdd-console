import { validateCodemap, validateDataflow, validateFunctional, validateSkipped, validateUserflow } from './schema';

/**
 * Карты проекта (docs/07-maps.md). Разбор трёх структур из тела записи и
 * сверка свидетельств. Чистые функции: содержимое файлов кода передаётся
 * снаружи — приложение сверяет строки, а не разбирает синтаксис
 * (docs/adr/0007-maps-lead-code.md).
 */

export type MapStructure = 'codemap' | 'dataflow' | 'userflow' | 'functional';

export interface Evidence {
  path: string;
  line: number;
  fragment: string;
}

export interface CodemapPart {
  modules?: { id: string; title?: string; layer?: string }[];
  imports?: { from: string; to: string; evidence: Evidence }[];
}

export interface DataflowPart {
  sources?: { id: string; kind: string; where?: string; title?: string }[];
  flows?: { from: string; to: string; direction: string; evidence: Evidence }[];
}

export interface UserflowPart {
  screens?: { id: string; title?: string; file?: string }[];
  transitions?: { from: string; to: string; trigger?: string; evidence: Evidence }[];
  calls?: { from: string; to: string; evidence: Evidence }[];
}

/**
 * Возможности системы на языке предметной области, не кода. Без свидетельства
 * — иначе, чем у остальных трёх видов: подтверждается человеком, как обычная
 * запись, а не построчной сверкой с файлом (docs/07-maps.md).
 */
export interface FunctionalPart {
  capabilities?: { id: string; title?: string; parent?: string }[];
}

/** Файл, который модель посмотрела и в карту не положила. */
export interface SkippedFile {
  path: string;
  why: string;
}

export interface MapChange {
  codemap?: { added?: CodemapPart; removed?: CodemapPart };
  dataflow?: { added?: DataflowPart; removed?: DataflowPart };
  userflow?: { added?: UserflowPart; removed?: UserflowPart };
  functional?: { added?: FunctionalPart; removed?: FunctionalPart };
  /** Не структура, а решение: этих файлов в карте нет, и вот почему. */
  skipped?: SkippedFile[];
}

export interface MapProblem {
  structure: MapStructure;
  message: string;
}

export interface ParsedMap {
  change: MapChange;
  problems: MapProblem[];
  /** Какие структуры запись вообще объявила: пустой блок и отсутствующий — одно и то же. */
  present: MapStructure[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Реестр видов карты (docs/06-phases.md, фаза 9). Разбор, сверка и свод —
 * одна и та же машина для всех видов; разница между `codemap`, `dataflow` и
 * `userflow` — только в том, какие поля у блока и у каких из них есть
 * свидетельство. Новый вид добавляется записью сюда и типом в `MapChange` /
 * `ProjectMap` — не правкой `parseMapRecord`, `evidenceClaims` или `foldMaps`,
 * которые уже отработали на трёх нынешних видах.
 */
interface MapField {
  name: string;
  keyOf: (item: any) => string;
  /** Есть ли у элементов поля свидетельство — тогда сверка их не обходит. */
  evidence?: (item: any) => { label: string; evidence: Evidence };
}

interface MapKind {
  name: MapStructure;
  validate: (data: unknown) => { message: string }[];
  fields: readonly MapField[];
}

const MAP_KINDS: readonly MapKind[] = [
  {
    name: 'codemap',
    validate: validateCodemap,
    fields: [
      { name: 'modules', keyOf: (item) => item.id },
      {
        name: 'imports',
        keyOf: (item) => `${item.from}>${item.to}`,
        evidence: (item) => ({ label: `${item.from} → ${item.to}`, evidence: item.evidence })
      }
    ]
  },
  {
    name: 'dataflow',
    validate: validateDataflow,
    fields: [
      { name: 'sources', keyOf: (item) => item.id },
      {
        name: 'flows',
        keyOf: (item) => `${item.from}>${item.to}`,
        evidence: (item) => ({ label: `${item.from} ${item.direction} ${item.to}`, evidence: item.evidence })
      }
    ]
  },
  {
    name: 'userflow',
    validate: validateUserflow,
    fields: [
      { name: 'screens', keyOf: (item) => item.id },
      {
        name: 'transitions',
        keyOf: (item) => `${item.from}>${item.to}`,
        evidence: (item) => ({ label: `${item.from} → ${item.to}`, evidence: item.evidence })
      },
      {
        name: 'calls',
        keyOf: (item) => `${item.from}>${item.to}`,
        evidence: (item) => ({ label: `${item.from} → ${item.to}`, evidence: item.evidence })
      }
    ]
  },
  {
    name: 'functional',
    validate: validateFunctional,
    // Без evidence вовсе: подтверждается человеком, а не сверкой с файлом —
    // evidenceClaims не даст по этому виду ни одного утверждения для сверки.
    fields: [
      { name: 'capabilities', keyOf: (item) => item.id }
    ]
  }
];

export const MAP_STRUCTURES: readonly MapStructure[] = MAP_KINDS.map((kind) => kind.name);
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Блоки ```docdd-codemap и соседние. Формат тот же, что у mermaid: человек
 * видит их в любом редакторе markdown, а приложение — по имени языка.
 */
/**
 * Одна и та же беда во всех тридцати элементах списка — это одна беда, а не
 * тридцать. Схлопываем по номеру: человеку надо понять, что чинить, а не
 * пролистать стену одинаковых строк.
 */
export function collapse(issues: readonly string[]): string[] {
  const counted = new Map<string, { said: string; times: number }>();

  for (const issue of issues) {
    // `added.modules[12]` и `added.modules[3]` — одно место списка.
    const key = issue.replace(/\[\d+\]/g, '[]');
    const seen = counted.get(key);
    if (seen) {
      seen.times += 1;
      continue;
    }
    counted.set(key, { said: key, times: 1 });
  }

  const collapsed = [...counted.values()].map(({ said, times }) => (times > 1 ? `${said} (×${times})` : said));
  if (collapsed.length <= COLLAPSE_LIMIT) return collapsed;

  const rest = collapsed.length - COLLAPSE_LIMIT;
  return [...collapsed.slice(0, COLLAPSE_LIMIT), `…и ещё ${rest} — исправьте эти, остальные станут видны`];
}

/** Дальше этого список бед не читают, а пугаются. */
const COLLAPSE_LIMIT = 12;

export function parseMapRecord(body: string): ParsedMap {
  const change: MapChange = {};
  const problems: MapProblem[] = [];
  const present: MapStructure[] = [];

  for (const kind of MAP_KINDS) {
    const raw = blockOf(body, kind.name);
    if (raw === null) continue;
    present.push(kind.name);

    if (raw.trim() === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      problems.push({
        structure: kind.name,
        message: `Блок \`${kind.name}\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    const issues = kind.validate(parsed).map((issue) => issue.message);
    if (issues.length > 0) {
      problems.push({ structure: kind.name, message: `Блок \`${kind.name}\`: ${collapse(issues).join(' ')}` });
      continue;
    }

    // Присваиваем после проверки: в карту не должно попасть ничего, что не
    // прошло схему, иначе общая картина соберётся из мусора.
    Object.assign(change, { [kind.name]: parsed });
  }

  // Четвёртый блок — не структура, а решение: эти файлы посмотрели и в карту
  // не положили. Без него они возвращались бы в очередь бесконечно
  // (docs/07-maps.md, раздел «Не всё попадает в карту»).
  const raw = blockOf(body, 'skipped');
  if (raw !== null && raw.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(raw);
      const issues = validateSkipped(parsed);
      if (issues.length > 0) {
        problems.push({ structure: 'codemap', message: `Блок \`skipped\`: ${collapse(issues.map((issue) => issue.message)).join(' ')}` });
      } else {
        change.skipped = (parsed as { files: SkippedFile[] }).files;
      }
    } catch (error) {
      problems.push({
        structure: 'codemap',
        message: `Блок \`skipped\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  return { change, problems, present };
}

function blockOf(body: string, structure: MapStructure | 'skipped'): string | null {
  const pattern = new RegExp(
    `^[ \\t]*(?:\`\`\`|~~~)[ \\t]*docdd-${structure}[ \\t]*\\r?\\n([\\s\\S]*?)^[ \\t]*(?:\`\`\`|~~~)[ \\t]*$`,
    'm'
  );
  const match = pattern.exec(body);
  return match ? (match[1] ?? '') : null;
}

export type EvidenceSide = 'added' | 'removed';

export interface EvidenceClaim {
  structure: MapStructure;
  side: EvidenceSide;
  /** Что именно утверждается: `T-0007 → R-0004`, `cache.ts → index-cache`. */
  label: string;
  evidence: Evidence;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Все утверждения карты, у которых есть свидетельство. Из них и состоит сверка. */
export function evidenceClaims(change: MapChange): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];

  for (const side of ['added', 'removed'] as EvidenceSide[]) {
    for (const kind of MAP_KINDS) {
      const part = (change as any)[kind.name]?.[side];
      for (const field of kind.fields) {
        if (!field.evidence) continue;
        for (const item of part?.[field.name] ?? []) {
          const { label, evidence } = field.evidence(item);
          claims.push({ structure: kind.name, side, label, evidence });
        }
      }
    }
  }

  return claims;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type EvidenceVerdict = 'ok' | 'missing' | 'stale' | 'still_present';

/** Насколько строка могла уехать, чтобы свидетельство всё ещё считалось живым. */
const DRIFT_LINES = 3;

/**
 * Сверка одного свидетельства. `text === null` означает, что файла нет.
 *
 * Для добавленного ищем фрагмент рядом с указанной строкой: сдвиг на пару строк
 * не должен ронять карту, а переезд в другой файл — должен. Для убранного
 * ищем по всему файлу: после удаления номера строк всё равно съедут.
 */
export function checkEvidence(evidence: Evidence, text: string | null, side: EvidenceSide): EvidenceVerdict {
  if (side === 'removed') {
    if (text === null) return 'ok';
    return text.includes(evidence.fragment) ? 'still_present' : 'ok';
  }

  if (text === null) return 'missing';

  const lines = text.split(/\r?\n/);
  const at = evidence.line - 1;
  const from = Math.max(0, at - DRIFT_LINES);
  const to = Math.min(lines.length - 1, at + DRIFT_LINES);

  for (let i = from; i <= to; i += 1) {
    if ((lines[i] ?? '').includes(evidence.fragment)) return 'ok';
  }
  return 'stale';
}

/** Сложенная картина проекта: производное от подтверждённых карт. */
export interface ProjectMap {
  codemap: Required<CodemapPart>;
  dataflow: Required<DataflowPart>;
  userflow: Required<UserflowPart>;
  functional: Required<FunctionalPart>;
  /** Какие записи сложены, в порядке применения. */
  from: string[];
}

export function emptyProjectMap(): ProjectMap {
  return {
    codemap: { modules: [], imports: [] },
    dataflow: { sources: [], flows: [] },
    userflow: { screens: [], transitions: [], calls: [] },
    functional: { capabilities: [] },
    from: []
  };
}

/**
 * Складывание подтверждённых изменений. Утверждается изменение, а не состояние,
 * поэтому картина собирается применением `added` и `removed` по очереди — и
 * пересобирается заново, когда понадобится (docs/adr/0001-files-are-the-truth.md).
 */
export function foldMaps(changes: readonly { id: string; change: MapChange }[]): ProjectMap {
  const result = emptyProjectMap();

  for (const { id, change } of changes) {
    result.from.push(id);

    for (const kind of MAP_KINDS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const part = (change as any)[kind.name];
      for (const field of kind.fields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apply((result as any)[kind.name], field.name, part, field.keyOf);
      }
    }
  }

  return result;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Поля разных видов карты отличаются только именами, а обходятся одинаково —
// подробности вида несёт реестр (`MAP_KINDS`), эта функция сама видов не знает.
function apply(
  target: any,
  field: string,
  part: { added?: any; removed?: any } | undefined,
  keyOf: (item: any) => string
): void {
  if (!part) return;

  const removed = new Set((part.removed?.[field] ?? []).map(keyOf));
  if (removed.size > 0) {
    target[field] = target[field].filter((item: unknown) => !removed.has(keyOf(item)));
  }

  for (const item of part.added?.[field] ?? []) {
    const key = keyOf(item);
    const at = target[field].findIndex((existing: unknown) => keyOf(existing) === key);
    // Повторное объявление — не дубль, а уточнение: побеждает последнее.
    if (at === -1) target[field].push(item);
    else target[field][at] = item;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
