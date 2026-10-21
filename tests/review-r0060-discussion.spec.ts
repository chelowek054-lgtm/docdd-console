// V-0060
import { describe, expect, it } from 'vitest';

import { addReply, addThread, closeThread, discussionPath, emptyDiscussion, parseDiscussion, serializeDiscussion } from '../server/lib/discussion';

/** R-0060: замечание, ответ, закрытие; файл рядом с записью; текст документа не меняется. */
const NOW = new Date('2026-10-21T10:00:00Z');

describe('обсуждение у записи (R-0060)', () => {
  it('файл лежит рядом с записью и не совпадает с ней', () => {
    expect(discussionPath('docs/development/requirements/R-0001-x.md')).toBe('docs/development/requirements/R-0001-x.discussion.json');
  });

  it('замечание, ответ, закрытие помечено, а не удалено; исходный объект не мутирует', () => {
    const empty = emptyDiscussion();
    const one = addThread(empty, 'ann', 'Неясно', NOW);
    expect(empty.threads).toHaveLength(0);
    const replied = addReply(one, 'c1', 'bob', 'Поправлю', NOW)!;
    expect(replied.threads[0]?.replies[0]?.text).toBe('Поправлю');
    const closed = closeThread(replied, 'c1', 'ann', NOW)!;
    expect(closed.threads[0]).toMatchObject({ closed: true, closedBy: 'ann' });
    expect(closed.threads[0]?.replies).toHaveLength(1);
    expect(replied.threads[0]?.closed).toBe(false);
  });

  it('ответ и закрытие несуществующего замечания — null', () => {
    expect(addReply(emptyDiscussion(), 'c9', 'a', 'x', NOW)).toBeNull();
    expect(closeThread(emptyDiscussion(), 'c9', 'a', NOW)).toBeNull();
  });

  it('круговой проход через файл; битый файл — пустое обсуждение', () => {
    const d = addThread(emptyDiscussion(), 'ann', 'a', NOW);
    expect(parseDiscussion(serializeDiscussion(d))).toEqual(d);
    expect(parseDiscussion('{не json').threads).toEqual([]);
  });
});
