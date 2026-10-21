// V-0059
import { describe, expect, it, vi } from 'vitest';

import { appendNotification, forRecipient, makeNotification, markRead, noopChannel, type Notification } from '../server/lib/notifications';

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
});
