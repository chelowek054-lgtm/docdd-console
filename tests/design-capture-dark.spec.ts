import { describe, expect, it } from 'vitest';

import { buildInventory, captureScript } from '../server/lib/design-screens';

// docs/16-design-system.md, «Проверка экранов»: тема на базе dark включается вместе с `.dark`.
describe('скрипт снятия экранов: добавленные тёмные темы', () => {
  const inventory = buildInventory({ screens: [{ id: '/', title: 'Главная' }], files: [], screensDir: 's', mockupsDir: 'm', themes: ['light', 'dark', 'oled'] });

  it('тема на базе dark получает тёмную схему и класс .dark', () => {
    const script = captureScript(inventory, ['oled']);
    expect(script).toContain("new Set(['dark', 'oled'])");
    expect(script).toContain("colorScheme: dark.has(theme) ? 'dark' : 'light'");
    expect(script).toContain("root.classList.add('dark')");
    expect(script).toContain('theme-${name}');
  });

  it('без добавленных тёмных тем тёмной остаётся только dark', () => {
    expect(captureScript(inventory)).toContain("new Set(['dark', ])");
  });
});
