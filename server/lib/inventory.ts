import type { MapChange } from './maps';

/**
 * Опись файлов кода (docs/07-maps.md, раздел «Опись файлов»).
 *
 * Карта строится не «за один взгляд на проект», а по описи: приложение знает,
 * какие файлы уже описаны подтверждёнными картами, какие изменились после
 * описания и каких больше нет. Из этого собирается запрос, называющий файлы
 * поимённо, — уже описанное не переописывается, и токены не горят зря.
 *
 * Здесь только счёт над данными: отпечатки считает вызывающий, файловая
 * система остаётся снаружи.
 */

/** Сколько файлов уходит в один запрос. Больше — ответ не поместится. */
export const PORTION = 40;

export interface FileMark {
  path: string;
  /** Отпечаток содержимого: по нему видно, изменился ли файл после описания. */
  hash: string;
}

export interface InventoryState {
  /** Всего файлов кода в проекте. */
  total: number;
  /** Описаны подтверждёнными картами и с тех пор не менялись. */
  described: string[];
  /** Не описаны ни одной подтверждённой картой. */
  pending: string[];
  /** Описаны, но с тех пор изменились: карта про них говорит неправду. */
  changed: string[];
  /** Описаны, но файлов больше нет: их надо объявить убранными. */
  gone: string[];
  /** Порция, которая уйдёт в ближайший запрос. */
  next: string[];
  portion: number;
}

/**
 * Какие файлы описывает карта. Модуль назван путём, у экрана и источника путь
 * в отдельном поле, у каждой связи — свидетельство. Всё это и есть охват.
 */
export function describedBy(change: MapChange): string[] {
  const files = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim() !== '') files.add(value);
  };

  for (const part of [change.codemap?.added, change.codemap?.removed]) {
    for (const module of part?.modules ?? []) add(module.id);
    for (const item of part?.imports ?? []) add(item.evidence?.path);
  }

  for (const part of [change.dataflow?.added, change.dataflow?.removed]) {
    for (const source of part?.sources ?? []) add(source.where);
    for (const flow of part?.flows ?? []) add(flow.evidence?.path);
  }

  for (const part of [change.userflow?.added, change.userflow?.removed]) {
    for (const screen of part?.screens ?? []) add(screen.file);
    for (const transition of part?.transitions ?? []) add(transition.evidence?.path);
    for (const call of part?.calls ?? []) add(call.evidence?.path);
  }

  return [...files];
}

/**
 * Состояние описи. `marks` — файлы кода сейчас, `described` — то, что было
 * записано в момент подтверждения карт: путь и отпечаток на тот момент.
 */
export function inventoryState(
  marks: readonly FileMark[],
  described: Readonly<Record<string, string>>,
  portion = PORTION
): InventoryState {
  const now = new Map(marks.map((mark) => [mark.path, mark.hash]));

  const stable: string[] = [];
  const pending: string[] = [];
  const changed: string[] = [];

  for (const mark of marks) {
    const was = described[mark.path];
    if (was === undefined) pending.push(mark.path);
    else if (was === mark.hash) stable.push(mark.path);
    else changed.push(mark.path);
  }

  // Файл описан, а его больше нет: карта помнит то, чего нет в проекте.
  const gone = Object.keys(described).filter((path) => !now.has(path)).sort();

  // Сперва изменившееся: карта врёт про него прямо сейчас. Потом неописанное.
  const queue = [...changed, ...pending];

  return {
    total: marks.length,
    described: stable,
    pending,
    changed,
    gone,
    next: queue.slice(0, portion),
    portion
  };
}

/** Есть ли смысл идти к модели. Нет — незачем тратить время и деньги. */
export function worthAsking(state: InventoryState): boolean {
  return state.next.length > 0 || state.gone.length > 0;
}
