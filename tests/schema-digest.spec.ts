import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import codemapSchema from '../docs/schemas/codemap.schema.json';
import dataflowSchema from '../docs/schemas/dataflow.schema.json';
import evidenceSchema from '../docs/schemas/evidence.schema.json';
import userflowSchema from '../docs/schemas/userflow.schema.json';
import { mapSchemas } from '../server/lib/map-schemas';
import { mapsPrompt, SCHEMAS_MARKER } from '../server/lib/prompt';
import { schemaDigest } from '../server/lib/schema-digest';

/**
 * Форма блоков карты уезжает в запрос выжимкой из схемы, а не ссылкой на файл:
 * модель работает в чужом проекте, где схем нет, и по ссылке в никуда
 * придумывает форму сама — ответ тогда не проходит проверку целиком.
 *
 * Здесь же проверяется главное: выжимка не может разойтись со схемой.
 */

const REFS = { 'https://docdd/evidence.schema.json': evidenceSchema };

const template = readFileSync(
  join(fileURLToPath(new URL('..', import.meta.url)), 'docs', 'prompts', 'update-maps.md'),
  'utf8'
);

const state = { from: [], modules: 0, sources: 0, screens: 0, code: ['src'], client: ['app'], unverified: [] };

/** Все поля, объявленные схемой: по ним и сверяется выжимка. */
function fieldsOf(schema: unknown): string[] {
  const root = schema as { $defs?: Record<string, { properties?: Record<string, unknown> }> };
  const names = new Set<string>();
  for (const definition of Object.values(root.$defs ?? {})) {
    for (const name of Object.keys(definition.properties ?? {})) names.add(name);
  }
  return [...names];
}

describe('выжимка из схемы', () => {
  const cases = [
    ['codemap', codemapSchema],
    ['dataflow', dataflowSchema],
    ['userflow', userflowSchema]
  ] as const;

  for (const [name, schema] of cases) {
    it(`называет каждое поле схемы ${name}: пропущенное модель не заполнит`, () => {
      const digest = schemaDigest(schema, `docdd-${name}`, REFS);
      for (const field of fieldsOf(schema)) {
        expect(digest, `поле ${field}`).toContain('`' + field + '`');
      }
    });
  }

  it('называет обязательные поля обязательными', () => {
    const digest = schemaDigest(dataflowSchema, 'docdd-dataflow', REFS);
    // Именно на `direction` спотыкался ответ модели: поле обязательное, а
    // запрос о нём молчал.
    expect(digest).toContain('`direction` — обязательное');
    expect(digest).toContain('read, write, both');
  });

  it('перечисляет допустимые значения: их не угадать', () => {
    const digest = schemaDigest(dataflowSchema, 'docdd-dataflow', REFS);
    expect(digest).toContain('file, http, db, queue, env, memory');
  });

  it('расписывает свидетельство: оно описано отдельной схемой', () => {
    const digest = schemaDigest(codemapSchema, 'docdd-codemap', REFS);
    expect(digest).toContain('`evidence.path`');
    expect(digest).toContain('`evidence.line`');
    expect(digest).toContain('`evidence.fragment`');
  });

  it('говорит, что список полей закрыт', () => {
    expect(schemaDigest(codemapSchema, 'docdd-codemap', REFS)).toContain('Других полей нет');
  });
});

describe('запрос на карты', () => {
  it('несёт форму всех трёх блоков', () => {
    const prompt = mapsPrompt(template, state, mapSchemas());

    expect(prompt).not.toContain(SCHEMAS_MARKER);
    expect(prompt).toContain('Форма блока `docdd-codemap`');
    expect(prompt).toContain('Форма блока `docdd-dataflow`');
    expect(prompt).toContain('Форма блока `docdd-userflow`');
  });

  it('не отправляет модель искать схемы в чужом проекте', () => {
    // Ссылка в никуда — это ответ, придуманный по догадке, и отказ схемы.
    expect(mapsPrompt(template, state, mapSchemas())).not.toContain('schemas/');
  });
});
