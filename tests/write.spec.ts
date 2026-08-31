import { describe, expect, it } from 'vitest';

import { applyFieldPatch, applyStatusChange } from '../server/lib/actions';
import { parseRecord } from '../server/lib/parse';
import { appendJournal, applyFrontMatter, joinRecord, splitRecord, verifyWrite } from '../server/lib/write';

/**
 * Запись трогает файлы человека, поэтому проверяется придирчиво: сохранение
 * незнакомых полей, порядка ключей, перевода строки — и сторож, который ловит
 * то, что всё-таки просочилось.
 */

const LF = String.fromCharCode(10);

const source = [
  '---',
  'id: T-0007',
  'type: task',
  'title: Вынести веса модели клёва',
  'status: ready',
  'owner: dev',
  'created: 2026-08-01',
  'updated: 2026-08-01',
  'phase: P-0007',
  'links:',
  '  implements: [R-0004]',
  '  documents: [D-0003]',
  'tags: [client, bite-model]',
  'своё_поле: значение проекта',
  '---',
  '',
  '# Вынести веса модели клёва',
  '',
  'Текст задачи, который принадлежит человеку.',
  '',
  '## Журнал',
  '',
  '- 2026-08-01 · готова к работе · architect',
  ''
].join(LF);

const file = () => splitRecord(source)!;

describe('splitRecord', () => {
  it('делит файл на front matter и тело, не теряя ни байта', () => {
    const parts = file();
    expect(joinRecord(parts)).toBe(source);
  });

  it('запоминает перевод строки', () => {
    expect(splitRecord(source.replace(/\n/g, '\r\n'))?.eol).toBe('crlf');
    expect(file().eol).toBe('lf');
  });

  it('файл без front matter записью не считает', () => {
    expect(splitRecord('# Просто заголовок\n')).toBeNull();
  });
});

describe('applyFrontMatter', () => {
  it('меняет значение на месте, не трогая соседей', () => {
    const next = applyFrontMatter(file(), { status: 'in_progress' });
    const lines = next.frontMatter.split(LF);
    expect(lines[3]).toBe('status: in_progress');
    expect(lines[2]).toBe('title: Вынести веса модели клёва');
    expect(lines[4]).toBe('owner: dev');
  });

  it('сохраняет незнакомое поле и порядок ключей', () => {
    const next = joinRecord(applyFrontMatter(file(), { status: 'done', updated: '2026-08-30' }));
    const parsed = parseRecord(next, { path: 'tasks/T-0007.md' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.record.data['своё_поле']).toBe('значение проекта');
    expect(Object.keys(parsed.record.data)).toEqual([
      'id', 'type', 'title', 'status', 'owner', 'created', 'updated', 'phase', 'links', 'tags', 'своё_поле'
    ]);
  });

  it('заменяет вложенный блок links целиком и не съедает следующий ключ', () => {
    const next = applyFrontMatter(file(), { links: { implements: ['R-0004', 'R-0005'] } });
    const lines = next.frontMatter.split(LF);
    expect(lines).toContain('links:');
    expect(lines).toContain('  implements: [R-0004, R-0005]');
    expect(lines).not.toContain('  documents: [D-0003]');
    expect(lines).toContain('tags: [client, bite-model]');
    expect(lines).toContain('своё_поле: значение проекта');
  });

  it('пустые связи записывает как {}, а не бросает ключ висеть', () => {
    const next = applyFrontMatter(file(), { links: {} });
    expect(next.frontMatter.split(LF)).toContain('links: {}');
  });

  it('добавляет поле, которого не было, в конец front matter', () => {
    const withoutOwner = splitRecord(source.replace('owner: dev' + LF, ''))!;
    const next = applyFrontMatter(withoutOwner, { owner: 'architect' });
    expect(next.frontMatter.split(LF).at(-1)).toBe('owner: architect');
  });

  it('удаляет поле, когда значение снято', () => {
    const next = applyFrontMatter(file(), { owner: null });
    expect(next.frontMatter).not.toContain('owner:');
    expect(next.frontMatter).toContain('created: 2026-08-01');
  });

  it('перевод строки CRLF остаётся CRLF', () => {
    const crlf = splitRecord(source.replace(/\n/g, '\r\n'))!;
    const next = joinRecord(applyFrontMatter(crlf, { status: 'in_progress' }));
    expect(next).toContain('\r\n');
    expect(next.split('\r\n').length).toBe(source.split(LF).length);
  });
});

describe('appendJournal', () => {
  it('дописывает строку в конец раздела', () => {
    const next = appendJournal(file(), '- 2026-08-30 · в разработку · architect');
    const lines = next.body.split(LF);
    const at = lines.indexOf('- 2026-08-01 · готова к работе · architect');
    expect(lines[at + 1]).toBe('- 2026-08-30 · в разработку · architect');
  });

  it('создаёт раздел, если журнала не было', () => {
    const withoutJournal = splitRecord(source.slice(0, source.indexOf('## Журнал')))!;
    const next = appendJournal(withoutJournal, '- 2026-08-30 · в разработку · architect');
    expect(next.body).toContain('## Журнал');
    expect(next.body).toContain('Текст задачи, который принадлежит человеку.');
  });
});

describe('сторож тела документа', () => {
  it('пропускает законную смену статуса', () => {
    const outcome = applyStatusChange(source, { status: 'in_progress', actor: 'architect', today: '2026-08-30' });
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('status: in_progress');
    expect(outcome.text).toContain('- 2026-08-30 · в разработку · architect');
  });

  it('ловит переписанный абзац', () => {
    const spoiled = source.replace('Текст задачи, который принадлежит человеку.', 'Текст, переписанный приложением.');
    const problems = verifyWrite(source, spoiled, { allowedFields: ['status', 'updated'] });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain('Тело документа');
  });

  it('ловит удалённый раздел', () => {
    const cut = source.replace('Текст задачи, который принадлежит человеку.' + LF, '');
    const problems = verifyWrite(source, cut, { allowedFields: ['status', 'updated'] });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('ловит смену перевода строки', () => {
    const problems = verifyWrite(source, source.replace(/\n/g, '\r\n'), { allowedFields: ['status'] });
    expect(problems.some((problem) => problem.includes('Перевод строки'))).toBe(true);
  });

  it('ловит правку поля, которого действию менять нельзя', () => {
    const spoiled = source.replace('id: T-0007', 'id: T-0008');
    const problems = verifyWrite(source, spoiled, { allowedFields: ['status', 'updated'] });
    expect(problems.some((problem) => problem.includes('`id`'))).toBe(true);
  });

  it('ловит потерянное незнакомое поле', () => {
    const spoiled = source.replace('своё_поле: значение проекта' + LF, '');
    const problems = verifyWrite(source, spoiled, { allowedFields: ['status', 'updated'] });
    expect(problems.some((problem) => problem.includes('своё_поле'))).toBe(true);
  });

  it('ловит переставленный порядок ключей', () => {
    const spoiled = source
      .replace('status: ready' + LF, '')
      .replace('phase: P-0007', 'phase: P-0007' + LF + 'status: ready');
    const problems = verifyWrite(source, spoiled, { allowedFields: ['status', 'updated'] });
    expect(problems.some((problem) => problem.includes('Порядок ключей'))).toBe(true);
  });

  it('ловит лишнюю строку в журнале: одно действие — одна запись', () => {
    const line = '- 2026-08-30 · в разработку · architect';
    const spoiled = source.replace(
      '- 2026-08-01 · готова к работе · architect',
      '- 2026-08-01 · готова к работе · architect' + LF + line + LF + line
    );
    const problems = verifyWrite(source, spoiled, { allowedFields: ['status'], addedJournalLine: line });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('не пускает правку тела, когда действие журнала не пишет', () => {
    const spoiled = source.replace('Текст задачи', 'Иной текст задачи');
    const problems = verifyWrite(source, spoiled, { allowedFields: ['owner'] });
    expect(problems[0]).toContain('не добавляет строку в журнал');
  });
});

describe('applyFieldPatch', () => {
  it('меняет разрешённые поля и не пишет в журнал', () => {
    const outcome = applyFieldPatch(source, { owner: 'architect', tags: ['client'] }, '2026-08-30');
    expect(outcome.problems).toEqual([]);
    expect(outcome.journal).toBeUndefined();
    expect(outcome.text).toContain('owner: architect');
    expect(outcome.text).toContain('tags: [client]');
    expect(outcome.text).toContain('updated: 2026-08-30');
    expect(outcome.text).toContain('- 2026-08-01 · готова к работе · architect');
  });

  it('меняет `change`: правило про карту должно выполняться через приложение', () => {
    const outcome = applyFieldPatch(source, { change: 'feature' }, '2026-08-30');
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('change: feature');
    expect(outcome.text).toContain('Текст задачи, который принадлежит человеку.');
  });

  it('меняет связи, не трогая тело', () => {
    const outcome = applyFieldPatch(source, { links: { implements: ['R-0009'] } }, '2026-08-30');
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('  implements: [R-0009]');
    expect(outcome.text).toContain('Текст задачи, который принадлежит человеку.');
  });
});

describe('дифф после смены статуса', () => {
  it('две-три строки, как обещано в фазе 3', () => {
    const outcome = applyStatusChange(source, { status: 'in_progress', actor: 'architect', today: '2026-08-30' });
    const before = source.split(LF);
    const after = outcome.text.split(LF);

    let changed = 0;
    for (let i = 0; i < Math.max(before.length, after.length); i += 1) {
      if (before[i] !== after[i]) changed += 1;
    }
    // status, updated и добавленная строка журнала — дальше расхождение только
    // из-за сдвига на одну строку, поэтому считаем по множествам.
    const added = after.filter((line) => !before.includes(line));
    const removed = before.filter((line) => !after.includes(line));
    expect(added.length).toBe(3);
    expect(removed.length).toBe(2);
    expect(changed).toBeGreaterThan(0);
  });
});
