import codemapSchema from '../../docs/schemas/codemap.schema.json';
import dataflowSchema from '../../docs/schemas/dataflow.schema.json';
import evidenceSchema from '../../docs/schemas/evidence.schema.json';
import skippedSchema from '../../docs/schemas/skipped.schema.json';
import userflowSchema from '../../docs/schemas/userflow.schema.json';

import { schemaDigest } from './schema-digest';

/**
 * Форма блоков карты для запроса к модели. Считается из тех же схем, по
 * которым идёт проверка: разойтись они не могут, а разошедшись — отказали бы
 * ответу целиком (docs/07-maps.md).
 */

const REFS = { 'https://docdd/evidence.schema.json': evidenceSchema };

export function mapSchemas(): string {
  return [
    schemaDigest(codemapSchema, 'docdd-codemap', REFS),
    schemaDigest(dataflowSchema, 'docdd-dataflow', REFS),
    schemaDigest(userflowSchema, 'docdd-userflow', REFS),
    plainDigest(skippedSchema, 'docdd-skipped')
  ].join(String.fromCharCode(10).repeat(2));
}

/**
 * Блок без `added`/`removed`: у списка пропущенных файлов нет изменения — есть
 * решение, принятое один раз.
 */
function plainDigest(schema: unknown, block: string): string {
  const root = schema as { $defs?: Record<string, { required?: string[]; properties?: Record<string, unknown> }> };
  const file = root.$defs?.['file'];
  const required = new Set(file?.required ?? []);
  const lines = [`### Форма блока \`${block}\``, '', 'Объект с одним полем `files` — список:', ''];

  for (const name of Object.keys(file?.properties ?? {})) {
    lines.push(`  - \`${name}\`${required.has(name) ? ' — обязательное' : ''}`);
  }

  lines.push('', 'Других полей нет. Блока нет вовсе — значит пропущенных файлов нет.');
  return lines.join(String.fromCharCode(10));
}
