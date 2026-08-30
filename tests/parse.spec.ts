import { describe, expect, it } from 'vitest';

import { coerceDates, detectEol, firstHeading, parseRecord } from '../server/lib/parse';

const source = { path: 'docs/development/tasks/T-0007-primer.md', section: 'tasks' } as const;

const valid = [
  '---',
  'id: T-0007',
  'type: task',
  'title: Вынести веса модели клёва',
  'status: ready',
  'created: 2026-08-30',
  'updated: 2026-08-30',
  'links:',
  '  implements: [R-0004]',
  'своё_поле: значение',
  '---',
  '',
  '# Вынести веса модели клёва',
  '',
  'Текст задачи.',
  ''
].join('\n');

describe('parseRecord', () => {
  it('разбирает запись и не трогает тело', () => {
    const outcome = parseRecord(valid, source);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.record.id).toBe('T-0007');
    expect(outcome.record.type).toBe('task');
    expect(outcome.record.links.implements).toEqual(['R-0004']);
    expect(outcome.record.body).toContain('# Вынести веса модели клёва');
    expect(outcome.record.body).toContain('Текст задачи.');
  });

  it('сохраняет незнакомые поля: проект вправе добавить своё', () => {
    const outcome = parseRecord(valid, source);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.data['своё_поле']).toBe('значение');
  });

  it('parse_failed: front matter не первым блоком', () => {
    const outcome = parseRecord('# Заголовок\n\n---\nid: T-0007\n---\n', source);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.violation.code).toBe('parse_failed');
    expect(outcome.violation.level).toBe('error');
    expect(outcome.violation.path).toBe(source.path);
  });

  it('parse_failed: битый YAML', () => {
    const broken = '---\nid: T-0007\nlinks: [не закрытый\n---\n\n# Заголовок\n';
    const outcome = parseRecord(broken, source);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.violation.code).toBe('parse_failed');
  });

  it('parse_failed молчит на записи с пустым телом: тело — не обязанность', () => {
    const outcome = parseRecord('---\nid: T-0007\ntype: task\n---\n', source);
    expect(outcome.ok).toBe(true);
  });
});

describe('detectEol', () => {
  it('различает CRLF и LF: запись обязана вернуть тот же перевод строки', () => {
    expect(detectEol(valid.replace(/\n/g, '\r\n'))).toBe('crlf');
    expect(detectEol(valid)).toBe('lf');
  });

  it('разбирает файл с CRLF так же, как с LF', () => {
    const outcome = parseRecord(valid.replace(/\n/g, '\r\n'), source);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.id).toBe('T-0007');
    expect(outcome.record.eol).toBe('crlf');
  });
});

describe('coerceDates', () => {
  it('дата без времени становится строкой ISO', () => {
    const outcome = parseRecord(valid, source);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.data['created']).toBe('2026-08-30');
    expect(outcome.record.data['updated']).toBe('2026-08-30');
  });

  it('момент времени сохраняет время: started_at отчёта не дата', () => {
    const coerced = coerceDates({ started_at: new Date('2026-08-30T10:00:00Z') }) as Record<string, unknown>;
    expect(coerced['started_at']).toBe('2026-08-30T10:00:00.000Z');
  });

  it('обходит вложенные значения', () => {
    const coerced = coerceDates({ a: [{ b: new Date('2026-01-02T00:00:00Z') }] }) as { a: { b: string }[] };
    expect(coerced.a[0]?.b).toBe('2026-01-02');
  });
});

describe('firstHeading', () => {
  it('находит заголовок первого уровня', () => {
    expect(firstHeading('\n# Заголовок\n\nтекст')).toBe('Заголовок');
  });

  it('не заглядывает внутрь блока кода', () => {
    expect(firstHeading('```\n# Не заголовок\n```\n\n# Настоящий\n')).toBe('Настоящий');
  });

  it('возвращает null, когда заголовка нет', () => {
    expect(firstHeading('просто текст\n## подзаголовок\n')).toBeNull();
  });
});
