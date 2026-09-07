import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseProposal, resolveLinks, titleOf } from '../server/lib/inbox';
import { parseMapRecord } from '../server/lib/maps';
import { inboxPrompt } from '../server/lib/prompt';
import {
  archivedNotes,
  beforeArchive,
  derivedFrom,
  inboxNotes,
  createNote,
  createRecords,
  DONE_DIR
} from '../server/utils/inbox-service';

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
    const parsed = parseProposal(block([{ key: 'a', type: 'заметка', title: 'Мимо схемы' }]));
    expect(parsed.records).toEqual([]);
  });

  it('карта — тоже допустимый тип: разбор входящего может пополнить функциональную карту', () => {
    const parsed = parseProposal(block([
      { key: 'a', type: 'map', title: 'Приём пациента', capabilities: [{ id: 'priyom', title: 'Приём пациента' }] }
    ]));
    expect(parsed.problems).toEqual([]);
    expect(parsed.records[0]?.capabilities).toEqual([{ id: 'priyom', title: 'Приём пациента' }]);
  });

  it('возможность без id не проходит: по нему возможности ссылаются друг на друга', () => {
    const parsed = parseProposal(block([
      { key: 'a', type: 'map', title: 'Карта', capabilities: [{ title: 'Без идентификатора' }] }
    ]));
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

describe('запрос на разбор входящего', () => {
  const bare = '<!-- ЗАВЕДЕНО -->|<!-- КАРТА -->|<!-- ЗАМЕТКИ -->';

  it('без карты — говорит, что первая возможность будет первой', () => {
    const prompt = inboxPrompt(bare, [], []);
    expect(prompt).toContain('Функциональной карты пока нет');
  });

  it('с картой — перечисляет возможности; по родителю виден вложенный уровень', () => {
    const prompt = inboxPrompt(bare, [], [], [
      { id: 'priyom', title: 'Приём пациента' },
      { id: 'zhaloby', title: 'Жалобы', parent: 'priyom' }
    ]);
    expect(prompt).toContain('`priyom` — Приём пациента');
    expect(prompt).toContain('`zhaloby` — Жалобы (внутри `priyom`)');
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
        { key: 'oplata', type: 'requirement', title: 'Оплата картой', body: 'Надо принимать карты.', notes: ['docs/inbox/oplata.md'] },
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

  it('разобранная заметка находится и после переезда — база знаний, а не разовый лоток', () => {
    const archived = archivedNotes(root);
    expect(archived).toHaveLength(1);
    expect(archived[0]?.path).toBe('docs/inbox/принятое/oplata.md');
    expect(archived[0]?.title).toBe('Оплата картой');
  });

  it('видно, что из заметки выросло', () => {
    // T-0001 не называла note в предложении — в связь с заметкой попадает
    // только та запись, что её действительно назвала.
    const derived = derivedFrom(root);
    expect(derived.get('docs/inbox/oplata.md')).toEqual(['R-0001']);
  });

  it('связь находится и по пути ПОСЛЕ переезда — так её и ищет экран', () => {
    // Журнал знает заметку по пути до archive(); список разобранного отдаёт
    // путь после. beforeArchive — мост между ними; без него это два разных
    // пути к одному файлу, и derived.get() всегда возвращал бы пусто.
    const archivedPath = archivedNotes(root)[0]?.path as string;
    expect(archivedPath).toBe('docs/inbox/принятое/oplata.md');

    const derived = derivedFrom(root);
    expect(derived.get(archivedPath)).toBeUndefined();
    expect(derived.get(beforeArchive(archivedPath))).toEqual(['R-0001']);
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
      [{ key: 'a', type: 'requirement', title: 'Раз', notes: ['сюда я напишу что угодно'] }],
      ['docs/inbox/настоящая.md']
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const text = readFileSync(join(root, outcome.created[0]?.path as string), 'utf8');
    expect(text).toContain('заведена · приложение');
    expect(text).not.toContain('что угодно');
  });
});

describe('одна заметка — несколько записей', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-multi-'));
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
    writeFileSync(join(root, 'docs', 'inbox', 'raznoe.md'), '# Разное' + LF + LF + 'Тут смешано два требования.', 'utf8');

    createRecords(
      root,
      [
        { key: 'a', type: 'requirement', title: 'Первое', notes: ['docs/inbox/raznoe.md'] },
        { key: 'b', type: 'requirement', title: 'Второе', notes: ['docs/inbox/raznoe.md'] }
      ],
      ['docs/inbox/raznoe.md']
    );
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('заметка, разобранная в несколько записей разом, ссылается на обе', () => {
    expect(derivedFrom(root).get('docs/inbox/raznoe.md')).toEqual(['R-0001', 'R-0002']);
  });
});

describe('одна запись — несколько заметок', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-multinote-'));
    mkdirSync(join(root, 'docs', 'development', 'tasks'), { recursive: true });
    mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });
    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  tasks: tasks',
      'sources:',
      '  inbox: [docs/inbox]',
      ''
    ].join(LF), 'utf8');
    writeFileSync(join(root, 'docs', 'inbox', 'a.md'), '# Часть первая' + LF + LF + 'Кусок знания номер один.', 'utf8');
    writeFileSync(join(root, 'docs', 'inbox', 'b.md'), '# Часть вторая' + LF + LF + 'Кусок знания номер два.', 'utf8');

    createRecords(
      root,
      [{ key: 't', type: 'task', title: 'Собрать воедино', notes: ['docs/inbox/a.md', 'docs/inbox/b.md'] }],
      ['docs/inbox/a.md', 'docs/inbox/b.md']
    );
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('журнал называет обе заметки одной строкой', () => {
    const text = readFileSync(join(root, 'docs', 'development', 'tasks', 'T-0001-sobrat-voedino.md'), 'utf8');
    expect(text).toContain('заведена из docs/inbox/a.md, docs/inbox/b.md');
  });

  it('обе заметки знают, что из них выросла эта запись', () => {
    const derived = derivedFrom(root);
    expect(derived.get('docs/inbox/a.md')).toEqual(['T-0001']);
    expect(derived.get('docs/inbox/b.md')).toEqual(['T-0001']);
  });
});

describe('карта из входящего', () => {
  let root = '';
  let mapPath = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-mapnote-'));
    mkdirSync(join(root, 'docs', 'development', 'maps'), { recursive: true });
    mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });
    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  maps: maps',
      'sources:',
      '  inbox: [docs/inbox]',
      ''
    ].join(LF), 'utf8');

    const outcome = createRecords(
      root,
      [{
        key: 'm',
        type: 'map',
        title: 'Приём пациента',
        body: 'Со слов врача: приём — отдельная возможность системы.',
        capabilities: [{ id: 'priyom', title: 'Приём пациента' }],
        notes: []
      }],
      []
    );
    if (outcome.ok) mapPath = outcome.created[0]?.path ?? '';
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('заводит map-запись с прозой и блоком docdd-functional под ней', () => {
    const text = readFileSync(join(root, mapPath), 'utf8');
    expect(text).toContain('Со слов врача: приём — отдельная возможность системы.');
    expect(text).toContain('```docdd-functional');
    expect(text).toContain('"id": "priyom"');
    expect(text).toContain('status: draft');
  });

  it('блок разбирается той же машиной, что и карты, написанные руками', () => {
    const text = readFileSync(join(root, mapPath), 'utf8');
    const parsed = parseMapRecord(text);
    expect(parsed.problems).toEqual([]);
    expect(parsed.change.functional?.added?.capabilities).toEqual([{ id: 'priyom', title: 'Приём пациента' }]);
  });
});

describe('заметка от человека без markdown и файлов', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-note-write-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
    mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });
    // Манифест валиден, но без sources.inbox — склад просто не назван.
    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  requirements: requirements',
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

  it('склад не назван — понятный отказ, а не запись в никуда', () => {
    const outcome = createNote(root, { title: 'Заголовок', body: 'Текст.' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('inbox_not_configured');
  });
});

describe('заметка от человека: склад назван', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-note-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
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

  it('ложится тем же файлом .md, каким её положила бы модель', () => {
    const outcome = createNote(root, { title: 'Оплата картой', body: 'Надо принимать карты.' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.path).toBe('docs/inbox/oplata-kartoy.md');

    const text = readFileSync(join(root, outcome.path), 'utf8');
    expect(text).toBe('# Оплата картой' + LF + LF + 'Надо принимать карты.' + LF);

    // Тот же список, что видит экран: заметка от человека ничем не выделена.
    expect(inboxNotes(root).map((note) => note.title)).toContain('Оплата картой');
  });

  it('пустой заголовок или текст — отказ, а не пустой файл на складе', () => {
    const noTitle = createNote(root, { title: '  ', body: 'Текст.' });
    expect(noTitle.ok).toBe(false);
    if (!noTitle.ok) expect(noTitle.code).toBe('title_required');

    const noBody = createNote(root, { title: 'Заголовок', body: '  ' });
    expect(noBody.ok).toBe(false);
    if (!noBody.ok) expect(noBody.code).toBe('body_required');
  });

  it('имя занято — берёт следующее свободное, не затирает чужую заметку', () => {
    const first = createNote(root, { title: 'Повтор', body: 'Первая.' });
    const second = createNote(root, { title: 'Повтор', body: 'Вторая.' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.path).not.toBe(second.path);
    expect(readFileSync(join(root, first.path), 'utf8')).toContain('Первая.');
    expect(readFileSync(join(root, second.path), 'utf8')).toContain('Вторая.');
  });
});
