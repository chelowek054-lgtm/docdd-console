import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addTurn,
  appendClarifications,
  applyAnswers,
  createSession,
  finishSession,
  GRILL_THEMES,
  grillPlanBlock,
  grillPrompt,
  intentPrompt,
  isOpenSessionNote,
  openQuestions,
  parseSession,
  parseTurn,
  pendingThemes,
  readableNote,
  serializeSession,
  waitingQuestions,
  withSessionNote
} from '../server/lib/grill';
import { parseProposal } from '../server/lib/inbox';
import { inboxPrompt } from '../server/lib/prompt';
import { currentSession, grillRefusal, grillStep, intentQuestions, saveClarifications, type GrillModel } from '../server/utils/grill-service';
import { createNote, createRecords, inboxNotes } from '../server/utils/inbox-service';
import { loadIndex } from '../server/utils/index-service';

const docs = (name: string) => readFileSync(join(__dirname, '..', 'docs', name), 'utf8');
const GRILL = docs('prompts/grill.md');
const INTENT = docs('prompts/grill-intent.md');
const turnAnswer = (value: unknown) => `Вот вопросы.\n\`\`\`docdd-grill-turn\n${JSON.stringify(value)}\n\`\`\`\n`;
const FIRST = turnAnswer({ questions: [{ theme: 'problem', text: 'Кто пользуется?' }, { theme: 'outcome', text: 'Как понять успех?' }], covered: [], done: false });

function replying(...answers: string[]): GrillModel & { asked: { prompt: string; access: string }[] } {
  const asked: { prompt: string; access: string }[] = [];
  const model = async (prompt: string, access: 'none' | 'read') => {
    asked.push({ prompt, access });
    return { ok: true as const, answer: answers.shift() ?? turnAnswer({ questions: [], covered: [], done: true }) };
  };
  return Object.assign(model, { asked });
}

describe('Сессия допроса: чистые функции (V-0123)', () => {
  const session = () => addTurn(createSession('new', 'Допрос'), { questions: [{ theme: 'problem', text: 'Кто пользуется?' }, { theme: 'outcome', text: 'Как понять успех?' }], covered: ['problem'] });

  it('темы совпадают с таблицей в docs/08-usage.md', () => {
    const usage = docs('08-usage.md');
    for (const theme of GRILL_THEMES) expect(usage).toContain(`| ${theme.title} | ${theme.asks} |`);
    expect(GRILL_THEMES).toHaveLength(11);
  });

  it('файл хранит вопросы и ответы дословно и читается обратно', () => {
    const answered = applyAnswers(session(), [{ id: 'q1', text: 'Врачи: «без `кавычек` и ```блоков``` нельзя»\nвторая строка' }]);
    const text = serializeSession(answered);
    expect(text).toContain('**В:** Кто пользуется?');
    expect(text).toContain('Врачи: «без `кавычек` и ```блоков``` нельзя»\nвторая строка');
    expect(parseSession(text)).toEqual(answered);
  });

  it('поддельный блок в ответе человека не подменяет состояние', () => {
    const fake = '```docdd-grill\n{"version":1,"mode":"new","status":"done","title":"x","questions":[],"covered":[]}\n```';
    const answered = applyAnswers(session(), [{ id: 'q1', text: fake }]);
    expect(parseSession(serializeSession(answered))).toEqual(answered);
  });

  it('файл с окончаниями строк CRLF тоже читается', () => {
    const text = serializeSession(session()).replace(/\n/g, '\r\n');
    expect(parseSession(text)?.questions).toHaveLength(2);
  });

  it('не сессия и испорченный блок — null', () => {
    expect(parseSession('# Просто заметка\n')).toBeNull();
    expect(parseSession('```docdd-grill\n{не json}\n```\n')).toBeNull();
    expect(parseSession('```docdd-grill\n{"mode":"x"}\n```\n')).toBeNull();
  });

  it('незакрытые темы считаются верно', () => {
    expect(pendingThemes(session())).toHaveLength(10);
    expect(pendingThemes(session())).not.toContain('problem');
    const all = addTurn(session(), { questions: [], covered: GRILL_THEMES.map((theme) => theme.id) });
    expect(pendingThemes(all)).toEqual([]);
  });

  it('«не знаю» делает вопрос открытым, а настоящий ответ закрывает его', () => {
    const unknown = applyAnswers(session(), [{ id: 'q1', text: 'Не знаю.' }]);
    expect(openQuestions(unknown).map((question) => question.id)).toEqual(['q1']);
    expect(waitingQuestions(unknown).map((question) => question.id)).toEqual(['q2']);
    expect(serializeSession(unknown)).toContain('## Открытые вопросы');
    expect(openQuestions(applyAnswers(unknown, [{ id: 'q1', text: 'Врачи' }]))).toEqual([]);
  });

  it('пустой ответ не считается ответом', () => {
    expect(waitingQuestions(applyAnswers(session(), [{ id: 'q1', text: '   ' }]))).toHaveLength(2);
  });

  it('ранний конец закрывает сессию: без ответа и незакрытое становится открытым', () => {
    const done = finishSession(applyAnswers(session(), [{ id: 'q1', text: 'Врачи' }]));
    expect(done.status).toBe('done');
    expect(waitingQuestions(done)).toEqual([]);
    expect(openQuestions(done).map((question) => question.text)).toContain('Как понять успех?');
    expect(openQuestions(done)).toHaveLength(1 + 10);
    expect(finishSession(done)).toEqual(done);
  });

  it('разбор хода: непонятный ответ — причина, а не исключение', () => {
    expect(parseTurn('просто текст').ok).toBe(false);
    expect(parseTurn('```docdd-grill-turn\n{битый\n```').ok).toBe(false);
    expect(parseTurn('```docdd-grill-turn\nnull\n```').ok).toBe(false);
    expect(parseTurn(turnAnswer({ questions: [], covered: [] })).ok).toBe(false);
  });

  it('разбор хода: не больше пяти вопросов, чужие темы не закрываются', () => {
    const many = Array.from({ length: 8 }, (_, at) => ({ theme: 'problem', text: `В${at}` }));
    const parsed = parseTurn(turnAnswer({ questions: [...many, { text: '' }], covered: ['problem', 'выдумка', 1], done: false }));
    expect(parsed).toMatchObject({ ok: true, covered: ['problem'], done: false });
    if (parsed.ok) expect(parsed.questions).toHaveLength(5);
    const other = parseTurn(turnAnswer({ questions: [{ theme: 'выдумка', text: 'В' }], covered: [] }));
    if (other.ok) expect(other.questions[0]?.theme).toBe('other');
  });

  it('запрос: режим, темы, сказанное и незакрытое', () => {
    const answered = applyAnswers(session(), [{ id: 'q1', text: 'Врачи' }]);
    const prompt = grillPrompt(GRILL, answered);
    expect(prompt).toContain('Проект новый');
    expect(prompt).toContain('`feel` — Ощущения');
    expect(prompt).toContain('Ответ человека: Врачи');
    expect(prompt).toContain('`outcome`');
    expect(prompt).not.toContain('<!--');
    expect(prompt).not.toContain('Приложение подставляет');
    const existing = grillPrompt(GRILL, createSession('existing', 'Д'), [{ id: 'R-0001', type: 'requirement', title: 'Оплата' }]);
    expect(existing).toContain('Сначала прочитай его документы и код');
    expect(existing).toContain('`R-0001`');
  });
});

describe('Допрос на временном проекте (V-0123, V-0124, V-0125)', () => {
  let root: string;

  function project(inbox = true) {
    const dev = join(root, 'docs', 'development');
    mkdirSync(join(dev, 'requirements'), { recursive: true });
    writeFileSync(join(dev, 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: p',
      '  name: P',
      'paths:',
      '  requirements: requirements',
      '  tests: tests',
      '  tasks: tasks',
      '  decisions: decisions',
      '  design: design',
      '  maps: maps',
      '  phases: phases',
      ...(inbox ? ['sources:', '  inbox:', '    - docs/inbox'] : [])
    ].join('\n') + '\n');
  }

  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'docdd-grill-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  const start = (model: GrillModel, mode: 'new' | 'existing' = 'new') => grillStep(root, { action: 'start', mode }, GRILL, model, new Date('2026-11-08T10:00:00Z'));

  it('два хода пишут один файл, модель нового проекта без инструментов', async () => {
    project();
    const model = replying(FIRST, turnAnswer({ questions: [{ theme: 'scope', text: 'Чего не делаем?' }], covered: ['problem'], done: false }));
    const first = await start(model);
    if (!first.ok) throw new Error(first.message);
    expect(first.view.path).toBe('docs/inbox/grill-20261108-1000.md');
    expect(first.view.waiting).toHaveLength(2);
    expect(model.asked[0]?.access).toBe('none');

    const second = await grillStep(root, { action: 'answer', path: first.view.path, answers: [{ id: 'q1', text: 'Врачи' }, { id: 'q2', text: 'Не знаю' }] }, GRILL, model);
    if (!second.ok) throw new Error(second.message);
    expect(second.view.waiting.map((question) => question.text)).toEqual(['Чего не делаем?']);
    expect(second.view.open.map((question) => question.id)).toEqual(['q2']);
    expect(readdirSync(join(root, 'docs', 'inbox'))).toEqual(['grill-20261108-1000.md']);
    expect(model.asked[1]?.prompt).toContain('Ответ человека: Врачи');
  });

  it('обновление страницы: сессия читается из файла, повторный старт нового файла не заводит', async () => {
    project();
    const model = replying(FIRST);
    await start(model);
    expect(currentSession(root)?.waiting).toHaveLength(2);
    const again = await start(model);
    expect(again.ok && again.view.waiting).toHaveLength(2);
    expect(model.asked).toHaveLength(1);
    expect(readdirSync(join(root, 'docs', 'inbox'))).toHaveLength(1);
  });

  it('пока есть вопросы без ответа, модель не зовут', async () => {
    project();
    const model = replying(FIRST);
    const first = await start(model);
    if (!first.ok) throw new Error(first.message);
    const partial = await grillStep(root, { action: 'answer', path: first.view.path, answers: [{ id: 'q1', text: 'Врачи' }] }, GRILL, model);
    expect(partial.ok && partial.view.waiting).toHaveLength(1);
    expect(model.asked).toHaveLength(1);
  });

  it('сбой модели и непонятный ответ не теряют ответы, запрос можно повторить', async () => {
    project();
    const first = await start(replying(FIRST));
    if (!first.ok) throw new Error(first.message);
    const down: GrillModel = async () => ({ ok: false, failure: { code: 'unavailable', message: 'Claude Code не найден' } });
    const failed = await grillStep(root, { action: 'answer', path: first.view.path, answers: [{ id: 'q1', text: 'Врачи' }, { id: 'q2', text: 'Отчёт' }] }, GRILL, down);
    expect(failed).toMatchObject({ ok: false, code: 'llm_unavailable', message: 'Claude Code не найден' });
    expect(currentSession(root)?.session.questions[0]?.answer).toBe('Врачи');

    const garbled = await grillStep(root, { action: 'answer', path: first.view.path }, GRILL, replying('ерунда'));
    expect(garbled.ok && garbled.view.problem).toContain('docdd-grill-turn');
    expect(currentSession(root)?.session.questions).toHaveLength(2);

    const retried = await grillStep(root, { action: 'answer', path: first.view.path }, GRILL, replying(turnAnswer({ questions: [{ theme: 'feel', text: 'Каким ощущается?' }], covered: [] })));
    expect(retried.ok && retried.view.waiting).toHaveLength(1);
  });

  it('ранний конец не зовёт модель, и новых вопросов после него нет', async () => {
    project();
    const model = replying(FIRST);
    const first = await start(model);
    if (!first.ok) throw new Error(first.message);
    const done = await grillStep(root, { action: 'finish', path: first.view.path, answers: [{ id: 'q1', text: 'Врачи' }] }, GRILL, model);
    expect(done.ok && done.view.session.status).toBe('done');
    expect(done.ok && done.view.open.length).toBe(12);
    expect(model.asked).toHaveLength(1);
    await grillStep(root, { action: 'answer', path: first.view.path }, GRILL, model);
    expect(model.asked).toHaveLength(1);
  });

  it('модель сказала, что всё: сессия завершена', async () => {
    project();
    const done = await start(replying(turnAnswer({ questions: [], covered: GRILL_THEMES.map((theme) => theme.id), done: true })));
    expect(done.ok && done.view.session.status).toBe('done');
    expect(done.ok && done.view.open).toEqual([]);
  });

  it('подключённый проект: доступ только на чтение', async () => {
    project();
    const model = replying(FIRST);
    await start(model, 'existing');
    expect(model.asked[0]?.access).toBe('read');
    expect(model.asked[0]?.prompt).toContain('Сначала прочитай');
  });

  it('путь сессии не выходит за корень и за входящее', async () => {
    project();
    writeFileSync(join(root, 'grill-x.md'), 'чужой');
    mkdirSync(join(root, 'docs', 'inbox'), { recursive: true });
    writeFileSync(join(root, 'docs', 'inbox', 'note.md'), '# Заметка\n');
    const answer = (path: string) => grillRefusal(root, { action: 'answer', path });
    expect(answer('../../etc/grill-x.md')?.code).toBe('outside_root');
    expect(answer('grill-x.md')?.code).toBe('note_outside_inbox');
    expect(answer('docs/inbox/grill-none.md')?.code).toBe('note_not_found');
    expect(answer('docs/inbox/note.md')?.code).toBe('session_invalid');
    expect(grillRefusal(root, { action: 'answer' })?.code).toBe('path_required');
    expect(grillRefusal(root, { action: 'start', mode: 'x' as 'new' })?.code).toBe('mode_invalid');
    const outside = await grillStep(root, { action: 'answer', path: '../grill-x.md', answers: [{ id: 'q1', text: 'x' }] }, GRILL, replying());
    expect(outside).toMatchObject({ ok: false, code: 'outside_root' });
  });

  it('входящее не названо — понятный отказ', () => {
    project(false);
    expect(grillRefusal(root, { action: 'start', mode: 'new' })?.code).toBe('inbox_not_configured');
  });

  it('без модели — причина на месте, а сессия цела', async () => {
    project();
    const outcome = await start(async () => ({ ok: false, failure: { code: 'unavailable', message: 'Модель не подключена' } }));
    expect(outcome).toMatchObject({ ok: false, code: 'llm_unavailable', message: 'Модель не подключена' });
    expect(currentSession(root)?.session.questions).toEqual([]);
  });

  const SAMPLE = '```docdd-records\n' + JSON.stringify({
    records: [
      { key: 'karta', type: 'map', title: 'Приём пациента', body: 'Со слов человека.', vision: { problem: 'Врач ищет историю по бумагам', audience: 'Врачи', outcome: 'История на одном экране', not: 'Не биллинг' }, capabilities: [{ id: 'priyom', title: 'Приём', status: 'not_implemented' }, { id: 'istoriya', title: 'История приёмов', parent: 'priyom', status: 'not_implemented' }] },
      { key: 'tz', type: 'requirement', title: 'История приёмов на одном экране', body: 'Зачем: врач ищет по бумагам.\nЧто делаем: список приёмов.\nЧего не делаем: биллинг.\nГотово, когда: виден список.', links: { refines: [] } },
      { key: 'pr', type: 'verification', title: 'Список приёмов виден', body: 'Шаги: открыть карточку.\nОжидаемый результат: список.', links: { verifies: ['tz'] } },
      { key: 'ekran', type: 'design', title: 'Экран истории, строгий тон', body: 'Экран и тон интерфейса.' },
      { key: 'stek', type: 'decision', title: 'Берём PostgreSQL', body: 'Человек выбрал PostgreSQL: уже есть в больнице.' },
      { key: 'riski', type: 'design', title: 'Риски и открытые вопросы', body: 'Как понять успех?\nТема не закрыта: нагрузка.' },
      { key: 'zadacha', type: 'task', title: 'Список приёмов в карточке', change: 'feature', body: 'Сделать список.\n\n## Ожидаемый результат\n\nВрач видит приёмы.', links: { implements: ['tz'], affects: ['karta'] } },
      { key: 'faza', type: 'phase', title: 'Первый фронт работы', body: 'Первая фаза.', links: { covers: ['zadacha'] } }
    ]
  }) + '\n```';

  it('раскладка: запрос содержит всю сессию и требует все виды записей', async () => {
    project();
    const first = await start(replying(FIRST));
    if (!first.ok) throw new Error(first.message);
    await grillStep(root, { action: 'finish', path: first.view.path, answers: [{ id: 'q1', text: 'Врачи больницы №7' }] }, GRILL, replying());
    const note = inboxNotes(root).find((item) => item.path === first.view.path)!;
    const prompt = inboxPrompt(docs('prompts/inbox-plan.md'), [{ ...note, text: readableNote(note.text) }], [], [], null) + '\n\n' + grillPlanBlock(docs('prompts/grill-plan.md'));
    expect(prompt).toContain('Врачи больницы №7');
    expect(prompt).toContain('Как понять успех?');
    expect(prompt).toContain('Тема не закрыта');
    expect(prompt).not.toContain('docdd-grill\n');
    for (const need of ['vision', 'capabilities', 'Готово, когда', '`verification`', '`design`', '`decision`', 'Риски и открытые вопросы', '## Ожидаемый результат', '`phase`']) expect(prompt).toContain(need);
    expect(prompt).not.toContain('Приложение добавляет этот раздел');
  });

  it('раскладка: заводятся только черновики, каждая запись ведёт к заметке, ошибок проверки нет', async () => {
    project();
    const first = await start(replying(FIRST));
    if (!first.ok) throw new Error(first.message);
    await grillStep(root, { action: 'finish', path: first.view.path }, GRILL, replying());

    const parsed = parseProposal(SAMPLE);
    expect(parsed.problems).toEqual([]);
    expect(new Set(parsed.records.map((record) => record.type))).toEqual(new Set(['map', 'requirement', 'verification', 'design', 'decision', 'task', 'phase']));

    const created = createRecords(root, withSessionNote(parsed.records, first.view.path), [first.view.path]);
    if (!created.ok) throw new Error(created.message);
    expect(created.problems).toEqual([]);
    expect(created.created).toHaveLength(parsed.records.length);

    const index = loadIndex(root);
    for (const item of created.created) {
      const record = index.records.find((candidate) => candidate.id === item.id)!;
      expect(record.status).toBe({ task: 'backlog', phase: 'planned' }[record.type as string] ?? 'draft');
      expect(readFileSync(join(root, item.path), 'utf8')).toContain(`заведена из ${first.view.path}`);
    }
    expect(index.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(currentSession(root)).toBeNull();
    expect(readdirSync(join(root, 'docs', 'inbox', 'принятое'))).toEqual(['grill-20261108-1000.md']);
  });

  it('незавершённый допрос не считается заметкой для общего разбора', async () => {
    project();
    const first = await start(replying(FIRST));
    if (!first.ok) throw new Error(first.message);
    const note = inboxNotes(root).find((item) => item.path === first.view.path)!;
    expect(isOpenSessionNote(note.text)).toBe(true);
    expect(isOpenSessionNote('# Заметка\n')).toBe(false);
  });

  const intentNote = () => {
    const created = createNote(root, { title: 'История', body: 'Хочу историю приёмов' });
    if (!created.ok) throw new Error(created.message);
    return created.path;
  };

  it('короткий допрос: не больше 3 вопросов по заметке, модель без инструментов', async () => {
    project();
    const path = intentNote();
    const model = replying(turnAnswer({ questions: Array.from({ length: 6 }, (_, at) => ({ theme: 'scope', text: `В${at}` })), covered: [], done: false }));
    const asked = await intentQuestions(root, path, INTENT, model);
    expect(asked.ok && asked.questions).toHaveLength(3);
    expect(model.asked[0]?.access).toBe('none');
    expect(model.asked[0]?.prompt).toContain('Хочу историю приёмов');
    expect(model.asked[0]?.prompt).not.toContain('<!--');
  });

  it('короткий допрос: ясное намерение — пустой список', async () => {
    project();
    const asked = await intentQuestions(root, intentNote(), INTENT, replying(turnAnswer({ questions: [], covered: [], done: true })));
    expect(asked).toEqual({ ok: true, questions: [] });
  });

  it('короткий допрос: сбой и непонятный ответ не мешают разложить, отмена останавливает', async () => {
    project();
    const path = intentNote();
    const down = await intentQuestions(root, path, INTENT, async () => ({ ok: false, failure: { code: 'timeout', message: 'Не дождались' } }));
    expect(down).toEqual({ ok: true, questions: [], problem: 'Не дождались' });
    const garbled = await intentQuestions(root, path, INTENT, replying('ерунда'));
    expect(garbled.ok && garbled.questions).toEqual([]);
    const cancelled = await intentQuestions(root, path, INTENT, async () => ({ ok: false, failure: { code: 'cancelled', message: 'Отменено' } }));
    expect(cancelled.ok).toBe(false);
  });

  it('короткий допрос: ответы дописываются к заметке и попадают в запрос разбора', () => {
    project();
    const path = intentNote();
    const before = inboxNotes(root)[0]!.text;
    const skipped = inboxPrompt(docs('prompts/inbox-plan.md'), inboxNotes(root), [], [], null);

    expect(saveClarifications(root, path, [{ text: 'По чему поймём?', answer: 'Врач не открывает бумаги' }, { text: 'Без ответа', answer: ' ' }]).ok).toBe(true);
    const note = inboxNotes(root)[0]!;
    expect(note.text).toContain('## Уточнения');
    expect(note.text).toContain('**О:** Врач не открывает бумаги');
    expect(note.text).not.toContain('Без ответа');
    expect(inboxPrompt(docs('prompts/inbox-plan.md'), [note], [], [], null)).toContain('Врач не открывает бумаги');

    // «Без вопросов»: заметка не меняется, значит и запрос разбора прежний.
    expect(appendClarifications(before, [])).toBe(before);
    expect(skipped).toContain('Хочу историю приёмов');
    expect(skipped).not.toContain('## Уточнения');
  });

  it('заметка намерения должна лежать во входящем', () => {
    project();
    expect(saveClarifications(root, 'README.md', [{ text: 'В', answer: 'О' }])).toMatchObject({ ok: false, code: 'note_outside_inbox' });
    expect(saveClarifications(root, '../x.md', [{ text: 'В', answer: 'О' }])).toMatchObject({ ok: false, code: 'outside_root' });
  });

  it('запрос короткого допроса несёт вектор', () => {
    expect(intentPrompt(INTENT, 'Намерение', { problem: 'Проблема', not: 'Биллинг' })).toContain('Не делает: Биллинг');
    expect(intentPrompt(INTENT, 'Намерение', null)).toContain('Вектор проекта не записан');
  });
});
