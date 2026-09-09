import { describe, expect, it } from 'vitest';

import {
  checkEvidence,
  collapse,
  evidenceClaims,
  foldMaps,
  mapDraftText,
  parseMapRecord,
  type MapChange
} from '../server/lib/maps';
import { changeMissing, checkMaps, taskMapsUnapproved } from '../server/lib/rules';
import { codes, context, rec } from './helpers';

/**
 * Карта — документ, а не отчёт: она подтверждается до кода, а потом сверяется с
 * ним по свидетельствам (docs/07-maps.md). Проверяется и то и другое.
 */

const LF = String.fromCharCode(10);

function body(structure: string, json: unknown): string {
  return [
    '# Карта',
    '',
    'Что меняется в устройстве.',
    '',
    '```docdd-' + structure,
    JSON.stringify(json, null, 2),
    '```',
    ''
  ].join(LF);
}

const import1 = {
  from: 'a.ts',
  to: 'b.ts',
  evidence: { path: 'a.ts', line: 2, fragment: "import { b } from './b'" }
};

describe('parseMapRecord', () => {
  it('разбирает блок и отдаёт структуру', () => {
    const parsed = parseMapRecord(body('codemap', { added: { imports: [import1] } }));
    expect(parsed.problems).toEqual([]);
    expect(parsed.present).toEqual(['codemap']);
    expect(parsed.change.codemap?.added?.imports).toHaveLength(1);
  });

  it('отсутствующий блок означает «структура не меняется»', () => {
    const parsed = parseMapRecord(body('codemap', {}));
    expect(parsed.present).toEqual(['codemap']);
    expect(parsed.change.dataflow).toBeUndefined();
    expect(parsed.problems).toEqual([]);
  });

  it('разбирает три структуры разом', () => {
    const text = [
      body('codemap', { added: { imports: [import1] } }),
      body('dataflow', { added: { sources: [{ id: 'db', kind: 'db' }] } }),
      body('userflow', { added: { screens: [{ id: '/' }] } })
    ].join(LF);
    const parsed = parseMapRecord(text);
    expect(parsed.present).toEqual(['codemap', 'dataflow', 'userflow']);
    expect(parsed.problems).toEqual([]);
  });

  it('битый JSON называет причину, а не молчит', () => {
    const text = ['```docdd-codemap', '{ не json', '```'].join(LF);
    const parsed = parseMapRecord(text);
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.problems[0]?.structure).toBe('codemap');
  });

  it('в карту не попадает то, что не прошло схему', () => {
    // Импорт без свидетельства — мнение, а не утверждение.
    const parsed = parseMapRecord(body('codemap', { added: { imports: [{ from: 'a.ts', to: 'b.ts' }] } }));
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.change.codemap).toBeUndefined();
  });

  it('незнакомый вид источника не проходит: чужое лучше не назвать вовсе', () => {
    const parsed = parseMapRecord(body('dataflow', { added: { sources: [{ id: 'x', kind: 'блокчейн' }] } }));
    expect(parsed.problems).toHaveLength(1);
  });

  it('разбирает функциональную карту — четвёртый вид поверх реестра', () => {
    const parsed = parseMapRecord(body('functional', { added: { capabilities: [{ id: 'orders', title: 'Заказы' }] } }));
    expect(parsed.problems).toEqual([]);
    expect(parsed.present).toEqual(['functional']);
    expect(parsed.change.functional?.added?.capabilities).toEqual([{ id: 'orders', title: 'Заказы' }]);
  });

  it('разбирает блок `docdd-skipped» — файл, который в карту не идёт, и причина', () => {
    const text = [
      body('codemap', { added: { imports: [import1] } }),
      body('skipped', { files: [{ path: 'README.md', why: 'документ, не модуль' }] })
    ].join(LF);
    const parsed = parseMapRecord(text);
    expect(parsed.problems).toEqual([]);
    expect(parsed.change.skipped).toEqual([{ path: 'README.md', why: 'документ, не модуль' }]);
  });
});

describe('mapDraftText', () => {
  const change: MapChange = {
    codemap: { added: { imports: [import1] } },
    skipped: [{ path: 'README.md', why: 'документ, не модуль' }]
  };

  it('несёт блок `docdd-skipped` в сохранённый черновик', () => {
    // Не структура, а решение — но markDescribed() (server/utils/
    // inventory-service.ts) в момент подтверждения читает именно этот файл,
    // а не ответ модели: не попал сюда — файл вернётся в очередь бесконечно.
    const text = mapDraftText('M-0007', 'Карта', change, ['codemap'], '2026-09-08');
    const parsed = parseMapRecord(text);
    expect(parsed.change.skipped).toEqual([{ path: 'README.md', why: 'документ, не модуль' }]);
  });

  it('пропущенных файлов нет — блока в черновике тоже нет', () => {
    const text = mapDraftText('M-0007', 'Карта', { codemap: change.codemap }, ['codemap'], '2026-09-08');
    expect(text).not.toContain('docdd-skipped');
  });
});

describe('checkEvidence', () => {
  const file = ['первая строка', "import { b } from './b'", 'третья строка'].join(LF);

  it('находит фрагмент на указанной строке', () => {
    expect(checkEvidence({ path: 'a.ts', line: 2, fragment: "from './b'" }, file, 'added')).toBe('ok');
  });

  it('прощает сдвиг на пару строк', () => {
    expect(checkEvidence({ path: 'a.ts', line: 4, fragment: "from './b'" }, file, 'added')).toBe('ok');
  });

  it('не прощает переезд в другой файл', () => {
    expect(checkEvidence({ path: 'a.ts', line: 40, fragment: "from './b'" }, file, 'added')).toBe('stale');
  });

  it('отличает пропавший файл от уехавшей строки', () => {
    expect(checkEvidence({ path: 'a.ts', line: 2, fragment: 'что угодно' }, null, 'added')).toBe('missing');
    expect(checkEvidence({ path: 'a.ts', line: 2, fragment: 'чего нет' }, file, 'added')).toBe('stale');
  });

  it('убранное считается сделанным, когда фрагмента больше нет', () => {
    expect(checkEvidence({ path: 'a.ts', line: 2, fragment: 'исчезло' }, file, 'removed')).toBe('ok');
    expect(checkEvidence({ path: 'a.ts', line: 2, fragment: 'что угодно' }, null, 'removed')).toBe('ok');
  });

  it('убранное, оставшееся на месте, — расхождение', () => {
    expect(checkEvidence({ path: 'a.ts', line: 2, fragment: "from './b'" }, file, 'removed')).toBe('still_present');
  });
});

describe('evidenceClaims', () => {
  it('собирает утверждения всех трёх структур с обеих сторон', () => {
    const change: MapChange = {
      codemap: { added: { imports: [import1] }, removed: { imports: [import1] } },
      dataflow: {
        added: {
          flows: [{ from: 'a.ts', to: 'db', direction: 'write', evidence: import1.evidence }]
        }
      },
      userflow: {
        added: {
          calls: [{ from: '/', to: 'GET /api/x', evidence: import1.evidence }]
        }
      }
    };
    const claims = evidenceClaims(change);
    expect(claims).toHaveLength(4);
    expect(claims.filter((claim) => claim.side === 'removed')).toHaveLength(1);
  });

  it('у функциональной карты утверждений для сверки нет вовсе', () => {
    // Не забыли добавить свидетельство — у вида его в принципе не бывает:
    // подтверждается человеком, а не построчной сверкой с файлом.
    const change: MapChange = {
      functional: { added: { capabilities: [{ id: 'orders', title: 'Заказы' }] } }
    };
    expect(evidenceClaims(change)).toEqual([]);
  });
});

describe('checkMaps', () => {
  const mapRecord = (id: string, status: string, text: string, extra?: Record<string, unknown>) =>
    rec(id, 'map', status, { body: text, section: 'maps', path: `docs/development/maps/${id}.md`, extra });

  it('map_invalid: карту, которую нельзя разобрать, называет по имени', () => {
    const record = mapRecord('M-0001', 'approved', ['```docdd-codemap', '{ битый', '```'].join(LF));
    expect(codes(checkMaps(context([record])))).toEqual(['map_invalid']);
  });

  it('но отставленную (заменена, отменена) карту с той же бедой — уже не называет', () => {
    // Форма карты, которую нельзя разобрать, никого не вводит в заблуждение,
    // если карта уже не читается как текущая — чинить в ней нечего.
    const superseded = mapRecord('M-0001', 'superseded', ['```docdd-codemap', '{ битый', '```'].join(LF));
    expect(checkMaps(context([superseded]))).toEqual([]);

    const dropped = mapRecord('M-0002', 'dropped', ['```docdd-codemap', '{ битый', '```'].join(LF));
    expect(checkMaps(context([dropped]))).toEqual([]);
  });

  it('молчит на карте-намерении: задача ещё не закрыта, кода нет', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }));
    const task = rec('T-0001', 'task', 'in_progress', { links: { affects: ['M-0001'] } });
    expect(checkMaps(context([map, task]))).toEqual([]);
  });

  it('map_evidence_missing: задача закрыта, а файла нет', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }));
    const task = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    expect(codes(checkMaps(context([map, task])))).toEqual(['map_evidence_missing']);
  });

  it('map_evidence_stale: файл есть, а строки в нём нет', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }));
    const task = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    const ctx = context([map, task], { sources: { 'a.ts': 'совсем другой текст' } });
    expect(codes(checkMaps(ctx))).toEqual(['map_evidence_stale']);
  });

  it('молчит, когда код сошёлся с картой', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }));
    const task = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    const ctx = context([map, task], { sources: { 'a.ts': [' ', import1.evidence.fragment].join(LF) } });
    expect(checkMaps(ctx)).toEqual([]);
  });

  it('map_drift: объявлено убранным, а на месте', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { removed: { imports: [import1] } }));
    const task = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    const ctx = context([map, task], { sources: { 'a.ts': [' ', import1.evidence.fragment].join(LF) } });
    expect(codes(checkMaps(ctx))).toEqual(['map_drift']);
  });

  it('неподтверждённую карту не сверяет: это ещё не устройство проекта', () => {
    const map = mapRecord('M-0001', 'draft', body('codemap', { added: { imports: [import1] } }));
    expect(checkMaps(context([map]))).toEqual([]);
  });

  it('карту без единой задачи сверяет сразу — так уже описывают существующий код', () => {
    // Ни одна задача не ссылается на M-0001: `settled` находит пустой список
    // задач и, что все они закрыты, — верно вакуумно. Так и должно быть для
    // карты, заведённой «Обновить карты» по уже написанному коду.
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }));
    expect(codes(checkMaps(context([map])))).toEqual(['map_evidence_missing']);
  });

  it('intent: true — не сверяет карту нового проекта, даже без единой задачи', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }), { intent: true });
    expect(checkMaps(context([map]))).toEqual([]);
  });

  it('функциональную карту не сверяет никогда — ей нечего предъявить как свидетельство', () => {
    // Без единой задачи и без intent: у обычной карты это дало бы
    // map_evidence_missing (вакуумная истинность settled). У функциональной —
    // сверять просто нечего, evidenceClaims для неё всегда пуст.
    const map = mapRecord('M-0001', 'approved', body('functional', { added: { capabilities: [{ id: 'orders' }] } }));
    expect(checkMaps(context([map]))).toEqual([]);
  });

  it('intent: true сильнее закрытой задачи — план остаётся планом, пока сам не скажешь иначе', () => {
    const map = mapRecord('M-0001', 'approved', body('codemap', { added: { imports: [import1] } }), { intent: true });
    const task = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    expect(checkMaps(context([map, task]))).toEqual([]);
  });
});

describe('task_maps_unapproved', () => {
  const draft = rec('M-0001', 'map', 'draft', { section: 'maps' });
  const approved = rec('M-0001', 'map', 'approved', { section: 'maps' });

  it('срабатывает, когда карта не подтверждена', () => {
    const task = rec('T-0001', 'task', 'ready', {
      links: { implements: ['R-0001'], affects: ['M-0001'] },
      extra: { change: 'feature' }
    });
    expect(codes(taskMapsUnapproved(context([draft, task])))).toEqual(['task_maps_unapproved']);
  });

  it('срабатывает, когда feature не меняет ни одной карты', () => {
    const task = rec('T-0001', 'task', 'ready', { extra: { change: 'feature' } });
    const found = taskMapsUnapproved(context([task]));
    expect(codes(found)).toEqual(['task_maps_unapproved']);
    expect(found[0]?.message).toContain('назовите изменение честнее');
  });

  it('молчит, когда карта подтверждена', () => {
    const task = rec('T-0001', 'task', 'in_progress', {
      links: { affects: ['M-0001'] },
      extra: { change: 'feature' }
    });
    expect(taskMapsUnapproved(context([approved, task]))).toEqual([]);
  });

  it('молчит на fix, rename и format: исключение записано в самой задаче', () => {
    for (const kind of ['fix', 'rename', 'format']) {
      const task = rec('T-0001', 'task', 'ready', { extra: { change: kind } });
      expect(taskMapsUnapproved(context([task])), kind).toEqual([]);
    }
  });

  it('молчит на задаче в backlog: до ready требовать нечего', () => {
    const task = rec('T-0001', 'task', 'backlog', { extra: { change: 'feature' } });
    expect(taskMapsUnapproved(context([task]))).toEqual([]);
  });
});

describe('change_missing', () => {
  it('срабатывает, когда не сказано, что за изменение', () => {
    const task = rec('T-0001', 'task', 'ready');
    expect(codes(changeMissing(context([task])))).toEqual(['change_missing']);
  });

  it('молчит, когда сказано', () => {
    const task = rec('T-0001', 'task', 'ready', { extra: { change: 'fix' } });
    expect(changeMissing(context([task]))).toEqual([]);
  });

  it('молчит на задаче в backlog', () => {
    expect(changeMissing(context([rec('T-0001', 'task', 'backlog')]))).toEqual([]);
  });
});

describe('foldMaps', () => {
  const added = (id: string): MapChange => ({
    codemap: { added: { modules: [{ id }] } }
  });

  it('складывает добавленное в порядке подтверждения', () => {
    const map = foldMaps([
      { id: 'M-0001', change: added('a.ts') },
      { id: 'M-0002', change: added('b.ts') }
    ]);
    expect(map.codemap.modules.map((item) => item.id)).toEqual(['a.ts', 'b.ts']);
    expect(map.from).toEqual(['M-0001', 'M-0002']);
  });

  it('убирает то, что объявлено убранным', () => {
    const map = foldMaps([
      { id: 'M-0001', change: added('a.ts') },
      { id: 'M-0002', change: { codemap: { removed: { modules: [{ id: 'a.ts' }] } } } }
    ]);
    expect(map.codemap.modules).toEqual([]);
  });

  it('повторное объявление уточняет, а не удваивает', () => {
    const map = foldMaps([
      { id: 'M-0001', change: { codemap: { added: { modules: [{ id: 'a.ts', title: 'Было' }] } } } },
      { id: 'M-0002', change: { codemap: { added: { modules: [{ id: 'a.ts', title: 'Стало' }] } } } }
    ]);
    expect(map.codemap.modules).toHaveLength(1);
    expect(map.codemap.modules[0]?.title).toBe('Стало');
  });

  it('пустой список даёт пустую картину, а не ошибку', () => {
    const map = foldMaps([]);
    expect(map.codemap.modules).toEqual([]);
    expect(map.userflow.screens).toEqual([]);
    expect(map.from).toEqual([]);
  });

  it('складывает функциональную карту тем же приёмом, без свидетельства', () => {
    const map = foldMaps([
      { id: 'M-0001', change: { functional: { added: { capabilities: [{ id: 'orders', title: 'Заказы' }] } } } },
      {
        id: 'M-0002',
        change: {
          functional: {
            added: { capabilities: [{ id: 'orders.pay', title: 'Оплата', parent: 'orders' }] }
          }
        }
      }
    ]);
    expect(map.functional.capabilities.map((item) => item.id)).toEqual(['orders', 'orders.pay']);
  });
});

describe('схлопывание жалоб схемы', () => {
  it('одна беда во всех элементах списка называется один раз', () => {
    const issues = Array.from({ length: 30 }, (_, index) =>
      `Незнакомое поле \`path\` в \`added.modules[${index}]\`: здесь список полей закрыт контрактом.`
    );

    const collapsed = collapse(issues);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toContain('added.modules[]');
    expect(collapsed[0]).toContain('×30');
  });

  it('разные беды остаются разными', () => {
    const collapsed = collapse([
      'Не хватает обязательного поля `direction` в `added.flows[0]`.',
      'Незнакомое поле `what` в `added.flows[0]`.',
      'Не хватает обязательного поля `direction` в `added.flows[1]`.'
    ]);
    expect(collapsed).toHaveLength(2);
  });

  it('длинный список обрезается, но говорит, сколько осталось', () => {
    const issues = Array.from({ length: 20 }, (_, index) => `Беда номер ${index} в поле.`);
    const collapsed = collapse(issues);

    // Стену никто не читает — её пролистывают.
    expect(collapsed.length).toBeLessThan(issues.length);
    expect(collapsed[collapsed.length - 1]).toContain('и ещё');
  });
});
