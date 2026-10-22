import type { ZoneCapability } from '../lib/notifications';
import type { ProjectIndex } from '../lib/types';
import { buildProjectMap } from './map-service';
import { notify, notifyZoneViolations } from './notification-service';
import { reviewerOf } from '../lib/reviewer';
import { resolveOwners } from '../lib/notifications';
import { loadIndex } from './index-service';

/**
 * Места событий процесса → уведомления (R-0059). Адресат — логин из самой записи
 * (`assignee`, `reviewer`); пустое поле — некого уведомлять. Сбой уведомления
 * не должен отменять правку записи, поэтому ошибки глотаем.
 */
type Fields = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function send(projectId: string, kind: 'assigned' | 'reviewer_assigned' | 'awaiting_acceptance', recipient: string, recordId: string, message: string): void {
  if (!recipient) return;
  void notify(projectId, { kind, recipient, recordId, text: message }).catch(() => undefined);
}

type Team = { login: string; roles: string[] }[];

/** Команда проекта: ревьюер — роль, её надо разложить на людей. */
function teamOf(root: string): Team {
  try { return root ? loadIndex(root).project.team ?? [] : []; } catch { return []; }
}

/** Исполнитель или ревьюер назначены (изменились) — извещаем нового; роль ревьюера — всем её людям. */
export function notifyPatched(projectId: string, recordId: string, before: Fields, after: { assignee?: string | null; reviewer?: string | null }, root = ''): void {
  if (after.assignee && after.assignee !== text(before['assignee'])) {
    send(projectId, 'assigned', after.assignee, recordId, `Вам назначена задача ${recordId}`);
  }
  if (after.reviewer && after.reviewer !== text(before['reviewer'])) {
    for (const login of resolveOwners(after.reviewer, teamOf(root))) {
      send(projectId, 'reviewer_assigned', login, recordId, `Вы назначены ревьюером ${recordId}`);
    }
  }
}

/**
 * Задача перешла в `in_review` — ждёт приёмки у ревьюера: явного или по правилу
 * (ADR-0030); ревьюер — роль, уведомление получает каждый её человек в команде.
 */
export function notifyStatus(projectId: string, recordId: string, type: string, status: string, data: Fields, root = ''): void {
  if (type !== 'task' || status !== 'in_review') return;
  let role = text(data['reviewer']);
  let team: Team = [];
  if (root) {
    try {
      const index = loadIndex(root);
      team = index.project.team ?? [];
      const task = index.records.find((record) => record.id === recordId);
      if (task && !role) role = reviewerOf(task, index.records, index.project.roles)?.role ?? '';
    } catch { /* без индекса — только явный ревьюер */ }
  }
  for (const login of role ? resolveOwners(role, team) : []) send(projectId, 'awaiting_acceptance', login, recordId, `Задача ${recordId} ждёт приёмки`);
}

/**
 * После пересчёта нарушений: новое в зоне владельца — ему. Вызывается из
 * `saveRecord`; сбой (в том числе нет хранилища вне сервера) запись не отменяет.
 */
export function notifyViolations(root: string, index: ProjectIndex): void {
  try {
    let capabilities: ZoneCapability[] = [];
    try { capabilities = buildProjectMap(root).functional.capabilities as ZoneCapability[]; } catch { /* карта необязательна */ }
    void notifyZoneViolations(index.project.id, index.issues, index.records, capabilities, index.project.team ?? []).catch(() => undefined);
  } catch { /* уведомления необязательны */ }
}
