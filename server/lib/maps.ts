import { validateCodemap, validateDataflow, validateUserflow } from './schema';

/**
 * Карты проекта (docs/07-maps.md). Разбор трёх структур из тела записи и
 * сверка свидетельств. Чистые функции: содержимое файлов кода передаётся
 * снаружи — приложение сверяет строки, а не разбирает синтаксис
 * (docs/adr/0007-maps-lead-code.md).
 */

export type MapStructure = 'codemap' | 'dataflow' | 'userflow';

export const MAP_STRUCTURES: readonly MapStructure[] = ['codemap', 'dataflow', 'userflow'];

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

export interface MapChange {
  codemap?: { added?: CodemapPart; removed?: CodemapPart };
  dataflow?: { added?: DataflowPart; removed?: DataflowPart };
  userflow?: { added?: UserflowPart; removed?: UserflowPart };
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

/**
 * Блоки ```docdd-codemap и соседние. Формат тот же, что у mermaid: человек
 * видит их в любом редакторе markdown, а приложение — по имени языка.
 */
export function parseMapRecord(body: string): ParsedMap {
  const change: MapChange = {};
  const problems: MapProblem[] = [];
  const present: MapStructure[] = [];

  for (const structure of MAP_STRUCTURES) {
    const raw = blockOf(body, structure);
    if (raw === null) continue;
    present.push(structure);

    if (raw.trim() === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      problems.push({
        structure,
        message: `Блок \`${structure}\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    const issues = validateFor(structure, parsed);
    if (issues.length > 0) {
      problems.push({ structure, message: `Блок \`${structure}\`: ${issues.join(' ')}` });
      continue;
    }

    // Присваиваем после проверки: в карту не должно попасть ничего, что не
    // прошло схему, иначе общая картина соберётся из мусора.
    Object.assign(change, { [structure]: parsed });
  }

  return { change, problems, present };
}

function validateFor(structure: MapStructure, data: unknown): string[] {
  const issues = structure === 'codemap'
    ? validateCodemap(data)
    : structure === 'dataflow'
      ? validateDataflow(data)
      : validateUserflow(data);
  return issues.map((issue) => issue.message);
}

function blockOf(body: string, structure: MapStructure): string | null {
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

/** Все утверждения карты, у которых есть свидетельство. Из них и состоит сверка. */
export function evidenceClaims(change: MapChange): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];

  for (const side of ['added', 'removed'] as EvidenceSide[]) {
    const code = change.codemap?.[side];
    for (const edge of code?.imports ?? []) {
      claims.push({ structure: 'codemap', side, label: `${edge.from} → ${edge.to}`, evidence: edge.evidence });
    }

    const data = change.dataflow?.[side];
    for (const flow of data?.flows ?? []) {
      claims.push({ structure: 'dataflow', side, label: `${flow.from} ${flow.direction} ${flow.to}`, evidence: flow.evidence });
    }

    const user = change.userflow?.[side];
    for (const step of user?.transitions ?? []) {
      claims.push({ structure: 'userflow', side, label: `${step.from} → ${step.to}`, evidence: step.evidence });
    }
    for (const call of user?.calls ?? []) {
      claims.push({ structure: 'userflow', side, label: `${call.from} → ${call.to}`, evidence: call.evidence });
    }
  }

  return claims;
}

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
  /** Какие записи сложены, в порядке применения. */
  from: string[];
}

export function emptyProjectMap(): ProjectMap {
  return {
    codemap: { modules: [], imports: [] },
    dataflow: { sources: [], flows: [] },
    userflow: { screens: [], transitions: [], calls: [] },
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

    apply(result.codemap, 'modules', change.codemap, (item) => item.id);
    apply(result.codemap, 'imports', change.codemap, (item) => `${item.from}>${item.to}`);
    apply(result.dataflow, 'sources', change.dataflow, (item) => item.id);
    apply(result.dataflow, 'flows', change.dataflow, (item) => `${item.from}>${item.to}`);
    apply(result.userflow, 'screens', change.userflow, (item) => item.id);
    apply(result.userflow, 'transitions', change.userflow, (item) => `${item.from}>${item.to}`);
    apply(result.userflow, 'calls', change.userflow, (item) => `${item.from}>${item.to}`);
  }

  return result;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Три структуры отличаются только именами полей, а обходятся одинаково.
// Разложить это по типам аккуратнее стоило бы втрое больше кода, чем экономит.
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
