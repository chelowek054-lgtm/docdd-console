import { describe, expect, it } from 'vitest';

import { buildContextPack, renderContextPack } from '../server/lib/context-pack';
import { checkTransition, hasExpectedResult, taskExpectedMissing } from '../server/lib/rules';
import { recordTemplate } from '../server/lib/scaffold';
import { codes, context, rec } from './helpers';

const GOOD = 'Что делаем.\n\n## Ожидаемый результат\n\nТест зелёный.\n\n## Журнал\n\n- строка\n';

describe('Ожидаемый результат задачи (V-0116, R-0108)', () => {
  it('раздел с текстом есть, пустой и отсутствующий — нет', () => {
    expect(hasExpectedResult(GOOD)).toBe(true);
    expect(hasExpectedResult('## Ожидаемый результат\r\n\r\nТекст\r\n')).toBe(true);
    expect(hasExpectedResult('## Ожидаемый результат\n\n## Журнал\n\n- строка\n')).toBe(false);
    expect(hasExpectedResult('Просто текст')).toBe(false);
    expect(hasExpectedResult('### Ожидаемый результат\n\nТекст')).toBe(false);
  });

  it('нет раздела у незакрытой задачи — предупреждение', () => {
    const found = taskExpectedMissing(context([rec('T-0010', 'task', 'backlog', { body: 'Без раздела' })]));
    expect(codes(found)).toEqual(['task_expected_missing']);
    expect(found[0]?.level).toBe('warning');
  });

  it('закрытая задача — без предупреждения', () => {
    for (const status of ['done', 'dropped', 'legacy', 'deferred']) {
      expect(taskExpectedMissing(context([rec('T-0010', 'task', status, { body: 'Без раздела' })]))).toEqual([]);
    }
  });

  it('настройка включена — отказ в ready, с разделом и без настройки — проходит', () => {
    const requirement = rec('R-0010', 'requirement', 'approved');
    const links = { links: { implements: ['R-0010'] }, change: 'fix' };
    const bare = rec('T-0010', 'task', 'backlog', { ...links, body: 'Без раздела' });
    const good = rec('T-0011', 'task', 'backlog', { ...links, body: GOOD });
    const gates = { expected_result: true };
    expect(codes(checkTransition(bare, 'ready', { ...context([requirement, bare]), gates }))).toContain('task_expected_missing');
    expect(codes(checkTransition(good, 'ready', { ...context([requirement, good]), gates }))).not.toContain('task_expected_missing');
    expect(codes(checkTransition(bare, 'ready', context([requirement, bare])))).not.toContain('task_expected_missing');
  });

  it('раздел уходит модели в пакете контекста', () => {
    const task = rec('T-0010', 'task', 'ready', { body: GOOD });
    const pack = buildContextPack({ records: [task], centerId: 'T-0010', needs: { kinds: ['record'], budget: 10_000 } });
    expect(renderContextPack(pack)).toContain('Тест зелёный.');
  });

  it('шаблон новой задачи несёт раздел, пустой — правило напомнит заполнить', () => {
    const text = recordTemplate({ id: 'T-0010', type: 'task', title: 'Новая', today: '2026-11-08' });
    expect(text).toContain('## Ожидаемый результат');
    expect(hasExpectedResult(text)).toBe(false);
  });
});
