// V-0012 review — автотест подготовка человеку (шаблоны ролей читаются); живой прогон остаётся за человеком.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROLES = ['manager', 'analyst', 'domain', 'observer'];
const dir = join(__dirname, '..', 'docs', 'prompts', 'roles');

describe('R-0012: шаблоны ролей', () => {
  for (const role of ROLES) {
    it(`${role}: есть маркеры контекста и вопроса, шапка отделена, нужды названы`, () => {
      const text = readFileSync(join(dir, `${role}.md`), 'utf8').replace(/\r\n/g, '\n');
      expect(text).toContain('<!-- КОНТЕКСТ -->');
      expect(text).toContain('<!-- ВОПРОС -->');
      expect(text).toMatch(/\n---\n/);
      expect(text).toMatch(/Нужды пакета: record/);
      // Как ask.post.ts: шапка до --- в запрос не идёт.
      const body = text.slice(text.search(/\n---\n/) + 5);
      expect(body).not.toContain('Нужды пакета');
    });
  }
});
