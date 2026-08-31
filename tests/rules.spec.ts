import { describe, expect, it } from 'vitest';

import {
  checkCodeLinks,
  checkCycles,
  checkDocLinks,
  checkDuplicates,
  checkLinks,
  checkRecordIdentity,
  checkSuperseded,
  checkTransition,
  docChangedAfterTask,
  requirementUnimplemented,
  requirementUnverified,
  taskDoneUnverified,
  taskNoRequirement,
  taskNotReadyDocs,
  taskStale,
  verificationNeverRun
} from '../server/lib/rules';
import { codes, context, rec } from './helpers';

/** Тело записи собирается строками: экранированный перенос в тесте не читается. */
const EOL = String.fromCharCode(10);

/**
 * У каждого кода из docs/05-validation.md две проверки: на срабатывание и на
 * молчание там, где срабатывать не должно. Правило без второй проверки рано или
 * поздно начинает мешать работать.
 */

describe('unknown_type', () => {
  it('срабатывает на типе не из списка контракта', () => {
    const record = rec('X-0001', 'adr', 'draft', { section: null });
    expect(codes(checkRecordIdentity(record))).toContain('unknown_type');
  });

  it('молчит на каждом типе из контракта', () => {
    for (const type of ['requirement', 'design', 'decision', 'contract', 'task', 'phase', 'verification']) {
      const prefix = { requirement: 'R', design: 'D', decision: 'A', contract: 'C', task: 'T', phase: 'P', verification: 'V' }[type];
      const record = rec(`${prefix}-0001`, type, 'draft');
      expect(codes(checkRecordIdentity(record))).not.toContain('unknown_type');
    }
  });
});

describe('id_mismatch', () => {
  it('срабатывает, когда префикс не отвечает типу', () => {
    const record = rec('R-0007', 'task', 'backlog', { section: 'tasks' });
    expect(codes(checkRecordIdentity(record))).toContain('id_mismatch');
  });

  it('срабатывает, когда запись лежит не в своём разделе', () => {
    const record = rec('T-0007', 'task', 'backlog', { section: 'design' });
    expect(codes(checkRecordIdentity(record))).toContain('id_mismatch');
  });

  it('видит карту в чужом разделе: префикс `M` тоже проверяется', () => {
    const record = rec('M-0001', 'map', 'draft', { section: 'design' });
    expect(codes(checkRecordIdentity(record))).toContain('id_mismatch');
  });

  it('молчит на карте в своём разделе', () => {
    const record = rec('M-0001', 'map', 'draft', { section: 'maps' });
    expect(codes(checkRecordIdentity(record))).not.toContain('id_mismatch');
  });

  it('молчит на записи в своём разделе', () => {
    expect(codes(checkRecordIdentity(rec('T-0007', 'task', 'backlog')))).not.toContain('id_mismatch');
  });

  it('молчит, когда раздел неизвестен: угадывать по пути не наше дело', () => {
    const record = rec('T-0007', 'task', 'backlog', { section: null });
    expect(codes(checkRecordIdentity(record))).not.toContain('id_mismatch');
  });

  it('не берёт на себя изувеченный идентификатор — это schema_invalid', () => {
    const record = rec('T-12', 'task', 'backlog');
    expect(codes(checkRecordIdentity(record))).not.toContain('id_mismatch');
  });
});

describe('title_mismatch', () => {
  it('срабатывает при расхождении заголовка и title', () => {
    const record = rec('D-0003', 'design', 'approved', { title: 'Модель клёва', body: '# Веса модели\n' });
    expect(codes(checkRecordIdentity(record))).toContain('title_mismatch');
  });

  it('молчит, когда заголовок совпадает', () => {
    const record = rec('D-0003', 'design', 'approved', { title: 'Модель клёва', body: '# Модель клёва\n' });
    expect(codes(checkRecordIdentity(record))).not.toContain('title_mismatch');
  });

  it('молчит, когда заголовка в теле нет: заголовок не обязателен', () => {
    const record = rec('D-0003', 'design', 'approved', { title: 'Модель клёва', body: 'Текст без заголовка\n' });
    expect(codes(checkRecordIdentity(record))).not.toContain('title_mismatch');
  });
});

describe('id_duplicate', () => {
  it('срабатывает на обоих файлах с одним идентификатором', () => {
    const ctx = context([
      rec('T-0007', 'task', 'ready', { path: 'docs/development/tasks/T-0007-a.md' }),
      rec('T-0007', 'task', 'backlog', { path: 'docs/development/tasks/T-0007-b.md' })
    ]);
    const found = checkDuplicates(ctx);
    expect(codes(found)).toEqual(['id_duplicate', 'id_duplicate']);
    expect(found[0]?.message).toContain('T-0007-b.md');
  });

  it('молчит на разных идентификаторах', () => {
    const ctx = context([rec('T-0007', 'task', 'ready'), rec('T-0008', 'task', 'ready')]);
    expect(checkDuplicates(ctx)).toEqual([]);
  });
});

describe('link_broken', () => {
  it('срабатывает на ссылке в никуда', () => {
    const ctx = context([rec('T-0007', 'task', 'backlog', { links: { implements: ['R-9999'] } })]);
    expect(codes(checkLinks(ctx))).toEqual(['link_broken']);
  });

  it('молчит, когда цель существует', () => {
    const ctx = context([
      rec('R-0004', 'requirement', 'approved'),
      rec('T-0007', 'task', 'backlog', { links: { implements: ['R-0004'] } })
    ]);
    expect(checkLinks(ctx)).toEqual([]);
  });
});

describe('link_wrong_type', () => {
  it('срабатывает, когда implements ведёт не на требование', () => {
    const ctx = context([
      rec('D-0003', 'design', 'approved'),
      rec('T-0007', 'task', 'backlog', { links: { implements: ['D-0003'] } })
    ]);
    expect(codes(checkLinks(ctx))).toEqual(['link_wrong_type']);
  });

  it('срабатывает, когда связь ставит запись неподходящего типа', () => {
    const ctx = context([
      rec('R-0004', 'requirement', 'approved', { links: { implements: ['R-0005'] } }),
      rec('R-0005', 'requirement', 'approved')
    ]);
    expect(codes(checkLinks(ctx))).toContain('link_wrong_type');
  });

  it('срабатывает, когда supersedes ведёт на другой тип', () => {
    const ctx = context([
      rec('D-0003', 'design', 'approved', { links: { supersedes: ['R-0004'] } }),
      rec('R-0004', 'requirement', 'superseded')
    ]);
    expect(codes(checkLinks(ctx))).toContain('link_wrong_type');
  });

  it('молчит на связях из таблицы контракта', () => {
    const ctx = context([
      rec('R-0004', 'requirement', 'approved'),
      rec('D-0003', 'design', 'approved'),
      rec('C-0002', 'contract', 'approved'),
      rec('A-0001', 'decision', 'approved'),
      rec('V-0004', 'verification', 'approved'),
      rec('P-0007', 'phase', 'active', { links: { covers: ['T-0007'] } }),
      rec('T-0006', 'task', 'done'),
      rec('T-0007', 'task', 'ready', {
        links: {
          implements: ['R-0004'],
          refines: ['D-0003'],
          decided_by: ['A-0001'],
          depends_on: ['T-0006'],
          verified_by: ['V-0004'],
          documents: ['D-0003', 'C-0002']
        }
      })
    ]);
    expect(checkLinks(ctx)).toEqual([]);
  });

  it('молчит, когда тип записи неизвестен: судить не по чему', () => {
    const ctx = context([
      rec('R-0004', 'requirement', 'approved'),
      rec('X-0001', 'adr', 'draft', { section: null, links: { implements: ['R-0004'] } })
    ]);
    expect(checkLinks(ctx)).toEqual([]);
  });
});

describe('link_cycle', () => {
  it('срабатывает на цикле в depends_on', () => {
    const ctx = context([
      rec('T-0001', 'task', 'backlog', { links: { depends_on: ['T-0002'] } }),
      rec('T-0002', 'task', 'backlog', { links: { depends_on: ['T-0001'] } })
    ]);
    const found = checkCycles(ctx);
    expect(codes(found)).toEqual(['link_cycle']);
    expect(found[0]?.message).toContain('T-0001 → T-0002 → T-0001');
  });

  it('молчит на цепочке зависимостей', () => {
    const ctx = context([
      rec('T-0001', 'task', 'backlog', { links: { depends_on: ['T-0002'] } }),
      rec('T-0002', 'task', 'backlog', { links: { depends_on: ['T-0003'] } }),
      rec('T-0003', 'task', 'backlog')
    ]);
    expect(checkCycles(ctx)).toEqual([]);
  });
});

describe('superseded_without_successor', () => {
  it('срабатывает, когда на замещённую запись никто не ссылается', () => {
    const ctx = context([rec('D-0003', 'design', 'superseded')]);
    expect(codes(checkSuperseded(ctx))).toEqual(['superseded_without_successor']);
  });

  it('молчит, когда преемник объявлен', () => {
    const ctx = context([
      rec('D-0003', 'design', 'superseded'),
      rec('D-0004', 'design', 'approved', { links: { supersedes: ['D-0003'] } })
    ]);
    expect(checkSuperseded(ctx)).toEqual([]);
  });
});

describe('code_link_missing', () => {
  const body = '# Разбор\n\nСмотри [разборщик](../../../app/src/parse.ts#L12-L40).\n';
  const options = { codeRoots: ['app/src'] };

  it('срабатывает, когда файла кода нет', () => {
    const ctx = context([rec('D-0003', 'design', 'approved', { body })], options);
    const found = checkCodeLinks(ctx);
    expect(codes(found)).toEqual(['code_link_missing']);
    expect(found[0]?.message).toContain('app/src/parse.ts');
  });

  it('молчит, когда файл на месте, а якорь строк отброшен', () => {
    const ctx = context([rec('D-0003', 'design', 'approved', { body })], {
      ...options,
      codeFiles: ['app/src/parse.ts']
    });
    expect(checkCodeLinks(ctx)).toEqual([]);
  });

  it('молчит на ссылке на другой документ и на внешний адрес', () => {
    const other = '# Разбор\n\n[Соседний документ](./D-0004-inoe.md) и [сайт](https://example.org/a.ts).\n';
    const ctx = context([rec('D-0003', 'design', 'approved', { body: other })], options);
    expect(checkCodeLinks(ctx)).toEqual([]);
  });

  it('молчит на пути вне sources.code: о чужих путях мы не судим', () => {
    const outside = '# Разбор\n\n[скрипт](../../../tools/build.sh)\n';
    const ctx = context([rec('D-0003', 'design', 'approved', { body: outside })], options);
    expect(checkCodeLinks(ctx)).toEqual([]);
  });
});

describe('doc_link_missing', () => {
  const body = ['# Разбор', '', 'Смотри [устройство клиента](../design/D-0001-arch.md).', ''].join(EOL);

  it('срабатывает, когда документа по ссылке нет', () => {
    const record = rec('T-0007', 'task', 'backlog', { body });
    const found = checkDocLinks(context([record]));
    expect(codes(found)).toEqual(['doc_link_missing']);
    expect(found[0]?.message).toContain('docs/development/design/D-0001-arch.md');
  });

  it('молчит, когда документ на месте', () => {
    const record = rec('T-0007', 'task', 'backlog', { body });
    const ctx = context([record], {
      documents: [record.source.path, 'docs/development/design/D-0001-arch.md']
    });
    expect(checkDocLinks(ctx)).toEqual([]);
  });

  it('молчит на якоре к существующему документу: заголовки правят чаще, чем файлы', () => {
    const withAnchor = rec('T-0007', 'task', 'backlog', {
      body: '[раздел](../design/D-0001-arch.md#статусы)'
    });
    const ctx = context([withAnchor], {
      documents: [withAnchor.source.path, 'docs/development/design/D-0001-arch.md']
    });
    expect(checkDocLinks(ctx)).toEqual([]);
  });

  it('молчит на ссылке за пределы docs/development и на внешний адрес', () => {
    const outside = rec('T-0007', 'task', 'backlog', {
      body: '[README](../../../README.md) и [сайт](https://example.org/a.md)'
    });
    expect(checkDocLinks(context([outside]))).toEqual([]);
  });

  it('молчит на ссылке на код: об этом говорит code_link_missing', () => {
    const toCode = rec('T-0007', 'task', 'backlog', {
      body: '[модуль](../../../app/src/bite.ts)'
    });
    expect(checkDocLinks(context([toCode]))).toEqual([]);
  });
});

describe('task_not_ready_docs', () => {
  const docReview = rec('D-0004', 'design', 'review');
  const docApproved = rec('D-0004', 'design', 'approved');

  it('срабатывает, когда документ задачи не подтверждён', () => {
    const ctx = context([docReview, rec('T-0002', 'task', 'in_progress', { links: { documents: ['D-0004'] } })]);
    const found = taskNotReadyDocs(ctx);
    expect(codes(found)).toEqual(['task_not_ready_docs']);
    expect(found[0]?.message).toContain('D-0004');
    expect(found[0]?.message).toContain('review');
  });

  it('срабатывает и на refines: контракт требует подтверждения обоих', () => {
    const ctx = context([docReview, rec('T-0002', 'task', 'ready', { links: { refines: ['D-0004'] } })]);
    expect(codes(taskNotReadyDocs(ctx))).toEqual(['task_not_ready_docs']);
  });

  it('молчит, когда документы подтверждены', () => {
    const ctx = context([docApproved, rec('T-0002', 'task', 'ready', { links: { documents: ['D-0004'] } })]);
    expect(taskNotReadyDocs(ctx)).toEqual([]);
  });

  it('молчит на задаче в backlog: до ready подтверждать нечего', () => {
    const ctx = context([docReview, rec('T-0002', 'task', 'backlog', { links: { documents: ['D-0004'] } })]);
    expect(taskNotReadyDocs(ctx)).toEqual([]);
  });

  it('молчит при выключенной политике', () => {
    const ctx = context(
      [docReview, rec('T-0002', 'task', 'ready', { links: { documents: ['D-0004'] } })],
      { policy: { require_approved_docs_before_dev: false } }
    );
    expect(taskNotReadyDocs(ctx)).toEqual([]);
  });
});

describe('task_no_requirement', () => {
  it('срабатывает на задаче в ready без implements', () => {
    const ctx = context([rec('T-0002', 'task', 'ready')]);
    expect(codes(taskNoRequirement(ctx))).toEqual(['task_no_requirement']);
  });

  it('срабатывает и дальше по цепочке статусов', () => {
    const ctx = context([
      rec('T-0002', 'task', 'in_progress'),
      rec('T-0003', 'task', 'in_review'),
      rec('T-0004', 'task', 'done')
    ]);
    expect(taskNoRequirement(ctx)).toHaveLength(3);
  });

  it('молчит на задаче с требованием и на задаче в backlog', () => {
    const ctx = context([
      rec('R-0004', 'requirement', 'approved'),
      rec('T-0002', 'task', 'ready', { links: { implements: ['R-0004'] } }),
      rec('T-0003', 'task', 'backlog'),
      rec('T-0004', 'task', 'dropped')
    ]);
    expect(taskNoRequirement(ctx)).toEqual([]);
  });
});

describe('task_done_unverified', () => {
  const verification = rec('V-0004', 'verification', 'approved');
  const done = rec('T-0002', 'task', 'done', { links: { verified_by: ['V-0004'] } });

  it('срабатывает, когда проверка не пройдена', () => {
    const ctx = context([verification, done], { verifications: { 'V-0004': 'failed' } });
    expect(codes(taskDoneUnverified(ctx))).toEqual(['task_done_unverified']);
  });

  it('срабатывает, когда прогонов не было', () => {
    const ctx = context([verification, done]);
    const found = taskDoneUnverified(ctx);
    expect(codes(found)).toEqual(['task_done_unverified']);
    expect(found[0]?.message).toContain('ни разу не запускалась');
  });

  it('молчит, когда проверка пройдена', () => {
    const ctx = context([verification, done], { verifications: { 'V-0004': 'passed' } });
    expect(taskDoneUnverified(ctx)).toEqual([]);
  });

  it('молчит на незакрытой задаче', () => {
    const ctx = context([verification, rec('T-0002', 'task', 'in_review', { links: { verified_by: ['V-0004'] } })]);
    expect(taskDoneUnverified(ctx)).toEqual([]);
  });

  it('молчит при выключенной политике', () => {
    const ctx = context([verification, done], { policy: { require_verification_before_done: false } });
    expect(taskDoneUnverified(ctx)).toEqual([]);
  });
});

describe('requirement_unverified', () => {
  it('срабатывает на подтверждённом требовании без проверок', () => {
    const ctx = context([rec('R-0004', 'requirement', 'approved')]);
    expect(codes(requirementUnverified(ctx))).toEqual(['requirement_unverified']);
  });

  it('молчит, когда связь объявлена с любой стороны', () => {
    const declared = context([
      rec('V-0004', 'verification', 'approved'),
      rec('R-0004', 'requirement', 'approved', { links: { verified_by: ['V-0004'] } })
    ]);
    const backwards = context([
      rec('R-0004', 'requirement', 'approved'),
      rec('V-0004', 'verification', 'approved', { links: { verifies: ['R-0004'] } })
    ]);
    expect(requirementUnverified(declared)).toEqual([]);
    expect(requirementUnverified(backwards)).toEqual([]);
  });

  it('молчит на неподтверждённом требовании: спрашивать рано', () => {
    expect(requirementUnverified(context([rec('R-0004', 'requirement', 'draft')]))).toEqual([]);
  });
});

describe('requirement_unimplemented', () => {
  it('срабатывает, когда на требование не ссылается ни одна задача', () => {
    const ctx = context([rec('R-0004', 'requirement', 'approved')]);
    expect(codes(requirementUnimplemented(ctx))).toEqual(['requirement_unimplemented']);
  });

  it('молчит, когда задача есть', () => {
    const ctx = context([
      rec('R-0004', 'requirement', 'approved'),
      rec('T-0007', 'task', 'backlog', { links: { implements: ['R-0004'] } })
    ]);
    expect(requirementUnimplemented(ctx)).toEqual([]);
  });

  it('молчит на требовании в draft', () => {
    expect(requirementUnimplemented(context([rec('R-0004', 'requirement', 'draft')]))).toEqual([]);
  });
});

describe('doc_changed_after_task', () => {
  it('срабатывает, когда документ изменён после закрытия задачи', () => {
    const ctx = context([
      rec('D-0003', 'design', 'approved', { updated: '2026-08-20' }),
      rec('T-0007', 'task', 'done', { updated: '2026-08-10', links: { documents: ['D-0003'] } })
    ]);
    expect(codes(docChangedAfterTask(ctx))).toEqual(['doc_changed_after_task']);
  });

  it('молчит, когда документ изменён до закрытия или в тот же день', () => {
    const ctx = context([
      rec('D-0003', 'design', 'approved', { updated: '2026-08-10' }),
      rec('D-0004', 'design', 'approved', { updated: '2026-08-05' }),
      rec('T-0007', 'task', 'done', { updated: '2026-08-10', links: { documents: ['D-0003', 'D-0004'] } })
    ]);
    expect(docChangedAfterTask(ctx)).toEqual([]);
  });

  it('молчит на незакрытой задаче: документ и должен меняться в работе', () => {
    const ctx = context([
      rec('D-0003', 'design', 'approved', { updated: '2026-08-20' }),
      rec('T-0007', 'task', 'in_progress', { updated: '2026-08-10', links: { documents: ['D-0003'] } })
    ]);
    expect(docChangedAfterTask(ctx)).toEqual([]);
  });
});

describe('task_stale', () => {
  const policy = { stale_in_progress_days: 14 };

  it('срабатывает, когда задача в работе дольше порога', () => {
    const ctx = context([rec('T-0007', 'task', 'in_progress', { updated: '2026-08-01' })], {
      policy,
      now: '2026-08-30'
    });
    const found = taskStale(ctx);
    expect(codes(found)).toEqual(['task_stale']);
    expect(found[0]?.message).toContain('29 дней');
  });

  it('молчит ровно на пороге', () => {
    const ctx = context([rec('T-0007', 'task', 'in_progress', { updated: '2026-08-16' })], {
      policy,
      now: '2026-08-30'
    });
    expect(taskStale(ctx)).toEqual([]);
  });

  it('молчит на задаче в другом статусе', () => {
    const ctx = context([rec('T-0007', 'task', 'done', { updated: '2026-01-01' })], { policy, now: '2026-08-30' });
    expect(taskStale(ctx)).toEqual([]);
  });

  it('молчит, когда порог не объявлен: придумывать его не нам', () => {
    const ctx = context([rec('T-0007', 'task', 'in_progress', { updated: '2020-01-01' })], { now: '2026-08-30' });
    expect(taskStale(ctx)).toEqual([]);
  });
});

describe('verification_never_run', () => {
  it('срабатывает на проверке без прогонов', () => {
    const ctx = context([rec('V-0004', 'verification', 'approved')]);
    expect(codes(verificationNeverRun(ctx))).toEqual(['verification_never_run']);
  });

  it('молчит, когда результат есть, даже неудачный', () => {
    const ctx = context([rec('V-0004', 'verification', 'approved')], { verifications: { 'V-0004': 'failed' } });
    expect(verificationNeverRun(ctx)).toEqual([]);
  });
});

describe('transition_forbidden', () => {
  const ctx = context([]);

  it('срабатывает на переходе, которого нет в схеме статусов', () => {
    const task = rec('T-0007', 'task', 'backlog');
    const found = checkTransition(task, 'in_progress', ctx);
    expect(codes(found)).toEqual(['transition_forbidden']);
    expect(found[0]?.message).toContain('`ready`');
  });

  it('срабатывает на закрытой задаче: из done переходов нет', () => {
    expect(codes(checkTransition(rec('T-0007', 'task', 'done'), 'in_progress', ctx))).toEqual(['transition_forbidden']);
  });

  it('срабатывает на фазе: её статус считается по задачам', () => {
    const found = checkTransition(rec('P-0007', 'phase', 'planned'), 'active', ctx);
    expect(codes(found)).toEqual(['transition_forbidden']);
    expect(found[0]?.message).toContain('covers');
  });

  it('молчит на разрешённом переходе', () => {
    expect(checkTransition(rec('T-0007', 'task', 'ready'), 'in_progress', ctx)).toEqual([]);
    expect(checkTransition(rec('D-0003', 'design', 'review'), 'approved', ctx)).toEqual([]);
    expect(checkTransition(rec('A-0001', 'decision', 'review'), 'rejected', ctx)).toEqual([]);
  });

  it('различает dropped у документов и rejected у решений', () => {
    expect(codes(checkTransition(rec('A-0001', 'decision', 'review'), 'dropped', ctx))).toEqual(['transition_forbidden']);
    expect(codes(checkTransition(rec('D-0003', 'design', 'review'), 'rejected', ctx))).toEqual(['transition_forbidden']);
  });

  it('называет блокирующее своим кодом, а не общим отказом', () => {
    const doc = rec('D-0004', 'design', 'review');
    const task = rec('T-0002', 'task', 'backlog', { links: { documents: ['D-0004'] } });
    const found = checkTransition(task, 'ready', context([doc, task]));
    expect(codes(found)).toEqual(['task_no_requirement', 'task_not_ready_docs']);
  });

  it('молчит, когда условия перехода в ready выполнены', () => {
    const doc = rec('D-0004', 'design', 'approved');
    const requirement = rec('R-0004', 'requirement', 'approved');
    const task = rec('T-0002', 'task', 'backlog', { links: { documents: ['D-0004'], implements: ['R-0004'] } });
    expect(checkTransition(task, 'ready', context([doc, requirement, task]))).toEqual([]);
  });

  it('не пускает в done с непройденной проверкой', () => {
    const verification = rec('V-0004', 'verification', 'approved');
    const task = rec('T-0002', 'task', 'in_review', { links: { verified_by: ['V-0004'] } });
    const blocked = checkTransition(task, 'done', context([verification, task], { verifications: { 'V-0004': 'failed' } }));
    const allowed = checkTransition(task, 'done', context([verification, task], { verifications: { 'V-0004': 'passed' } }));
    expect(codes(blocked)).toEqual(['task_done_unverified']);
    expect(allowed).toEqual([]);
  });
});
