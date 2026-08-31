import { describe, expect, it } from 'vitest';

import { duration } from '../app/utils/duration';

/** Подписи, которые человек читает вслух (docs/04-ui.md). */

describe('duration', () => {
  it('секунды до минуты', () => {
    expect(duration(8_400)).toBe('8 с');
    expect(duration(0)).toBe('0 с');
  });

  it('минуты и секунды — так, как это произносят вслух', () => {
    expect(duration(142_000)).toBe('2 мин 22 с');
  });

  it('ровные минуты не тянут за собой ноль секунд', () => {
    expect(duration(180_000)).toBe('3 мин');
  });
});
