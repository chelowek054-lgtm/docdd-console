// Запрос «как есть» и проверка свидетельств в предложении (R-0078, docs/prompts/as-is.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseProposal } from '../server/lib/inbox';
import { asIsPrompt, evidenceProblems, type AsIsInput } from '../server/lib/prompt';

const template = readFileSync(join(__dirname, '..', 'docs', 'prompts', 'as-is.md'), 'utf8');
const input: AsIsInput = {
  modules: [{ id: 'cache', title: 'Кэш индекса', layer: 'lib', summary: 'держит индекс' }],
  screens: [{ id: '/login', title: 'Вход' }],
  sources: [{ id: 'users-json', kind: 'file' }],
  capabilities: [{ id: 'auth', title: 'Вход в систему' }],
  requirements: [{ id: 'R-0001', title: 'Вход по паролю' }]
};

describe('запрос «как есть»', () => {
  const prompt = asIsPrompt(template, input);
  it('подставляет устройство, стоящие возможности и требования; маркеров не остаётся', () => {
    expect(prompt).toContain('модуль `cache` — Кэш индекса (lib): держит индекс');
    expect(prompt).toContain('экран `/login` — Вход');
    expect(prompt).toContain('- `auth` — Вход в систему');
    expect(prompt).toContain('- R-0001: Вход по паролю');
    expect(prompt).not.toMatch(/<!-- [А-ЯЁ]+ -->/);
    expect(prompt).not.toContain('Приложение подставляет сюда');
  });
  it('просит implemented только за работающее, свидетельство и черновики; не планирование', () => {
    expect(prompt).toContain('implemented');
    expect(prompt).toContain('Свидетельство:');
    expect(prompt).toContain('не писать задач и фаз');
  });
  it('на проекте без карт и записей говорит об этом словами', () => {
    const empty = asIsPrompt(template, { modules: [], screens: [], sources: [], capabilities: [], requirements: [] });
    expect(empty).toContain('Карт устройства ещё нет');
    expect(empty).toContain('Возможностей пока нет.');
  });
  it('пример из запроса разбирается тем же разбором, что ответ модели', () => {
    const answer = '```docdd-records\n' + JSON.stringify({ records: [
      { key: 'karta', type: 'map', title: 'Возможности как есть', capabilities: [{ id: 'auth', title: 'Вход', status: 'implemented', note: 'Свидетельство: src/a.ts:2 — verify(' }] },
      { key: 'r1', type: 'requirement', title: 'Вход по паролю', body: 'Зачем.\nГотово, когда: человек входит. Возможность: auth. Свидетельство: src/a.ts:2 — verify(' }
    ] }) + '\n```';
    const parsed = parseProposal(answer);
    expect(parsed.problems).toEqual([]);
    expect(parsed.records.map((r) => r.type)).toEqual(['map', 'requirement']);
  });
});

describe('свидетельства в предложении', () => {
  const files: Record<string, string[]> = { 'src/a.ts': ['import x', 'export function login() {', '  return verifyPassword(a, b);', '}'] };
  const read = (path: string) => files[path] ?? null;
  const cap = (note: string) => [{ key: 'm', type: 'map', title: 'Карта', capabilities: [{ id: 'auth', note }] }];
  it('настоящие путь, строка и фрагмент — замечаний нет (фрагмент ищется в трёх соседних строках)', () => {
    expect(evidenceProblems(cap('Свидетельство: src/a.ts:2 — verifyPassword('), read)).toEqual([]);
  });
  it('выдуманный файл, строка вне файла и чужой фрагмент называются словами', () => {
    expect(evidenceProblems(cap('Свидетельство: src/nope.ts:1'), read)[0]).toMatch(/нет файла|такого файла нет/);
    expect(evidenceProblems(cap('Свидетельство: src/a.ts:99'), read)[0]).toMatch(/нет строки 99/);
    expect(evidenceProblems(cap('Свидетельство: src/a.ts:2 — dropDatabase('), read)[0]).toMatch(/нет «dropDatabase/);
  });
  it('два свидетельства в одной строке, диапазон строк и склеенные строки кода — честные, замечаний нет', () => {
    expect(evidenceProblems(cap('Свидетельство: src/a.ts:2 — export function login() { и src/a.ts:3 — return verifyPassword('), read)).toEqual([]);
    expect(evidenceProblems(cap('Свидетельство: src/a.ts:2-3 — export function login() { return verifyPassword(a, b); ... }'), read)).toEqual([]);
  });
  it('выдуманное начало фрагмента не проходит и после склейки', () => {
    expect(evidenceProblems(cap('Свидетельство: src/a.ts:2-3 — export function logout() { return dropDatabase(); }'), read)[0]).toMatch(/нет «export function logout/);
  });
  it('требование — по телу; запись без свидетельств замечаний не даёт', () => {
    expect(evidenceProblems([{ key: 'r', type: 'requirement', title: 'Т', body: 'Готово. Свидетельство: src/b.ts:3' }], read)[0]).toMatch(/требование «Т»/);
    expect(evidenceProblems([{ key: 'r', type: 'requirement', title: 'Т', body: 'Просто текст' }], read)).toEqual([]);
  });
});
