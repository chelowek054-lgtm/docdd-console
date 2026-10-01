import { describe, expect, it } from 'vitest';

import { approvalOf, courseHistory, type CourseSource } from '../server/lib/course';
import { foldMaps, parseMapRecord, type MapChange } from '../server/lib/maps';
import { mapCapabilityMissing } from '../server/lib/rules';
import { codes, context, rec } from './helpers';

/**
 * Функциональная карта — источник правды: вектор проекта и история курса
 * (docs/07-maps.md, «Вектор проекта», «Источник правды и история курса»).
 */

describe('approvalOf — когда и кто подтвердил карту', () => {
  const body = (journal: string[]) => ['# Карта', '', '## Журнал', '', ...journal, ''].join('\n');

  it('берёт дату и роль из строки журнала, которой карта получила approved', () => {
    const journal = ['- 2026-09-01 · заведена · приложение', '- 2026-09-02 · подтверждён · architect'];
    expect(approvalOf(body(journal), '2026-09-05')).toEqual({ at: '2026-09-02', by: 'architect' });
  });

  it('карту возвращали в черновик и подтвердили снова — считается последнее подтверждение', () => {
    const journal = ['- 2026-09-02 · подтверждён · architect', '- 2026-09-03 · возвращён в черновик · architect', '- 2026-09-09 · подтверждён · reviewer'];
    expect(approvalOf(body(journal), '2026-09-09')).toEqual({ at: '2026-09-09', by: 'reviewer' });
  });

  it('нет строки — updated записи, а роль «не указана»: придумывать автора нельзя', () => {
    expect(approvalOf(body(['- 2026-09-01 · заведена · приложение']), '2026-09-05')).toEqual({ at: '2026-09-05', by: null });
    expect(approvalOf('просто текст', undefined)).toEqual({ at: '', by: null });
  });

  it('строка без роли — подтверждение без автора', () => {
    expect(approvalOf(body(['- 2026-09-02 · подтверждён']), undefined)).toEqual({ at: '2026-09-02', by: null });
  });
});

describe('courseHistory', () => {
  const source = (id: string, change: MapChange, at = '2026-09-01', by: string | null = 'architect'): CourseSource => ({
    id, title: `Карта ${id}`, approval: { at, by }, change
  });

  it('по записи на карту с функциональным блоком, от новых к старым; остальные карты — не курс', () => {
    const history = courseHistory([
      source('M-0001', { functional: { added: { capabilities: [{ id: 'a' }, { id: 'b' }] } } }, '2026-09-01'),
      source('M-0002', { codemap: { added: { modules: [{ id: 'x' }] } } }, '2026-09-02'),
      source('M-0003', { functional: { added: { capabilities: [{ id: 'c' }] } } }, '2026-09-03', null)
    ]);
    expect(history.map((entry) => [entry.map, entry.at, entry.by, entry.added])).toEqual([
      ['M-0003', '2026-09-03', null, 1],
      ['M-0001', '2026-09-01', 'architect', 2]
    ]);
  });

  it('считает новое, убранное, смену состояния и связи', () => {
    const history = courseHistory([
      source('M-0001', { functional: { added: { capabilities: [{ id: 'a' }, { id: 'b', status: 'partial' }, { id: 'c' }] } } }),
      source('M-0002', { functional: {
        added: {
          capabilities: [{ id: 'a', status: 'implemented' }, { id: 'b', status: 'partial' }, { id: 'd' }],
          relations: [{ from: 'a', to: 'b', type: 'depends' }]
        },
        removed: { capabilities: [{ id: 'c' }] }
      } }, '2026-09-02')
    ]);
    expect(history[0]).toMatchObject({ map: 'M-0002', added: 1, removed: 1, statusChanged: 1, relations: 1, vision: false });
  });

  it('смена вектора — отдельная пометка, даже когда возможностей карта не трогала', () => {
    const history = courseHistory([source('M-0001', { functional: { added: { vision: { problem: 'Зачем' } } } })]);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ vision: true, added: 0 });
  });

  it('карта без перемен (уточнила описание, ничего не сменила) в историю не попадает', () => {
    const history = courseHistory([
      source('M-0001', { functional: { added: { capabilities: [{ id: 'a', title: 'А' }] } } }),
      source('M-0002', { functional: { added: { capabilities: [{ id: 'a', title: 'А, точнее' }] } } }, '2026-09-02')
    ]);
    expect(history.map((entry) => entry.map)).toEqual(['M-0001']);
  });
});

describe('vision в карте', () => {
  const block = (change: unknown) => ['```docdd-functional', JSON.stringify(change), '```'].join('\n');

  it('проходит схему; незнакомое поле — нет', () => {
    const ok = parseMapRecord(block({ added: { vision: { problem: 'П', audience: 'Кому', outcome: 'Успех', not: 'Не делает' } } }));
    expect(ok.problems).toEqual([]);
    expect(ok.change.functional?.added?.vision?.problem).toBe('П');
    expect(parseMapRecord(block({ added: { vision: { goal: 'нет такого поля' } } })).problems).toHaveLength(1);
  });

  it('вектор один: последнее объявление заменяет прежнее целиком, а не склеивается', () => {
    const folded = foldMaps([
      { id: 'M-0001', change: { functional: { added: { vision: { problem: 'Старая', audience: 'Старым' } } } } },
      { id: 'M-0002', change: { functional: { added: { vision: { problem: 'Новая' } } } } }
    ]);
    expect(folded.functional.vision).toEqual({ problem: 'Новая', declaredBy: 'M-0002' });
  });

  it('вектора нет — null; карта без vision прежний не трогает', () => {
    expect(foldMaps([]).functional.vision).toBeNull();
    const folded = foldMaps([
      { id: 'M-0001', change: { functional: { added: { vision: { problem: 'П' } } } } },
      { id: 'M-0002', change: { functional: { added: { capabilities: [{ id: 'a' }] } } } }
    ]);
    expect(folded.functional.vision?.problem).toBe('П');
  });
});

describe('map_capability_missing', () => {
  const functionalBody = (capabilities: unknown[]) =>
    ['# К', '', '```docdd-functional', JSON.stringify({ added: { capabilities } }), '```', ''].join('\n');

  const feature = (status: string, affects: string[]) =>
    rec('T-0001', 'task', status, { links: { affects }, extra: { change: 'feature' } });

  it('срабатывает: функция дошла до in_review, а карты возможность не объявляют', () => {
    const map = rec('M-0001', 'map', 'approved', { body: '# Карта\n\n```docdd-codemap\n{"added":{"modules":[{"id":"a"}]}}\n```\n' });
    expect(codes(mapCapabilityMissing(context([map, feature('in_review', ['M-0001'])])))).toEqual(['map_capability_missing']);
    expect(codes(mapCapabilityMissing(context([feature('done', [])])))).toEqual(['map_capability_missing']);
  });

  it('молчит, когда одна из карт объявляет возможность', () => {
    const map = rec('M-0001', 'map', 'approved', { body: functionalBody([{ id: 'orders.pay', title: 'Оплата' }]) });
    expect(mapCapabilityMissing(context([map, feature('in_review', ['M-0001'])]))).toEqual([]);
  });

  it('молчит раньше in_review: карта-намерение на пачку задач пуста по замыслу', () => {
    for (const status of ['ready', 'in_progress']) {
      expect(mapCapabilityMissing(context([feature(status, [])])), status).toEqual([]);
    }
  });

  it('молчит на fix, rename и format', () => {
    const task = rec('T-0001', 'task', 'done', { extra: { change: 'fix' } });
    expect(mapCapabilityMissing(context([task]))).toEqual([]);
  });
});
