// V-0070
import { describe, expect, it } from 'vitest';

import { diffRecordTexts, visionDiff } from '../server/lib/record-diff';

/** R-0070: разница вектора проекта по четырём полям; старое зачёркнуто (del), новое подсвечено (add); задетые возможности. */

const LF = String.fromCharCode(10);
const mapText = (vision: Record<string, string> | null, status = 'review') => [
  '---', 'id: M-0005', 'type: map', 'title: Курс', `status: ${status}`, 'created: 2026-10-01', 'updated: 2026-10-01', '---', '',
  '# Курс', '', '```docdd-functional', JSON.stringify({ added: vision ? { vision } : { capabilities: [] } }), '```', ''
].join(LF);

const V1 = { problem: 'Код уходит вперёд документов', audience: 'Команды разработки', outcome: 'Документ ведёт код', not: 'Не пишет код сам' };
const caps = [
  { id: 'doc-flow', title: 'Подтверждение документов', summary: 'Документ ведёт код' },
  { id: 'billing', title: 'Оплата картой', summary: 'Приём платежей' }
];

describe('вектор по четырём полям', () => {
  it('меняется одно поле — changed только у него, остальные не изменены', () => {
    const diff = diffRecordTexts('M-0005', 'map', mapText(V1, 'approved'), mapText({ ...V1, audience: 'Команды и аналитики' }), caps);
    expect(diff.kind).toBe('vision');
    expect(diff.vision?.fields.map((item) => [item.field, item.changed])).toEqual([
      ['Проблема', false], ['Для кого', false], ['Успех', false], ['Чего не делает', false]
    ].map(([field], index) => [field, index === 1]));
  });

  it('старое — в «было» (del), новое — в «станет» (add); общие строки в обоих', () => {
    const diff = diffRecordTexts('M-0005', 'map', mapText(V1, 'approved'), mapText({ ...V1, not: 'Не деплоит' }), caps);
    const field = diff.vision?.fields.find((item) => item.field === 'Чего не делает');
    expect(field?.before).toEqual([{ kind: 'del', text: 'Не пишет код сам' }]);
    expect(field?.after).toEqual([{ kind: 'add', text: 'Не деплоит' }]);
    const problem = diff.vision?.fields.find((item) => item.field === 'Проблема');
    expect(problem?.before).toEqual([{ kind: 'same', text: V1.problem }]);
  });

  it('вектор появился впервые — все поля «новое»', () => {
    const fields = visionDiff(undefined, V1, []).fields;
    expect(fields.every((item) => item.changed && item.before.length === 0 && item.after.length === 1)).toBe(true);
  });

  it('частично заполненный вектор не падает', () => {
    expect(visionDiff({ problem: 'А' }, { problem: 'Б' }, []).fields.map((item) => item.changed)).toEqual([true, false, false, false]);
  });
});

describe('какие возможности задевает', () => {
  it('называет возможности, чьи слова встречаются в изменённых полях', () => {
    const diff = diffRecordTexts('M-0005', 'map', mapText(V1, 'approved'), mapText({ ...V1, outcome: 'Документ строго ведёт любой код' }), caps);
    expect(diff.vision?.touched.map((item) => item.id)).toEqual(['doc-flow']);
  });
  it('не изменилось ничего — никого не задевает', () => {
    const diff = diffRecordTexts('M-0005', 'map', mapText(V1, 'approved'), mapText(V1), caps);
    expect(diff.vision?.touched).toEqual([]);
  });
  it('карта без вектора — обычная текстовая разница', () => {
    expect(diffRecordTexts('M-0005', 'map', mapText(null, 'approved'), mapText(null)).kind).toBe('text');
  });
  it('вектор бывает только у карты: у остальных типов vision не строится', () => {
    expect(diffRecordTexts('M-0005', 'task', mapText(V1, 'approved'), mapText(V1)).vision).toBeUndefined();
  });
});
