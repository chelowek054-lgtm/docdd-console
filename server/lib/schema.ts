// Расширение обязательно: без него сборка Nitro для Node не находит модуль,
// хотя сборщик и tsc его разрешают. Проверено запуском, а не догадкой.
import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import codemapSchema from '../../docs/schemas/codemap.schema.json';
import dataflowSchema from '../../docs/schemas/dataflow.schema.json';
import evidenceSchema from '../../docs/schemas/evidence.schema.json';
import frontmatterSchema from '../../docs/schemas/frontmatter.schema.json';
import projectSchema from '../../docs/schemas/project.schema.json';
import reportSchema from '../../docs/schemas/report.schema.json';
import recordsSchema from '../../docs/schemas/records.schema.json';
import skippedSchema from '../../docs/schemas/skipped.schema.json';
import userflowSchema from '../../docs/schemas/userflow.schema.json';

/** Схемы берутся прямо из docs/schemas: копия разошлась бы с контрактом в первую же неделю. */

export interface SchemaIssue {
  /** Путь к полю в понятном человеку виде: `links.implements[0]`. */
  field: string;
  /** Он же в виде JSON Pointer: по нему подавляются дубли с `id_mismatch`. */
  instancePath: string;
  message: string;
}

// Ajv и ajv-formats опубликованы как CommonJS, и при импорте в ESM конструктор
// оказывается либо в `default`, либо в самом объекте — зависит от сборщика.
/* eslint-disable @typescript-eslint/no-explicit-any */
const AjvCtor: typeof Ajv2020 = ((Ajv2020 as any).default ?? Ajv2020) as typeof Ajv2020;
const applyFormats: typeof addFormats = ((addFormats as any).default ?? addFormats) as typeof addFormats;
/* eslint-enable @typescript-eslint/no-explicit-any */

const ajv = new AjvCtor({ allErrors: true, strict: false });
applyFormats(ajv);

// Свидетельство общее для трёх карт, поэтому регистрируется по своему $id.
ajv.addSchema(evidenceSchema);

const validateFrontmatterSchema = ajv.compile(frontmatterSchema);
const validateProjectSchema = ajv.compile(projectSchema);
const validateReportSchema = ajv.compile(reportSchema);
const validateCodemapSchema = ajv.compile(codemapSchema);
const validateDataflowSchema = ajv.compile(dataflowSchema);
const validateUserflowSchema = ajv.compile(userflowSchema);
const validateRecordsSchema = ajv.compile(recordsSchema);
const validateSkippedSchema = ajv.compile(skippedSchema);

export function validateFrontMatter(data: unknown): SchemaIssue[] {
  return run(validateFrontmatterSchema, data);
}

/**
 * Поколение контракта проверяется до всего остального: `docdd.workspace/2` —
 * отказ с понятной причиной, а не попытка прочитать половину.
 */
export function validateProject(data: unknown): SchemaIssue[] {
  const contract = (data as { contract?: unknown } | null)?.contract;
  if (contract !== undefined && contract !== 'docdd.workspace/1') {
    return [{
      field: 'contract',
      instancePath: '/contract',
      message: `Поколение контракта \`${String(contract)}\` не поддерживается. Это приложение читает \`docdd.workspace/1\`; нужна явная миграция проекта.`
    }];
  }
  return run(validateProjectSchema, data);
}

export function validateReport(data: unknown): SchemaIssue[] {
  return run(validateReportSchema, data);
}

export function validateCodemap(data: unknown): SchemaIssue[] {
  return run(validateCodemapSchema, data);
}

export function validateDataflow(data: unknown): SchemaIssue[] {
  return run(validateDataflowSchema, data);
}

export function validateUserflow(data: unknown): SchemaIssue[] {
  return run(validateUserflowSchema, data);
}

/** Файлы, которые модель сознательно не описала (docs/07-maps.md). */
export function validateSkipped(data: unknown): SchemaIssue[] {
  return run(validateSkippedSchema, data);
}

/** Предложенные записи из разбора входящего (docs/10-inbox.md). */
export function validateRecords(data: unknown): SchemaIssue[] {
  return run(validateRecordsSchema, data);
}

function run(validate: ValidateFunction, data: unknown): SchemaIssue[] {
  if (validate(data)) return [];
  // Ветвление `if/then` Ajv отмечает отдельной ошибкой на корне записи. Причина
  // уже названа ошибкой внутри ветви, а «must match then schema» человеку
  // ничего не объясняет — и мешает подавлять дубли по полю.
  const errors = (validate.errors ?? []).filter((error) => error.keyword !== 'if');
  const issues = errors.map(toIssue);
  // Ajv повторяет одну беду в разных ветвях `allOf`; человеку нужен один пункт.
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.instancePath}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toIssue(error: ErrorObject): SchemaIssue {
  const instancePath = error.instancePath;
  const field = fieldName(instancePath);
  return { field, instancePath, message: explain(error, field) };
}

/** `/links/implements/0` → `links.implements[0]`; пустой путь — корень записи. */
function fieldName(instancePath: string): string {
  if (!instancePath) return '';
  return instancePath
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((acc, part) => (/^\d+$/.test(part) ? `${acc}[${part}]` : acc ? `${acc}.${part}` : part), '');
}

/**
 * Сообщение объясняет, что сделать. «Ошибка валидации» заставляет искать,
 * названное поле с допустимыми значениями — чинить.
 */
function explain(error: ErrorObject, field: string): string {
  const where = field ? `Поле \`${field}\`` : 'Запись';
  switch (error.keyword) {
    case 'required': {
      const missing = (error.params as { missingProperty: string }).missingProperty;
      const scope = field ? ` в \`${field}\`` : '';
      return `Не хватает обязательного поля \`${missing}\`${scope}.`;
    }
    case 'enum': {
      const allowed = (error.params as { allowedValues: unknown[] }).allowedValues;
      return `${where}: допустимы только ${allowed.map((v) => `\`${String(v)}\``).join(', ')}.`;
    }
    case 'const': {
      const allowed = (error.params as { allowedValue: unknown }).allowedValue;
      return `${where}: ожидается \`${String(allowed)}\`.`;
    }
    case 'pattern': {
      const pattern = (error.params as { pattern: string }).pattern;
      return `${where}: значение не соответствует форме \`${pattern}\`.`;
    }
    case 'type': {
      const expected = (error.params as { type: string }).type;
      return `${where}: ожидается ${expected}.`;
    }
    case 'format': {
      const format = (error.params as { format: string }).format;
      return format === 'date'
        ? `${where}: ожидается дата вида 2026-08-30.`
        : `${where}: значение не соответствует формату \`${format}\`.`;
    }
    case 'additionalProperties': {
      const extra = (error.params as { additionalProperty: string }).additionalProperty;
      const scope = field ? `\`${field}\`` : 'записи';
      return `Незнакомое поле \`${extra}\` в ${scope}: здесь список полей закрыт контрактом.`;
    }
    case 'uniqueItems':
      return `${where}: в списке есть повторы.`;
    case 'minLength':
      return `${where}: значение не может быть пустым.`;
    case 'minimum': {
      const limit = (error.params as { limit: number }).limit;
      return `${where}: значение не может быть меньше ${limit}.`;
    }
    case 'propertyNames':
      return `${where}: ключ не похож на идентификатор проверки вида V-0004.`;
    default:
      return `${where}: ${error.message ?? 'значение не проходит проверку по схеме'}.`;
  }
}
