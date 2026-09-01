/**
 * Выжимка из JSON Schema — человеческим языком, для запроса к модели.
 *
 * Запрос не может сослаться на файл схемы: модель работает в чужом проекте, а
 * схемы лежат здесь. Ссылка на несуществующий файл кончается тем, что модель
 * придумывает форму сама и ответ не проходит проверку целиком.
 *
 * Выжимка считается из той же схемы, по которой идёт проверка, — поэтому
 * разойтись они не могут.
 */

const NEW_LINE = String.fromCharCode(10);

interface JsonSchema {
  type?: string;
  enum?: readonly string[];
  const?: string;
  required?: readonly string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  items?: JsonSchema;
  description?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
}

/**
 * Разыменование `$ref`: внутренние — по `$defs`, внешние — по словарю,
 * который передаёт вызывающий. Свидетельство описано отдельной схемой, и без
 * него выжимка молчала бы о самом важном поле карты.
 */
function resolve(schema: JsonSchema, root: JsonSchema, known: Record<string, JsonSchema> = {}): JsonSchema {
  const ref = schema.$ref;
  if (!ref) return schema;
  if (ref.startsWith('#/$defs/')) return root.$defs?.[ref.slice('#/$defs/'.length)] ?? schema;
  return known[ref] ?? schema;
}

function fieldOf(name: string, field: JsonSchema, required: boolean): string {
  const marks: string[] = [];
  if (required) marks.push('обязательное');
  if (field.enum) marks.push(`одно из: ${field.enum.join(', ')}`);
  else if (field.type === 'array') marks.push('список');
  else if (field.type && field.type !== 'string') marks.push(field.type);

  const said = marks.length ? ` — ${marks.join('; ')}` : '';
  return `  - \`${name}\`${said}`;
}

/** Список полей одного объекта: что можно, что обязательно, чего нельзя. */
function objectOf(title: string, schema: JsonSchema, root: JsonSchema, known: Record<string, JsonSchema>): string[] {
  const resolved = resolve(schema, root, known);
  const properties = resolved.properties ?? {};
  const required = new Set(resolved.required ?? []);

  const lines = ['- **`' + title + '`**:'];
  for (const [name, field] of Object.entries(properties)) {
    const inner = resolve(field, root, known);
    lines.push(fieldOf(name, inner, required.has(name)));

    // Вложенный объект (свидетельство) расписывается тут же: его поля тоже
    // закрыты, и модель должна их видеть.
    const nested = inner.type === 'array' ? resolve(inner.items ?? {}, root, known) : inner;
    if (nested.properties) {
      const innerRequired = new Set(nested.required ?? []);
      for (const [child, value] of Object.entries(nested.properties)) {
        lines.push(`  ${fieldOf(`${name}.${child}`, resolve(value, root, known), innerRequired.has(child))}`);
      }
    }
  }
  return lines;
}

/**
 * Вся форма блока карты: `added`/`removed`, их списки и поля каждого элемента.
 * Возвращается кусок разметки — он подставляется прямо в запрос.
 */
export function schemaDigest(schema: unknown, block: string, refs: Record<string, unknown> = {}): string {
  const root = schema as JsonSchema;
  const known = refs as Record<string, JsonSchema>;
  const part = resolve(root.properties?.['added'] ?? {}, root, known);

  const lines: string[] = [
    `### Форма блока \`${block}\``,
    '',
    'Верхний уровень — объект с `added` и, если что-то убрано, `removed`.',
    'Внутри каждого:',
    ''
  ];

  for (const [listName, list] of Object.entries(part.properties ?? {})) {
    const item = resolve(list.items ?? {}, root, known);
    lines.push(...objectOf(listName, item, root, known), '');
  }

  lines.push('Других полей нет. Поле, которого нет в этом списке, — отказ всей');
  lines.push('карты целиком, а не предупреждение: список закрыт контрактом.');

  return lines.join(NEW_LINE);
}
