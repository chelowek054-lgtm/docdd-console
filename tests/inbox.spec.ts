import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseProposal, resolveLinks, titleOf } from '../server/lib/inbox';
import { inboxNotes, createRecords, DONE_DIR } from '../server/utils/inbox-service';

/**
 * Входящее (docs/10-inbox.md). Главное здесь: записи заводит приложение —
 * номера раздаёт оно, связи между предложенными записями превращаются в
 * настоящие идентификаторы, а до нажатия кнопки в `docs/development` не
 * появляется ничего.
 */

const LF = String.fromCharCode(10);

function block(records: unknown): string {
  return ['```docdd-records', JSON.stringify({ records }), '```'].join(LF);
}

describe('разбор предложения', () => {
  it('читает список записей из блока', () => {
    const parsed = parseProposal(block([
      { key: 'oplata', type: 'requirement', title: 'Оплата картой' },
      { key: 'forma', type: 'task', title: 'Форма оплаты', links: { implements: ['oplata'] } }
    ]));

    expect(parsed.problems).toEqual([]);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[1]?.links?.['implements']).toEqual(['oplata']);
  });

  it('без блока не заводит ничего и говорит почему', () => {
    const parsed = parseProposal('Я подумал и решил, что записей не нужно.');
    expect(parsed.records).toEqual([]);
    expect(parsed.problems[0]).toContain('docdd-records');
  });

  it('незнакомое поле отвергает: список полей закрыт', () => {
    const parsed = parseProposal(block([{ key: 'a', type: 'task', title: 'Раз', status: 'approved' }]));
    expect(parsed.records).toEqual([]);
    expect(parsed.problems.join(' ')).toContain('status');
  });

  it('чужой тип не проходит', () => {
    const parsed = parseProposal(block([{ key: 'a', type: 'map', title: 'Карта' }]));
    expect(parsed.records).toEqual([]);
  });

  it('связь одним значением читается как список: форма другая, смысл тот же', () => {
    // Так и ответила живая модель: `implements` строкой вместо списка.
    const parsed = parseProposal(block([
      { key: 'a', type: 'requirement', title: 'Требование' },
      { key: 'b', type: 'task', title: 'Задача', links: { implements: 'a' } }
    ]));

    expect(parsed.problems).toEqual([]);
    expect(parsed.records[1]?.links?.['implements']).toEqual(['a']);
  });

  it('два одинаковых ключа — беда: связь ведёт неизвестно куда', () => {
    const parsed = parseProposal(block([
      { key: 'a', type: 'task', title: 'Раз' },
      { key: 'a', type: 'task', title: 'Два' }
    ]));
    expect(parsed.problems.join(' ')).toContain('занят дважды');
  });
});

describe('связи', () => {
  const assigned = new Map([['oplata', 'R-0004'], ['forma', 'T-0011']]);

  it('ключ превращается в выданный номер', () => {
    const resolved = resolveLinks({ implements: ['oplata'] }, assigned);
    expect(resolved.links.implements).toEqual(['R-0004']);
    expect(resolved.problems).toEqual([]);
  });

  it('номер уже заведённой записи проходит как есть', () => {
    const resolved = resolveLinks({ implements: ['R-0001'] }, assigned);
    expect(resolved.links.implements).toEqual(['R-0001']);
  });

  it('ключ, которого нет, не молчит', () => {
    const resolved = resolveLinks({ implements: ['неизвестно'] }, assigned);
    expect(resolved.links.implements).toBeUndefined();
    expect(resolved.problems.join(' ')).toContain('неизвестно');
  });

  it('незнакомый вид связи пропускается с объяснением', () => {
    const resolved = resolveLinks({ придумал: ['oplata'] }, assigned);
    expect(resolved.problems.join(' ')).toContain('не из списка контракта');
  });
});

describe('заголовок заметки', () => {
  it('берётся из первой строки-заголовка', () => {
    expect(titleOf('oplata.md', '# Оплата картой' + LF + 'текст')).toBe('Оплата картой');
  });

  it('нет заголовка — берётся имя файла: заметке надо как-то называться', () => {
    expect(titleOf('oplata-kartoy.md', 'просто текст')).toBe('oplata-kartoy');
  });
});

describe('заведение записей', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-inbox-'));
    mkdirSync(join(root, 'docs', 'development', 'requirements'), { recursive: true });
    mkdirSync(join(root, 'docs', 'development', 'tasks'), { recursive: true });
    mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });

    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  requirements: requirements',
      '  tasks: tasks',
      'sources:',
      '  inbox: [docs/inbox]',
      ''
    ].join(LF), 'utf8');

    writeFileSync(join(root, 'docs', 'inbox', 'oplata.md'), '# Оплата картой' + LF + LF + 'Надо принимать карты.', 'utf8');
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('видит заметки склада и не лезет в docs/development', () => {
    const notes = inboxNotes(root);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.path).toBe('docs/inbox/oplata.md');
    expect(notes[0]?.title).toBe('Оплата картой');
  });

  it('заводит записи, раздаёт номера сам и связывает их между собой', () => {
    const outcome = createRecords(
      root,
      [
        { key: 'oplata', type: 'requirement', title: 'Оплата картой', body: 'Надо принимать карты.', note: 'docs/inbox/oplata.md' },
        { key: 'forma', type: 'task', title: 'Форма оплаты', change: 'feature', links: { implements: ['oplata'] } }
      ],
      ['docs/inbox/oplata.md']
    );

    expect(outcome.ok, outcome.ok ? '' : outcome.message).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.created.map((record) => record.id)).toEqual(['R-0001', 'T-0001']);

    // Связь ведёт на настоящий номер, а не на ключ из ответа модели.
    const task = readFileSync(join(root, outcome.created[1]?.path as string), 'utf8');
    expect(task).toContain('implements: [R-0001]');
    expect(task).toContain('change: feature');

    // Тело записи взято из предложения, а не заменено заготовкой.
    const requirement = readFileSync(join(root, outcome.created[0]?.path as string), 'utf8');
    expect(requirement).toContain('Надо принимать карты.');
    expect(requirement).toContain('status: draft');

    // В журнале сказано, откуда запись взялась: через месяц это спросят.
    expect(requirement).toContain('заведена из docs/inbox/oplata.md');
  });

  it('разобранная заметка переезжает в «принятое», а не пропадает', () => {
    expect(existsSync(join(root, 'docs', 'inbox', 'oplata.md'))).toBe(false);
    expect(readdirSync(join(root, 'docs', 'inbox', DONE_DIR))).toContain('oplata.md');
    // И второй раз она уже не предлагается.
    expect(inboxNotes(root)).toHaveLength(0);
  });

  it('номера не переиспользуются: следующая запись получает свободный', () => {
    const outcome = createRecords(root, [{ key: 'vtoroe', type: 'requirement', title: 'Второе' }], []);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.created[0]?.id).toBe('R-0002');
  });

  it('пустой список — отказ, а не тихое согласие', () => {
    const outcome = createRecords(root, [], []);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('nothing_to_create');
  });
});

describe('след в журнале', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-note-'));
    mkdirSync(join(root, 'docs', 'development', 'requirements'), { recursive: true });
    mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });
    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  requirements: requirements',
      'sources:',
      '  inbox: [docs/inbox]',
      ''
    ].join(LF), 'utf8');
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('чужой текст в журнал не попадает: имя заметки сверяется со списком', () => {
    const outcome = createRecords(
      root,
      [{ key: 'a', type: 'requirement', title: 'Раз', note: 'сюда я напишу что угодно' }],
      ['docs/inbox/настоящая.md']
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const text = readFileSync(join(root, outcome.created[0]?.path as string), 'utf8');
    expect(text).toContain('заведена · приложение');
    expect(text).not.toContain('что угодно');
  });
});
