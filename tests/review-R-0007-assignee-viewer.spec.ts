// V-0007 (unit): проверка по тексту требования R-0007. Исполнитель задачи и наблюдатель только смотрит.
import { describe, expect, it } from 'vitest';

import { applyFieldPatch, applyJournalNote } from '../server/lib/actions';
import { boardColumns } from '../server/lib/manager';
import { ALL_ACTIONS, can } from '../server/lib/permissions';
import type { IndexRecord } from '../server/lib/types';

const NL = String.fromCharCode(10);
const task = [
  '---', 'id: T-1', 'type: task', 'title: Задача', 'status: ready', 'created: 2026-10-01', 'updated: 2026-10-01', '---',
  '', '# Задача', '', 'Текст.', '', '## Журнал', '', '- 2026-10-01 · заведена · модель', ''
].join(NL);

describe('R-0007: assignee', () => {
  it('ставится и снимается правкой поля front matter', () => {
    const set = applyFieldPatch(task, { assignee: 'ivan' }, '2026-10-21');
    expect(set.problems).toEqual([]);
    expect(set.text).toContain('assignee: ivan');
    const cleared = applyFieldPatch(set.text, { assignee: null }, '2026-10-21');
    expect(cleared.problems).toEqual([]);
    expect(cleared.text).not.toContain('assignee');
  });
  it('смена исполнителя пишет в журнал одну строку с подписью, текст не трогает', () => {
    const note = applyJournalNote(task, { action: 'исполнитель: ivan', actor: 'Иван (developer)', today: '2026-10-21' });
    expect(note.problems).toEqual([]);
    expect(note.text).toContain('- 2026-10-21 · исполнитель: ivan · Иван (developer)');
    expect(note.text.split(NL).length).toBe(task.split(NL).length + 1);
  });
});

function rec(id: string, assignee?: string): IndexRecord {
  return { id, type: 'task', status: 'ready', title: id, links: {}, extra: assignee ? { assignee } : {} } as unknown as IndexRecord;
}

describe('R-0007: фильтр «Мои задачи»', () => {
  const records = [rec('T-1', 'ivan'), rec('T-2', 'petr'), rec('T-3')];
  const ids = (assignee?: string) => boardColumns(records, assignee ? { assignee } : {})['ready']!.map((r) => r.id);
  it('оставляет только задачи исполнителя', () => {
    expect(ids('ivan')).toEqual(['T-1']);
    expect(ids('nobody')).toEqual([]);
    expect(ids()).toEqual(['T-1', 'T-2', 'T-3']);
  });
  it('пустые данные не падают', () => {
    expect(boardColumns([], { assignee: 'ivan' })['ready']).toEqual([]);
  });
});

describe('R-0007: наблюдатель', () => {
  it('у viewer единственное право — read', () => {
    const team = [{ login: 'v', roles: ['viewer'] }];
    expect(ALL_ACTIONS.filter((a) => can({ login: 'v', admin: false }, team, a).allowed)).toEqual(['read']);
  });
});
