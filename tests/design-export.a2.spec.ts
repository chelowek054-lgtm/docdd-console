import { describe, expect, it } from 'vitest';

import { plainTokens, resolveDesign } from '../server/lib/design';
import { STACK_IDS, compareFile, exportStack, isSafeRelative, projectFilePath, type StackId } from '../server/lib/design-export';
import { designDrift } from '../server/lib/rules';
import { context } from './helpers';

/**
 * Выгрузка токенов в стеки и сверка файла темы (R-0032, V-0032): выгрузка
 * одинакова при каждом запуске, совпавший файл молчит, отставший даёт
 * `design_theme_drift` с диффом, компонент без кода — `design_component_missing`.
 */

const BLOCK = {
  unit: 'rem',
  root: 16,
  version: '1.2.0',
  typography: { body: { size: 1, line: 1.5, weight: 400 }, title: { size: 1.5, line: 2, weight: 700 } },
  spacing: { xs: 0.25, sm: 0.5, md: 1, lg: 1.5, xl: 2, xxl: 3 },
  radius: { sm: 0.25, md: 0.5, pill: 62.5 },
  grid: { columns: 12, gutter: 1.5 },
  palette: {
    light: { bg: '#FFFFFF', ink: '#111111', accent: '#2255CC', shadow: '#000000' },
    dark: { bg: '#101010', ink: '#EEEEEE', accent: '#88AAFF', shadow: '#000000' }
  },
  components: [{ name: 'TopBar' }, { name: 'Card' }]
};

const record = { id: 'D-1', body: `\`\`\`docdd-design\n${JSON.stringify(BLOCK)}\n\`\`\`\n` };
const resolution = resolveDesign({ general: [], local: [record] });
const tokens = plainTokens(resolution.tokens);

describe('выгрузка токенов в стеки', () => {
  for (const id of STACK_IDS) {
    it(`${id}: снимок и повторный запуск дают один и тот же текст`, () => {
      const first = exportStack(id, tokens);
      const again = exportStack(id, plainTokens(resolveDesign({ general: [], local: [record] }).tokens));
      expect(again).toEqual(first);
      expect(first.files.length).toBeGreaterThan(0);
      for (const file of first.files) expect(file.content.length).toBeGreaterThan(0);
      expect(first.files.map((file) => `// ${file.key} -> ${file.defaultPath}\n${file.content}`).join('\n')).toMatchSnapshot();
    });
  }

  it('веб получает rem, платформы без rem — rem × root', () => {
    const css = exportStack('nuxt-ui', tokens).files[0]!.content;
    expect(css).toContain('1.5rem');
    expect(css).not.toMatch(/\d+px\b[^)]*;\s*$/m);
    const expo = exportStack('expo', tokens).files[0]!.content;
    expect(expo).toContain('24'); // gutter 1.5rem × 16
  });
});

describe('сверка файла проекта', () => {
  const file = exportStack('expo', tokens).files[0]!;

  it('совпавший файл — in_sync, без диффа', () => {
    expect(compareFile(file, file.content)).toEqual({ state: 'in_sync', diff: '' });
  });

  it('изменённый цвет — drift с диффом, нет файла — missing', () => {
    const edited = file.content.replace('#2255CC', '#FF0000');
    expect(edited).not.toBe(file.content);
    const outcome = compareFile(file, edited);
    expect(outcome.state).toBe('drift');
    expect(outcome.diff).toContain('- ');
    expect(outcome.diff).toContain('#FF0000');
    expect(compareFile(file, null).state).toBe('missing');
  });

  it('путь файла темы только внутри проекта', () => {
    expect(isSafeRelative('constants/theme.ts')).toBe(true);
    expect(isSafeRelative('../theme.ts')).toBe(false);
    expect(isSafeRelative('/etc/theme.ts')).toBe(false);
    expect(isSafeRelative('C:\theme.ts')).toBe(false);
    expect(projectFilePath({ theme: 'x/theme.ts' }, file)).toBe('x/theme.ts');
  });
});

describe('правило designDrift', () => {
  const stack = { id: 'expo' as StackId };
  const expoFile = exportStack('expo', tokens).files[0]!;
  const base = (sources: Record<string, string>, codeFiles: string[] = []) => ({
    ...context([], { sources, codeFiles }),
    design: resolution,
    designStacks: [stack]
  });

  it('файл совпал с выгрузкой — предупреждений о теме нет', () => {
    const found = designDrift(base({ [expoFile.defaultPath]: expoFile.content }, ['components/TopBar.tsx', 'components/Card.tsx']));
    expect(found).toEqual([]);
  });

  it('отставший файл — design_theme_drift, файла нет — тоже', () => {
    const stale = designDrift(base({ [expoFile.defaultPath]: expoFile.content.replace('#2255CC', '#FF0000') }, ['TopBar.tsx', 'Card.tsx']));
    expect(stale.map((item) => item.code)).toEqual(['design_theme_drift']);
    expect(stale[0]!.message).toContain('расходится');
    const gone = designDrift(base({}, ['TopBar.tsx', 'Card.tsx']));
    expect(gone.map((item) => item.code)).toEqual(['design_theme_drift']);
    expect(gone[0]!.message).toContain('файла нет');
  });

  it('компонент реестра без кода — design_component_missing; исходники не объявлены — молчим', () => {
    const missing = designDrift(base({ [expoFile.defaultPath]: expoFile.content }, ['components/top-bar.tsx']));
    expect(missing.map((item) => `${item.code}:${item.message.match(/`(\w+)`/)?.[1]}`)).toEqual(['design_component_missing:Card']);
    expect(designDrift(base({ [expoFile.defaultPath]: expoFile.content }, []))).toEqual([]);
  });

  it('Nuxt UI даёт компоненты сам: их отсутствие в коде не нарушение', () => {
    const nuxt = exportStack('nuxt-ui', tokens).files;
    const sources = Object.fromEntries(nuxt.map((file) => [file.defaultPath, file.region ? `/* docdd-design:start */\n${file.content}\n/* docdd-design:end */` : file.content]));
    const ctx = { ...context([], { sources, codeFiles: ['app/pages/index.vue'] }), design: resolution, designStacks: [{ id: 'nuxt-ui' as StackId }] };
    expect(designDrift(ctx).filter((item) => item.code === 'design_component_missing')).toEqual([]);
  });
});
