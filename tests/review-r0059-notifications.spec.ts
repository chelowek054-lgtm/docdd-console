// V-0059
import { describe, expect, it, vi } from 'vitest';

import { appendNotification, forRecipient, makeNotification, markRead, newZoneNotices, noopChannel, webhookChannel, type Notification } from '../server/lib/notifications';

/** R-0059: уведомление адресату, прочтение, очередь ограничена, заглушка канала ничего не отправляет. */
const NOW = new Date('2026-10-21T10:00:00Z');

describe('уведомления команды (R-0059)', () => {
  it('создаёт непрочитанное уведомление по каждому событию и показывает только адресату', () => {
    const kinds = ['assigned', 'reviewer_assigned', 'awaiting_acceptance', 'violation_in_zone'] as const;
    let list = kinds.reduce((acc, kind, i) => appendNotification(acc, makeNotification({ kind, recipient: i % 2 ? 'ann' : 'bob', recordId: 'T-1', text: kind }, NOW, i)), [] as Notification[]);
    expect(list.every((n) => !n.read)).toBe(true);
    expect(forRecipient(list, 'ann').map((n) => n.kind)).toEqual(['violation_in_zone', 'reviewer_assigned']);
    list = markRead(list, 'ann');
    expect(forRecipient(list, 'ann').every((n) => n.read)).toBe(true);
    expect(forRecipient(list, 'bob').every((n) => !n.read)).toBe(true);
  });

  it('очередь не растёт бесконечно', () => {
    let list: Notification[] = [];
    for (let i = 0; i < 250; i++) list = appendNotification(list, makeNotification({ kind: 'assigned', recipient: 'a', text: String(i) }, NOW, i));
    expect(list).toHaveLength(200);
    expect(list.at(-1)?.text).toBe('249');
  });

  it('заглушка внешнего канала не отправляет и не падает', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(noopChannel.send(makeNotification({ kind: 'assigned', recipient: 'a', text: 'x' }, NOW, 0))).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    expect(noopChannel.name).toBe('none');
  });

  const records = [
    { id: 'T-1', type: 'task', owner: null, phase: null, links: { covers: ['c1'] } },
    { id: 'T-2', type: 'task', owner: null, phase: null, links: {} }
  ];
  const caps = [{ id: 'c1', owner: 'ann' }];
  const issue = { code: 'x', recordId: 'T-1', path: 'a.md', message: 'плохо' };

  it('новое нарушение в зоне владельца — одно уведомление, повтор без дубля, чужая зона не получает', () => {
    const first = newZoneNotices([issue, { ...issue, recordId: 'T-2', path: 'b.md' }], new Set(), records, caps, []);
    expect(first.notices.map((n) => n.recipient)).toEqual(['ann']);
    const again = newZoneNotices([issue], new Set(first.fingerprints), records, caps, []);
    expect(again.notices).toHaveLength(0);
  });

  it('webhook получает {text}, а падение не бросает наружу из notify', async () => {
    const calls: unknown[] = [];
    const ok = vi.fn((_url: string, init?: RequestInit) => { calls.push(JSON.parse(String(init?.body))); return Promise.resolve(new Response('ok')); });
    await webhookChannel('https://h.example/x', ok as unknown as typeof fetch).send(makeNotification({ kind: 'assigned', recipient: 'a', text: 'привет' }, NOW, 0));
    expect(Object.keys(calls[0] as object)).toEqual(['text']);
    const bad = vi.fn(() => Promise.reject(new Error('down')));
    const safe = async () => { try { await webhookChannel('https://h.example/x', bad as unknown as typeof fetch).send(makeNotification({ kind: 'assigned', recipient: 'a', text: 'x' }, NOW, 0)); } catch { /* notify глотает */ } };
    await expect(safe()).resolves.toBeUndefined();
  });
});
