// V-0057 manual — подготовка
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { DesignComponent } from '../server/lib/design';
import { buildCatalogReport, REFERENCE_STACK } from '../server/lib/design-catalog';
import { contractLines, portPrompt } from '../server/lib/design-port';

/**
 * Подготовка ручной проверки R-0057: запрос «перенести компонент на стек»
 * собирает контракт, истории, токены стека и перенесённых соседей; ветка
 * задачи подставлена, сливает человек. Человеку остаётся нажать в карточке.
 */

const template = readFileSync(new URL('../docs/prompts/design-port.md', import.meta.url), 'utf8');
const cat = (items: Record<string, [string, string]>) => JSON.stringify({ entries: Object.fromEntries(Object.entries(items).map(([id, [title, name]]) => [id, { id, type: 'story', title, name }])) });

const button: DesignComponent = {
  name: 'Button', summary: 'Кнопка', kind: 'base', variants: ['solid'], states: ['disabled'], parts: ['root'],
  props: [{ name: 'size', type: "'sm'|'md'", default: 'md', values: ['sm', 'md'], required: true }], slots: ['icon'], events: ['press']
};
const chip: DesignComponent = { name: 'Chip', kind: 'base', states: ['default'] };
const card: DesignComponent = { name: 'Card', kind: 'composite', composedOf: ['Button'], logic: 'сортировка' };
const report = buildCatalogReport([button, chip, card], [
  { stack: REFERENCE_STACK, label: 'SB', path: 'a', text: cat({ 'b-solid': ['Button', 'Solid'], 'b-dis': ['Button', 'Disabled'], 'c-def': ['Chip', 'Default'], 'k-1': ['Card', 'Basic'] }) },
  { stack: 'expo', label: 'Expo', path: 'b', text: cat({ 'e-c-def': ['Chip', 'Default'], 'e-b-solid': ['Button', 'Solid'] }) }
]);

const input = { component: button, stack: 'expo', stackLabel: 'Expo', report, components: [button, chip, card], branch: 'port/expo/button',
  tokenFiles: [{ path: 'src/theme.ts', content: 'export const accent = "#123456";' }] };

describe('запрос переноса', () => {
  const out = portPrompt(template, input);

  it('все метки шаблона заменены, фронт-заметка шаблона отрезана', () => {
    expect(out).not.toMatch(/<!-- [А-ЯЁ ]+ -->/);
    expect(out).not.toContain('Приложение подставляет сюда');
  });

  it('контракт: уровень, варианты, состояния, слои, свойства с умолчанием и значениями, слоты, события', () => {
    expect(out).toContain('Button → Expo (`expo`)');
    for (const part of ['Уровень: базовый', 'Варианты: solid', 'Состояния: disabled', 'Слои: root', "size: 'sm'|'md', по умолчанию md, значения sm | md, обязательное", 'Слоты: icon', 'События: press', 'Бизнес-логики в контракте нет']) {
      expect(out).toContain(part);
    }
  });

  it('истории эталона и стека по пунктам; пробел на стеке назван', () => {
    expect(out).toContain('- solid: эталон `b-solid`; на стеке `e-b-solid`');
    expect(out).toContain('- disabled: эталон `b-dis`; на стеке не перенесено');
  });

  it('токены стека и ветка', () => {
    expect(out).toContain('src/theme.ts');
    expect(out).toContain('#123456');
    expect(out).toContain('port/expo/button');
  });

  it('соседи: только полностью перенесённые на этот стек', () => {
    expect(out).toContain('- Chip (base)');
    expect(out).not.toContain('- Card');
    expect(portPrompt(template, { ...input, components: [button] })).toContain('Перенесённых соседей на этом стеке пока нет');
  });

  it('снимки историй, если объявлены и лежат', () => {
    const withShots = portPrompt(template, { ...input, snapshotsDir: 'snaps', files: new Set(['snaps/storybook/b-solid.png', 'snaps/expo/e-b-solid.png']) });
    expect(withShots).toContain('(снимок `snaps/storybook/b-solid.png`)');
    expect(withShots).toContain('(снимок `snaps/expo/e-b-solid.png`)');
  });

  it('нет выгрузки токенов — так и сказано; длинный файл обрезается', () => {
    expect(portPrompt(template, { ...input, tokenFiles: [] })).toContain('Выгрузки токенов для этого стека нет.');
    expect(portPrompt(template, { ...input, tokenFiles: [{ path: 'big', content: 'x'.repeat(7000) }] })).toContain('(обрезано)');
  });

  it('составной с logic: логика названа неотделимой', () => {
    expect(contractLines(card)).toContain('составной, собран из Button');
    expect(contractLines(card)).toContain('Логика неотделима: сортировка');
  });

  it('шаблон велит работать в ветке и не трогать docs/development', () => {
    expect(template).toContain('Работай в ветке');
    expect(template).toContain('docs/development');
  });
});
