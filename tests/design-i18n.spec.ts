import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Интерфейс консоли на двух языках (R-0035, «ru/en в интерфейсе»): каждый ключ
 * словаря есть в обоих языках — иначе на одном из них останется голый ключ.
 */
const keysOf = (file: string) =>
  new Set([...readFileSync(file, 'utf8').matchAll(/^\s*'([a-z0-9_.-]+)'\s*:/gim)].map((match) => match[1]!));

describe('словари интерфейса ru/en', () => {
  for (const file of ['design.ts', 'shell.ts']) {
    it(`${file}: ключи полны в обоих языках`, () => {
      const ru = keysOf(`app/i18n/ru/${file}`);
      const en = keysOf(`app/i18n/en/${file}`);
      expect(ru.size).toBeGreaterThan(0);
      expect([...ru].filter((key) => !en.has(key))).toEqual([]);
      expect([...en].filter((key) => !ru.has(key))).toEqual([]);
    });
  }
});
