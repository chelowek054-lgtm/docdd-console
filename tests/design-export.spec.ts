import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { plainTokens, resolveDesign } from '../server/lib/design';
import {
  STACK_IDS,
  compareFile,
  componentsMissing,
  exportStack,
  isSafeRelative,
  projectFilePath
} from '../server/lib/design-export';
import { designDrift } from '../server/lib/rules';
import { codes, context } from './helpers';

/** V-0032: выгрузка эталонных токенов в четыре стека, повторяемость, сверка файла темы. */

const etalon = {
  id: 'D-0001',
  label: 'practices',
  body: readFileSync(resolve(__dirname, '../practices/docs/development/design/D-0001-edinyy-dizayn-praxis-tokeny.md'), 'utf8')
};
const resolution = resolveDesign({ general: [etalon], local: [] });
const tokens = plainTokens(resolution.tokens);

describe('выгрузка в стеки', () => {
  for (const id of STACK_IDS) {
    it(`${id}: снимок и тот же текст при повторе`, () => {
      const first = exportStack(id, tokens);
      expect(first.files.length).toBeGreaterThan(0);
      expect(exportStack(id, plainTokens(resolveDesign({ general: [etalon], local: [] }).tokens))).toEqual(first);
      // Снимок: все файлы одного стека одним текстом.
      expect(first.files.map((f) => `// ${f.key} ${f.defaultPath}\n${f.content}`).join('\n----\n')).toMatchSnapshot();
    });
  }
});

describe('сверка файла темы', () => {
  const nuxt = exportStack('nuxt-ui', tokens).files;
  const css = nuxt.find((f) => f.key === 'css')!;

  it('файл, совпадающий с выгрузкой, — без расхождений', () => {
    for (const file of nuxt) expect(compareFile(file, file.region ? `/* проект */\n${file.content}\n` : file.content).state).toBe('in_sync');
  });

  it('изменённый цвет — drift с диффом; нет файла — missing', () => {
    const changed = css.content.replace(/#[0-9a-fA-F]{6}/, '#123456');
    expect(changed).not.toBe(css.content);
    const out = compareFile(css, changed);
    expect(out.state).toBe('drift');
    expect(out.diff).toContain('#123456');
    expect(compareFile(css, null).state).toBe('missing');
  });

  it('design_theme_drift попадает в нарушения; в синхроне — нет', () => {
    const stacks = [{ id: 'expo' as const }];
    const file = exportStack('expo', tokens).files[0]!;
    const base = { design: resolution, designStacks: stacks };
    const ok = { ...context([], { sources: { [file.defaultPath]: file.content } }), ...base };
    expect(codes(designDrift(ok))).not.toContain('design_theme_drift');
    const bad = { ...context([], { sources: { [file.defaultPath]: file.content.replace(/#[0-9a-fA-F]{6}/, '#123456') } }), ...base };
    expect(codes(designDrift(bad))).toContain('design_theme_drift');
    const none = { ...context([]), ...base };
    expect(codes(designDrift(none))).toContain('design_theme_drift');
  });

  it('компонент реестра, не найденный в коде, — design_component_missing', () => {
    expect(componentsMissing(['TopBar', 'Card'], ['src/components/TopBar.vue'])).toEqual(['Card']);
    expect(componentsMissing(['TopBar'], ['src/ui/top-bar.tsx'])).toEqual([]);
    expect(componentsMissing(['Card'], [])).toBeNull();
    const ctx = { ...context([], { codeFiles: ['a/TopBar.vue'] }), design: resolution, designStacks: [{ id: 'expo' as const }] };
    expect(designDrift(ctx).filter((v) => v.code === 'design_component_missing').length).toBeGreaterThan(0);
  });

  it('путь файла только внутри проекта', () => {
    expect(isSafeRelative('../x')).toBe(false);
    expect(isSafeRelative('/etc/x')).toBe(false);
    expect(isSafeRelative('C:/x')).toBe(false);
    expect(isSafeRelative('a/b.ts')).toBe(true);
    expect(projectFilePath({ theme: 'x/t.ts' }, { key: 'theme', defaultPath: 'd.ts', content: '' })).toBe('x/t.ts');
  });
});
