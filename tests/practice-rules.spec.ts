import { describe, expect, it } from 'vitest';

import { globCovers, globMatch } from '../server/lib/glob';
import { parseRuleBlocks, resolveRules, type RuleRecord } from '../server/lib/practice-rules';
import { rulesConflict } from '../server/lib/rules';
import { context, rec } from './helpers';

/** Правила в практиках (docs/12-practice-rules.md, ADR-0014). */

const FENCE = '```';
const block = (value: unknown) => ['Зачем: …', '', `${FENCE}docdd-rules`, JSON.stringify(value), FENCE].join('\n');
const record = (id: string, value: unknown, label?: string): RuleRecord => ({ id, label, body: block(value) });

describe('пути правил', () => {
  it('* — один сегмент, ** — любая глубина, хвост /** необязателен', () => {
    expect(globMatch('learningBack/modules/*', 'learningBack/modules/knowledge')).toBe(true);
    expect(globMatch('learningBack/modules/*', 'learningBack/modules/knowledge/x')).toBe(false);
    expect(globMatch('app/**', 'app')).toBe(true);
    expect(globMatch('**/tests/**', 'a/b/tests/x.py')).toBe(true);
    expect(globMatch('**/tests/**', 'tests/x.py')).toBe(true);
    expect(globMatch('**/*.spec.*', 'src/a.spec.ts')).toBe(true);
    expect(globMatch('src/a.b', 'src/axb')).toBe(false);
  });

  it('правило про каталог покрывает всё внутри', () => {
    expect(globCovers('learningBack/modules/*', 'learningBack/modules/knowledge/engine.py')).toBe(true);
    expect(globCovers('learningBack/modules/*', 'learningBack/core/x.py')).toBe(false);
    expect(globCovers('shared', 'shared-ui/x.ts')).toBe(false);
  });
});

describe('блок docdd-rules', () => {
  it('несколько блоков в записи, битый — в problems, остальные живут', () => {
    const broken = `${FENCE}docdd-rules\n{oops\n${FENCE}`;
    const parsed = parseRuleBlocks({ id: 'A-0001', body: `${block({ ignore: ['x'] })}\n\n${broken}\n${block({ shared: ['s'] })}` });
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.problems[0]?.record).toBe('A-0001');
  });
});

describe('сложение правил', () => {
  it('правил нет нигде и секции нет — проверки нет', () => {
    const result = resolveRules({ general: [], local: [] });
    expect(result.config).toBeNull();
    expect(result.manifest).toBe('absent');
  });

  it('блоков нет — читается секция манифеста; блок появился — секция игнорируется', () => {
    const manifest = { siblings: 'via-parent' as const };
    expect(resolveRules({ manifest, general: [], local: [] })).toMatchObject({ config: manifest, manifest: 'used' });
    const folded = resolveRules({ manifest, general: [], local: [record('A-0001', { shared: ['core'] })] });
    expect(folded.manifest).toBe('ignored');
    expect(folded.config?.siblings).toBeUndefined();
  });

  it('списки копятся, у общих и локальных', () => {
    const result = resolveRules({
      general: [record('A-0003', { ignore: ['a/**'], independent: ['m/*'] }, 'practices')],
      local: [record('A-0020', { ignore: ['b/**'], independent: ['n/*'] })]
    });
    expect(result.config?.ignore).toEqual(['a/**', 'b/**']);
    expect(result.config?.independent).toEqual(['m/*', 'n/*']);
  });

  it('локальное заменяет общее и помнит, кого перекрыло; конфликта нет', () => {
    const result = resolveRules({
      general: [record('A-0003', { modules: [{ path: 'core', entry: 'closed' }] }, 'practices')],
      local: [record('A-0020', { modules: [{ path: 'core', entry: 'open' }] })]
    });
    expect(result.config?.modules).toEqual([{ path: 'core', entry: 'open' }]);
    const rule = result.rules.find((item) => item.key === 'modules:core');
    expect(rule).toMatchObject({ source: 'A-0020', level: 'local', overrides: ['[practices] A-0003'] });
    expect(result.conflicts).toEqual([]);
  });

  it('спор записей одного уровня — rules_conflict, действует поздняя', () => {
    const result = resolveRules({
      general: [],
      local: [record('A-0020', { siblings: 'via-entry' }), record('A-0023', { siblings: 'via-parent' })]
    });
    expect(result.config?.siblings).toBe('via-parent');
    expect(result.conflicts).toEqual([{ key: 'siblings', records: ['A-0020', 'A-0023'] }]);
  });

  it('одинаковое значение конфликтом не считается', () => {
    const result = resolveRules({ general: [], local: [record('A-0020', { siblings: 'via-parent' }), record('A-0023', { siblings: 'via-parent' })] });
    expect(result.conflicts).toEqual([]);
  });

  it('forbidden помнит запись и причину', () => {
    const result = resolveRules({ general: [], local: [record('A-0020', { forbidden: [{ from: 'ui', to: ['api'], why: 'UI не знает про API' }] })] });
    expect(result.config?.forbidden).toEqual([{ from: 'ui', to: ['api'], why: 'UI не знает про API', source: 'A-0020' }]);
  });
});

describe('use: общий профиль, применённый к своим путям', () => {
  const profile = record('A-0003', {
    layers: [{ root: '{root}', order: ['app', 'pages', 'shared'], slices: 'isolated', unsliced: ['app', 'shared'] }]
  }, 'practices');

  it('{root} подставляется, источник — запись профиля', () => {
    const result = resolveRules({ general: [profile], local: [record('A-0020', { use: [{ profile: 'A-0003', root: 'learningFront/src' }] })] });
    expect(result.config?.layers).toEqual([{ root: 'learningFront/src', order: ['app', 'pages', 'shared'], slices: 'isolated', unsliced: ['app', 'shared'] }]);
    expect(result.rules[0]?.source).toBe('[practices] A-0003');
  });

  it('профиля нет или в нём нет блока — problems, а не молчаливый пропуск', () => {
    const result = resolveRules({ general: [], local: [record('A-0020', { use: [{ profile: 'A-9999', root: 'x' }] })] });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.message).toContain('A-9999');
  });
});

describe('предупреждение rules_conflict в общем проходе', () => {
  it('спор и битый блок становятся нарушениями на записи', () => {
    const records = [
      rec('A-0020', 'decision', 'approved', { path: 'docs/development/decisions/A-0020.md' }),
      rec('A-0023', 'decision', 'approved', { path: 'docs/development/decisions/A-0023.md' })
    ];
    const ctx = {
      ...context(records),
      rules: resolveRules({
        general: [],
        local: [
          record('A-0020', { siblings: 'via-entry' }),
          record('A-0023', { siblings: 'via-parent' }),
          { id: 'A-0020', body: `${FENCE}docdd-rules\n{x\n${FENCE}` }
        ]
      })
    };
    const found = rulesConflict(ctx);
    expect(found.map((item) => item.code)).toEqual(['rules_conflict', 'rules_conflict']);
    expect(found[0]?.id).toBe('A-0023');
    expect(found[0]?.path).toBe('docs/development/decisions/A-0023.md');
    expect(found[0]?.level).toBe('warning');
  });
});
