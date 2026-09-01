import codemapSchema from '../../docs/schemas/codemap.schema.json';
import dataflowSchema from '../../docs/schemas/dataflow.schema.json';
import evidenceSchema from '../../docs/schemas/evidence.schema.json';
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
    schemaDigest(userflowSchema, 'docdd-userflow', REFS)
  ].join(String.fromCharCode(10).repeat(2));
}
