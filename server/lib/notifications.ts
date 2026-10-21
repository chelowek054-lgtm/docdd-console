/**
 * Уведомления команды (R-0059, docs/15-team-platform.md). Чистые функции над
 * списком: файлов и сети здесь нет, чтобы их можно было тестировать без сервера.
 */

/** События процесса, о которых человека надо известить. */
export type NotificationKind =
  | 'assigned'
  | 'reviewer_assigned'
  | 'awaiting_acceptance'
  | 'violation_in_zone';

export interface Notification {
  id: string;
  at: string;
  kind: NotificationKind;
  /** Кому: идентификатор человека в приложении. */
  recipient: string;
  recordId?: string;
  text: string;
  read: boolean;
}

export interface NotificationInput {
  kind: NotificationKind;
  recipient: string;
  recordId?: string;
  text: string;
}

/** Не даём списку расти бесконечно: старые прочитанные никому не нужны. */
const KEEP = 200;

export function makeNotification(input: NotificationInput, now: Date, seq: number): Notification {
  return {
    id: `n-${now.getTime().toString(36)}-${seq}`,
    at: now.toISOString(),
    kind: input.kind,
    recipient: input.recipient,
    ...(input.recordId === undefined ? {} : { recordId: input.recordId }),
    text: input.text,
    read: false
  };
}

export function appendNotification(list: readonly Notification[], item: Notification): Notification[] {
  return [...list, item].slice(-KEEP);
}

/** Пустой `ids` — прочитать всё адресату. */
export function markRead(list: readonly Notification[], recipient: string, ids: readonly string[] = []): Notification[] {
  return list.map((item) => (
    item.recipient === recipient && (ids.length === 0 || ids.includes(item.id)) ? { ...item, read: true } : item
  ));
}

export function forRecipient(list: readonly Notification[], recipient: string): Notification[] {
  return list.filter((item) => item.recipient === recipient).reverse();
}

/**
 * Внешний канал (почта, мессенджер) по настройке администратора. Приложение
 * знает только этот интерфейс; конкретная отправка — отдельная задача.
 */
export interface ChannelAdapter {
  readonly name: string;
  send(item: Notification): Promise<void>;
}

/** Заглушка: ничего не отправляет, чтобы без настройки канала уведомления жили в приложении. */
export const noopChannel: ChannelAdapter = {
  name: 'none',
  send: () => Promise.resolve()
};

/** Не больше стольких уведомлений о нарушениях за один пересчёт: иначе массовая правка устроит шторм. */
export const ZONE_BURST_LIMIT = 20;

export interface ZoneRecord {
  id: string;
  type: string;
  owner: string | null;
  phase: string | null;
  links: Partial<Record<string, string[]>>;
}

export interface ZoneCapability {
  id: string;
  owner?: string | undefined;
  parent?: string | undefined;
}

export interface ZoneIssue {
  code: string;
  recordId: string | null;
  path: string;
  message: string;
}

export const issueFingerprint = (issue: ZoneIssue): string => `${issue.code}|${issue.recordId ?? ''}|${issue.path}`;

/** Владелец — роль или логин: роль раскрывается в логины команды, неизвестное считается логином. */
export function resolveOwners(owner: string, team: readonly { login: string; roles: string[] }[]): string[] {
  const byRole = team.filter((member) => member.roles.includes(owner)).map((member) => member.login);
  return byRole.length > 0 ? byRole : [owner];
}

/**
 * «Зона» человека — возможности и фазы, где он владелец. Нарушение попадает в
 * зону, если его запись связана с такой возможностью (`covers`/`implements`/
 * `affects`) или стоит в такой фазе; возможность без своего владельца берёт
 * владельца ближайшего родителя (как `effectiveOwner`).
 */
export function zoneRecipients(
  recordId: string,
  records: readonly ZoneRecord[],
  capabilities: readonly ZoneCapability[],
  team: readonly { login: string; roles: string[] }[]
): string[] {
  const record = records.find((item) => item.id === recordId);
  if (!record) return [];
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const owners = new Set<string>();
  const ownerOfCapability = (id: string): string | null => {
    const seen = new Set<string>();
    let at = byId.get(id);
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      if (at.owner && at.owner.trim() !== '') return at.owner.trim();
      at = at.parent ? byId.get(at.parent) : undefined;
    }
    return null;
  };
  for (const kind of ['covers', 'implements', 'affects']) {
    for (const id of record.links[kind] ?? []) {
      const owner = ownerOfCapability(id);
      if (owner) owners.add(owner);
    }
  }
  if (record.phase) {
    const phase = records.find((item) => item.type === 'phase' && item.id === record.phase);
    if (phase?.owner) owners.add(phase.owner);
  }
  return [...new Set([...owners].flatMap((owner) => resolveOwners(owner, team)))];
}

/** Отправляется только то, чего ещё не видели; границу «уже видели» хранит вызывающий. */
export function newZoneNotices(
  issues: readonly ZoneIssue[],
  seen: ReadonlySet<string>,
  records: readonly ZoneRecord[],
  capabilities: readonly ZoneCapability[],
  team: readonly { login: string; roles: string[] }[]
): { notices: NotificationInput[]; fingerprints: string[] } {
  const notices: NotificationInput[] = [];
  const fingerprints = issues.map(issueFingerprint);
  const fresh = new Set<string>();
  for (const issue of issues) {
    const key = issueFingerprint(issue);
    if (seen.has(key) || fresh.has(key) || !issue.recordId) continue;
    fresh.add(key);
    for (const recipient of zoneRecipients(issue.recordId, records, capabilities, team)) {
      notices.push({ kind: 'violation_in_zone', recipient, recordId: issue.recordId, text: `В вашей зоне нарушение по ${issue.recordId}: ${issue.message}` });
    }
  }
  return { notices: notices.slice(0, ZONE_BURST_LIMIT), fingerprints };
}

/** Webhook, совместимый со Slack/Mattermost incoming webhook: POST `{text}`. */
export function webhookChannel(url: string, doFetch: typeof fetch = fetch, timeoutMs = 5000): ChannelAdapter {
  return {
    name: 'webhook',
    async send(item) {
      const response = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `[${item.recipient}] ${item.text}` }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`webhook ${response.status}`);
    }
  };
}
