import { RETIRED_STATUSES, type LinkKind } from './types';

/**
 * Привести задачу в порядок прямо в карточке (docs/04-ui.md, «Запись»): выбор
 * требования для `implements`. Чистые функции — файлы и сеть остаются снаружи.
 */

export interface RequirementOption {
  id: string;
  title: string;
  status: string;
}

type Links = Partial<Record<LinkKind, string[]>>;

/** Сколько вариантов показывать: дальше человек уточняет поиск, а не листает стену. */
export const REQUIREMENT_CHOICES = 8;

/**
 * Требования для выбора: отставленные (заменены, отменены) не предлагаются,
 * подтверждённые первыми. Поиск — по номеру и названию, без учёта регистра.
 */
export function requirementChoices(
  records: readonly (RequirementOption & { type: string })[],
  query: string,
  limit = REQUIREMENT_CHOICES
): RequirementOption[] {
  const needle = query.trim().toLowerCase();
  return records
    .filter((record) => record.type === 'requirement' && !RETIRED_STATUSES.has(record.status))
    .filter((record) => needle === '' || record.id.toLowerCase().includes(needle) || record.title.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved') || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, title, status }) => ({ id, title, status }));
}

/**
 * Связи с добавленным `implements`. Правка полей заменяет `links` целиком
 * (docs/03-server-api.md), поэтому прежние связи уходят вместе с новой.
 */
export function withImplements(links: Links, requirementId: string): Links {
  const present = links.implements ?? [];
  return { ...links, implements: present.includes(requirementId) ? [...present] : [...present, requirementId] };
}

/** Требования задачи, которые ещё не подтверждены: в `ready` с ними не уйти. */
export function unapprovedRequirements(links: Links, statusOf: (id: string) => string | undefined): string[] {
  return (links.implements ?? []).filter((id) => {
    const status = statusOf(id);
    return status !== undefined && status !== 'approved';
  });
}

/** Справки для выбора: подтверждённые, поиск по номеру, названию и строке «что решает». */
export function referenceChoices(
  records: readonly (RequirementOption & { type: string; extra?: Record<string, unknown> })[],
  query: string,
  limit = REQUIREMENT_CHOICES
): (RequirementOption & { summary: string })[] {
  const needle = query.trim().toLowerCase();
  return records
    .filter((record) => record.type === 'reference' && record.status === 'approved')
    .map((record) => ({ id: record.id, title: record.title, status: record.status, summary: typeof record.extra?.['summary'] === 'string' ? record.extra['summary'] : '' }))
    .filter((item) => needle === '' || [item.id, item.title, item.summary].some((text) => text.toLowerCase().includes(needle)))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Связи с добавленной справкой: правка полей заменяет `links` целиком, прежние уходят вместе с новой. */
export function withReuses(links: Links, referenceId: string): Links {
  const present = links.reuses ?? [];
  return { ...links, reuses: present.includes(referenceId) ? [...present] : [...present, referenceId] };
}

/** Блокирует ли шаг вперёд именно отсутствие `implements` — единственное, что форма умеет чинить. */
export function lacksRequirement(actions: readonly { blockers: readonly { code: string }[] }[]): boolean {
  return actions.some((action) => action.blockers.some((blocker) => blocker.code === 'task_no_requirement'));
}
