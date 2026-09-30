import type { ProposedRecord } from './inbox';

/**
 * Карта-намерение на пачку задач (docs/07-maps.md, «Карта-намерение на пачку
 * задач»): одна общая карта, а не по карте на каждую `feature`-задачу.
 * Чистые функции — файлы пишет вызывающий.
 */

export const INTENT_MAP_KEY = 'intent-map-batch';

export function intentMapTitle(today: string): string {
  return `Карта изменений: пачка от ${today}`;
}

/** Тело карты: что это и какие задачи к ней привязаны. Структур нет — кода ещё нет. */
export function intentMapBody(tasks: readonly string[]): string {
  return [
    'Общая карта-намерение на пачку задач: завели приложением, чтобы каждая',
    '`feature`-задача не упиралась по отдельности в правило «нет подтверждённой',
    'карты». Структур в ней нет — кода ещё нет, описывать пока нечего, и сверка',
    'с кодом для неё не запускается (`intent: true`).',
    '',
    'Подтвердите, когда согласны, что эти задачи меняют устройство проекта. Когда',
    'код появится — уточните карту («Обновить карты») и снимите `intent: true`.',
    '',
    'Задачи пачки:',
    '',
    ...tasks.map((title) => `- ${title}`)
  ].join('\n');
}

/** `feature`-задача, не связанная ни с какой картой. */
function needsMap(record: ProposedRecord): boolean {
  return record.type === 'task' && record.change === 'feature' && (record.links?.['affects'] ?? []).length === 0;
}

/**
 * Пачка с карт-намерением: есть `feature`-задачи без `affects` — рядом
 * заводится одна общая карта, и эти задачи получают `affects` на неё. Что
 * модель предложила сама (свою карту, свои связи) остаётся как было:
 * достраивается только недостающее.
 */
export function withIntentMap(proposed: readonly ProposedRecord[], today: string): ProposedRecord[] {
  const needy = proposed.filter(needsMap);
  if (needy.length === 0) return [...proposed];

  const taken = new Set(proposed.map((record) => record.key));
  let key = INTENT_MAP_KEY;
  for (let n = 2; taken.has(key); n += 1) key = `${INTENT_MAP_KEY}-${n}`;

  const linked = proposed.map((record) => (needsMap(record)
    ? { ...record, links: { ...record.links, affects: [key] } }
    : record));

  return [
    ...linked,
    {
      key,
      type: 'map',
      title: intentMapTitle(today),
      body: intentMapBody(needy.map((record) => record.title)),
      intent: true
    }
  ];
}
