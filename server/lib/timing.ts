import { statusOfJournalAction } from './actions';
import type { WorkRecord } from './types';
import { journalLines } from './write';

/**
 * Сроки и фактическое время задач (docs/adr/0039-timings-from-journal.md).
 * Срок и оценка — поля front matter; факт — из строк журнала, при чтении.
 * Своего хранилища нет: чистые функции над записями, «сейчас» и поясом проекта.
 */

/** День оценки — рабочий: `1d` — восемь часов, а не сутки. */
export const DAY_MINUTES = 8 * 60;

const MINUTE = 60_000;
const DAY = 86_400_000;

/** `30m`, `2h`, `1.5d` → минуты; кривое значение — `null`, а не ноль: его ловит схема. */
export function parseEstimate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)(m|h|d)$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  return Math.round(unit === 'm' ? amount : unit === 'h' ? amount * 60 : amount * DAY_MINUTES);
}

/** Дата из front matter: YAML отдаёт её объектом даты или строкой. */
export function dateField(value: unknown): string | null {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/** Срок фазы: `due`, а прежнее имя `target` (T-0034) — если `due` нет. */
export function phaseDue(data: Readonly<Record<string, unknown>>): string | null {
  return dateField(data['due']) ?? dateField(data['target']);
}

interface Parts { year: number; month: number; day: number; hour: number; minute: number }

/** Пояс, которого нет в базе IANA, — как не названный: время сервера, а не падение. */
function formatter(timezone: string | undefined): Intl.DateTimeFormat | null {
  if (!timezone) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function partsIn(epoch: number, timezone: string | undefined): Parts {
  const format = formatter(timezone);
  if (!format) {
    const local = new Date(epoch);
    return { year: local.getFullYear(), month: local.getMonth() + 1, day: local.getDate(), hour: local.getHours(), minute: local.getMinutes() };
  }
  const value = (type: string) => Number(format.formatToParts(new Date(epoch)).find((part) => part.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour') % 24, minute: value('minute') };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Метка строки журнала: `2026-10-25 14:03` — местное время проекта. */
export function stampAt(now: Date, timezone?: string): string {
  const p = partsIn(now.getTime(), timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Местное время проекта → момент. Без времени — начало дня. */
export function localToEpoch(date: string, time: string | null, timezone?: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = (time ?? '00:00').split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (!formatter(timezone)) return new Date(year, month - 1, day, hour, minute).getTime();
  // Смещение пояса на этот момент; второй проход поправляет переход на летнее время.
  const offset = (epoch: number) => {
    const p = partsIn(epoch, timezone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - epoch;
  };
  const first = wall - offset(wall);
  return wall - offset(first);
}

export interface JournalEvent {
  at: number;
  date: string;
  /** `null` — строка старая, без времени: читается как начало дня. */
  time: string | null;
  action: string;
  actor: string;
  /** Статус, в который строка перевела запись; `null` — заметка без смены статуса. */
  status: string | null;
}

const LINE = /^[-*]\s+(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?\s+·\s+(.+?)\s*$/;

export function parseJournal(body: string, timezone?: string): JournalEvent[] {
  const events: JournalEvent[] = [];
  for (const line of journalLines(body)) {
    const match = LINE.exec(line.trim());
    if (!match) continue;
    const [action = '', ...rest] = (match[3] ?? '').split(' · ');
    const date = match[1] ?? '';
    const time = match[2] ?? null;
    events.push({ at: localToEpoch(date, time, timezone), date, time, action: action.trim(), actor: rest.join(' · ').trim(), status: statusOfJournalAction(action.trim()) });
  }
  // Журнал дописывают по порядку, но руками строку могут вставить и не туда: считаем по времени.
  // Сортировка устойчивая — строки одного дня без времени остаются в порядке записи.
  return events.sort((a, b) => a.at - b.at);
}

export type TimingRecord = Pick<WorkRecord, 'id' | 'type' | 'status' | 'title' | 'data' | 'links' | 'body'>;

export interface TaskTiming {
  id: string;
  title: string;
  status: string;
  change: string | null;
  phase: string | null;
  /** Кто делал: исполнитель задачи, а нет его — подпись строки «в разработку». */
  assignee: string | null;
  /** Работу вёл агент роли (ADR-0033): подпись «… · агент» или «отдана агенту». */
  agent: boolean;
  /** Метка первой строки журнала (или `created`) и последнего закрытия. */
  started: string | null;
  done: string | null;
  leadMinutes: number | null;
  cycleMinutes: number | null;
  /** Время в каждом статусе с учётом возвратов, минуты. */
  inStatus: Record<string, number>;
  /** Сколько задача ждала подтверждения `documents`/`refines`; `null` — ждать было нечего. */
  waitingDocsMinutes: number | null;
  estimateMinutes: number | null;
  /** Факт против оценки — время в `in_progress`. */
  factMinutes: number;
  due: string | null;
  overdueDays: number;
  /** До срока, дней; `null` — срока нет или задача закрыта. */
  daysLeft: number | null;
  /** Все смены статуса записаны со временем — иначе точность до дня. */
  precise: boolean;
}

const CLOSED = new Set(['done', 'dropped', 'legacy', 'deferred']);
const TASK_STATUSES = new Set(['backlog', 'ready', 'in_progress', 'in_review', 'done', 'dropped', 'legacy']);

const minutes = (ms: number) => Math.max(0, Math.round(ms / MINUTE));
const dayDiff = (later: string, earlier: string) => Math.round((Date.parse(later) - Date.parse(earlier)) / DAY);
const isAgent = (event: JournalEvent) => /(^|·\s*)агент$/.test(event.actor) || event.action.startsWith('отдана агенту');

/** Когда запись получила последнее `approved`; сейчас не `approved` — `null`. */
function approvedAt(record: TimingRecord, timezone?: string): number | null {
  if (record.status !== 'approved') return null;
  const events = parseJournal(record.body, timezone).filter((event) => event.status === 'approved');
  const last = events[events.length - 1];
  if (last) return last.at;
  const updated = dateField(record.data['updated']);
  return updated ? localToEpoch(updated, null, timezone) : null;
}

export function taskTiming(task: TimingRecord, byId: ReadonlyMap<string, TimingRecord>, now: Date, timezone?: string): TaskTiming {
  const events = parseJournal(task.body, timezone);
  const created = dateField(task.data['created']);
  const startAt = events[0]?.at ?? (created ? localToEpoch(created, null, timezone) : null);
  const nowAt = now.getTime();
  const today = stampAt(now, timezone).slice(0, 10);

  const inStatus: Record<string, number> = {};
  let current = 'backlog';
  let since = startAt;
  let firstWork: number | null = null;
  let doneAt: number | null = null;
  let doneStamp: JournalEvent | null = null;
  const moves = events.filter((event) => event.status && TASK_STATUSES.has(event.status));
  for (const event of moves) {
    if (since !== null) inStatus[current] = (inStatus[current] ?? 0) + minutes(event.at - since);
    current = event.status as string;
    since = event.at;
    if (current === 'in_progress' && firstWork === null) firstWork = event.at;
    // Закрытие считается последним: вернули на проверку — прежнее закрытие не в счёт.
    if (current === 'done') { doneAt = event.at; doneStamp = event; } else { doneAt = null; doneStamp = null; }
  }
  if (since !== null && !CLOSED.has(current)) inStatus[current] = (inStatus[current] ?? 0) + minutes(nowAt - since);

  const closed = task.status === 'done' && doneAt !== null;
  const docs = [...(task.links.documents ?? []), ...(task.links.refines ?? [])].map((id) => byId.get(id)).filter((doc): doc is TimingRecord => !!doc);
  let waitingDocsMinutes: number | null = null;
  if (docs.length > 0 && startAt !== null) {
    const approvals = docs.map((doc) => approvedAt(doc, timezone));
    waitingDocsMinutes = approvals.some((at) => at === null)
      ? (CLOSED.has(task.status) ? null : minutes(nowAt - startAt))
      : minutes(Math.max(...(approvals as number[])) - startAt);
  }

  const due = dateField(task.data['due']);
  const doneDate = doneStamp?.date ?? null;
  const finished = CLOSED.has(task.status);
  const overdueEnd = task.status === 'done' ? doneDate : finished ? null : today;
  const overdueDays = due && overdueEnd ? Math.max(0, dayDiff(overdueEnd, due)) : 0;
  const work = moves.find((event) => event.status === 'in_progress');
  const assignee = typeof task.data['assignee'] === 'string' && task.data['assignee'] ? task.data['assignee'] : work ? work.actor.replace(/\s*·\s*агент$/, '') || null : null;

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    change: typeof task.data['change'] === 'string' ? task.data['change'] : null,
    phase: typeof task.data['phase'] === 'string' ? task.data['phase'] : null,
    assignee,
    agent: events.some(isAgent),
    started: events[0] ? `${events[0].date}${events[0].time ? ` ${events[0].time}` : ''}` : created,
    done: closed && doneStamp ? `${doneStamp.date}${doneStamp.time ? ` ${doneStamp.time}` : ''}` : null,
    leadMinutes: closed && startAt !== null ? minutes((doneAt as number) - startAt) : null,
    cycleMinutes: closed && firstWork !== null ? minutes((doneAt as number) - firstWork) : null,
    inStatus,
    waitingDocsMinutes,
    estimateMinutes: parseEstimate(task.data['estimate']),
    factMinutes: inStatus['in_progress'] ?? 0,
    due,
    overdueDays,
    daysLeft: due && !finished ? dayDiff(due, today) : null,
    precise: moves.every((event) => event.time !== null)
  };
}

export interface PhaseTiming {
  id: string;
  title: string;
  due: string | null;
  total: number;
  done: number;
  overdueDays: number;
  /** Задач закрыто в неделю за последние четыре недели. */
  perWeek: number;
  /** Прогноз окончания по этой скорости; `null` — скорости нет. */
  forecast: string | null;
}

const WINDOW_DAYS = 28;

export function phaseTiming(phase: TimingRecord, tasks: readonly TaskTiming[], now: Date, timezone?: string): PhaseTiming {
  const today = stampAt(now, timezone).slice(0, 10);
  const counted = tasks.filter((task) => !['dropped', 'legacy', 'deferred'].includes(task.status));
  const done = counted.filter((task) => task.status === 'done');
  const recent = done.filter((task) => task.done && dayDiff(today, task.done.slice(0, 10)) < WINDOW_DAYS).length;
  const perDay = recent / WINDOW_DAYS;
  const remaining = counted.length - done.length;
  const lastDone = done.map((task) => task.done?.slice(0, 10) ?? '').sort().pop() || null;
  const forecast = remaining === 0
    ? lastDone
    : perDay > 0 ? new Date(Date.parse(today) + Math.ceil(remaining / perDay) * DAY).toISOString().slice(0, 10) : null;
  const due = phaseDue(phase.data);
  const finished = counted.length > 0 && remaining === 0;
  return {
    id: phase.id,
    title: phase.title,
    due,
    total: counted.length,
    done: done.length,
    overdueDays: due && !finished ? Math.max(0, dayDiff(today, due)) : 0,
    perWeek: Math.round(perDay * 7 * 10) / 10,
    forecast
  };
}

/** Задачи фазы: из `covers` и с полем `phase` — связь ставят с любой стороны. */
export function phaseTaskIds(phase: TimingRecord, records: readonly TimingRecord[]): string[] {
  const own = new Set(phase.links.covers ?? []);
  for (const record of records) if (record.type === 'task' && record.data['phase'] === phase.id) own.add(record.id);
  return [...own];
}

export interface TimingGroup { key: string; agent: boolean; count: number; leadAvg: number | null; cycleAvg: number | null }

export interface Analytics {
  byChange: TimingGroup[];
  byRole: TimingGroup[];
  /** Среднее время в статусе по задачам, что в нём побывали, минуты. */
  statusAvg: Record<string, number>;
  estimates: { count: number; ratioAvg: number | null; withinQuarter: number };
  /** Закрыто по неделям (понедельник недели), последние двенадцать. */
  weeks: { week: string; closed: number }[];
  overdue: { id: string; title: string; due: string; overdueDays: number; status: string }[];
}

const average = (values: readonly number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

function group(tasks: readonly TaskTiming[], keyOf: (task: TaskTiming) => string): TimingGroup[] {
  const groups = new Map<string, TaskTiming[]>();
  for (const task of tasks) {
    const key = `${task.agent ? 'agent' : 'human'}|${keyOf(task)}`;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key: key.slice(key.indexOf('|') + 1),
    agent: key.startsWith('agent|'),
    count: items.length,
    leadAvg: average(items.flatMap((task) => (task.leadMinutes === null ? [] : [task.leadMinutes]))),
    cycleAvg: average(items.flatMap((task) => (task.cycleMinutes === null ? [] : [task.cycleMinutes])))
  })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function mondayOf(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  const shift = (at.getUTCDay() + 6) % 7;
  return new Date(at.getTime() - shift * DAY).toISOString().slice(0, 10);
}

export function analytics(all: readonly TaskTiming[], now: Date, timezone?: string): Analytics {
  const tasks = all.filter((task) => task.status !== 'legacy');
  const closed = tasks.filter((task) => task.status === 'done');
  const statusAvg: Record<string, number> = {};
  for (const status of ['backlog', 'ready', 'in_progress', 'in_review']) {
    const spent = tasks.flatMap((task) => (task.inStatus[status] ? [task.inStatus[status] as number] : []));
    const avg = average(spent);
    if (avg !== null) statusAvg[status] = avg;
  }
  const rated = closed.filter((task) => task.estimateMinutes && task.estimateMinutes > 0);
  const ratios = rated.map((task) => task.factMinutes / (task.estimateMinutes as number));
  const thisWeek = mondayOf(stampAt(now, timezone).slice(0, 10));
  const weeks = Array.from({ length: 12 }, (_, at) => new Date(Date.parse(thisWeek) - (11 - at) * 7 * DAY).toISOString().slice(0, 10))
    .map((week) => ({ week, closed: closed.filter((task) => task.done && mondayOf(task.done.slice(0, 10)) === week).length }));
  return {
    byChange: group(closed, (task) => task.change ?? '—'),
    byRole: group(closed, (task) => task.assignee ?? '—'),
    statusAvg,
    estimates: {
      count: rated.length,
      ratioAvg: ratios.length ? Math.round((ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 100) / 100 : null,
      withinQuarter: ratios.filter((ratio) => ratio >= 0.75 && ratio <= 1.25).length
    },
    weeks,
    overdue: tasks.filter((task) => task.overdueDays > 0 && task.due).map((task) => ({ id: task.id, title: task.title, due: task.due as string, overdueDays: task.overdueDays, status: task.status }))
      .sort((a, b) => b.overdueDays - a.overdueDays)
  };
}

export interface ProjectTimings { timezone: string | null; tasks: TaskTiming[]; phases: PhaseTiming[]; analytics: Analytics }

export function projectTimings(records: readonly TimingRecord[], now: Date, timezone?: string): ProjectTimings {
  const byId = new Map(records.map((record) => [record.id, record]));
  const tasks = records.filter((record) => record.type === 'task' && record.id).map((task) => taskTiming(task, byId, now, timezone));
  const timingById = new Map(tasks.map((task) => [task.id, task]));
  const phases = records.filter((record) => record.type === 'phase' && record.id)
    .map((phase) => phaseTiming(phase, phaseTaskIds(phase, records).map((id) => timingById.get(id)).filter((task): task is TaskTiming => !!task), now, timezone));
  return { timezone: timezone ?? null, tasks, phases, analytics: analytics(tasks, now, timezone) };
}

const hours = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(Math.round((value / 60) * 10) / 10));

function cell(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Выгрузка: строка на задачу, часы с одним знаком — те же числа, что на экране. */
export function timingsCsv(tasks: readonly TaskTiming[]): string {
  const head = ['id', 'title', 'status', 'change', 'phase', 'assignee', 'agent', 'started', 'done', 'lead_h', 'cycle_h', 'backlog_h', 'ready_h', 'in_progress_h', 'in_review_h', 'waiting_docs_h', 'estimate_h', 'fact_h', 'due', 'overdue_days'];
  const rows = tasks.map((task) => [
    task.id, task.title, task.status, task.change ?? '', task.phase ?? '', task.assignee ?? '', task.agent ? 'yes' : 'no', task.started ?? '', task.done ?? '',
    hours(task.leadMinutes), hours(task.cycleMinutes), hours(task.inStatus['backlog']), hours(task.inStatus['ready']), hours(task.inStatus['in_progress']), hours(task.inStatus['in_review']),
    hours(task.waitingDocsMinutes), hours(task.estimateMinutes), hours(task.factMinutes), task.due ?? '', String(task.overdueDays)
  ].map(cell).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}

/** Перенос срока из тега `due-ГГГГ-ММ-ДД`: первый подходящий тег; нет — `null`. */
export function dueFromTags(tags: readonly string[]): { due: string; tags: string[] } | null {
  const tag = tags.find((item) => /^due-\d{4}-\d{2}-\d{2}$/.test(item));
  if (!tag) return null;
  return { due: tag.slice(4), tags: tags.filter((item) => item !== tag) };
}
