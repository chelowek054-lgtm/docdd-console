import { PREFIX_BY_TYPE, RECORD_TYPES, SECTION_BY_TYPE, type LinkKind, type RecordType, type SectionKey } from './types';

export { PREFIX_BY_TYPE, SECTION_BY_TYPE };

/**
 * Заведение записей и формата: шаблоны, слаги, выдача номеров. Чистые функции
 * над строками — папки создаёт маршрут.
 */

/** Папки разделов по умолчанию: те же имена, что в примере контракта. */
export const DEFAULT_PATHS: Readonly<Record<SectionKey, string>> = {
  requirements: 'requirements',
  design: 'design',
  decisions: 'decisions',
  contracts: 'contracts',
  tasks: 'tasks',
  phases: 'phases',
  tests: 'tests',
  diagrams: 'diagrams',
  maps: 'maps'
};

const CYRILLIC: Readonly<Record<string, string>> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

/**
 * Слаг латиницей (docs/02-workspace-contract.md): кириллица в имени файла
 * работает не везде одинаково, а имя файла для процесса ничего не значит.
 */
export function slugify(title: string, limit = 48): string {
  const latin = [...title.toLowerCase()]
    .map((letter) => CYRILLIC[letter] ?? letter)
    .join('');

  const slug = latin
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, limit)
    .replace(/-+$/, '');

  // Заголовок мог не дать ни одной подходящей буквы — имя файла всё равно нужно.
  return slug || 'zapis';
}

/**
 * Следующий свободный номер. Номера не переиспользуются: удалённая запись
 * оставляет дыру, и занимать её нельзя — ссылка на прежнюю не должна вдруг
 * указать на другое.
 */
export function nextId(type: RecordType, taken: Iterable<string>): string {
  const prefix = PREFIX_BY_TYPE[type];
  let highest = 0;
  for (const id of taken) {
    const match = new RegExp(`^${prefix}-(\\d{4})$`).exec(id);
    if (match?.[1]) highest = Math.max(highest, Number(match[1]));
  }
  if (highest >= 9999) {
    throw new Error(`Свободных номеров для типа \`${type}\` не осталось: последний ${prefix}-9999.`);
  }
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}

export function fileNameFor(id: string, title: string): string {
  return `${id}-${slugify(title)}.md`;
}

export interface TemplateInput {
  id: string;
  type: RecordType;
  title: string;
  today: string;
  owner?: string;
  links?: Partial<Record<LinkKind, string[]>>;
  /** Вид проверки: схема требует его у записей типа `verification`. */
  kind?: string;
  /** Что за изменение: `feature` потребует карты ещё до `ready`. */
  change?: string;
}

/** Начальный статус: всё заводится черновиком, задача — очередью. */
export function initialStatus(type: RecordType): string {
  if (type === 'task') return 'backlog';
  if (type === 'phase') return 'planned';
  return 'draft';
}

/**
 * Текст новой записи. Тело — подсказка человеку о том, что в нём должно быть;
 * дальше оно принадлежит только ему.
 */
export function recordTemplate(input: TemplateInput, eol = '\n'): string {
  const lines = [
    '---',
    `id: ${input.id}`,
    `type: ${input.type}`,
    `title: ${input.title}`,
    `status: ${initialStatus(input.type)}`
  ];
  if (input.owner) lines.push(`owner: ${input.owner}`);
  if (input.type === 'task' && input.change) lines.push(`change: ${input.change}`);
  lines.push(`created: ${input.today}`, `updated: ${input.today}`);
  if (input.type === 'verification') lines.push(`kind: ${input.kind ?? 'manual'}`);

  const links = input.links ?? {};
  const kinds = (Object.keys(links) as LinkKind[]).filter((kind) => (links[kind]?.length ?? 0) > 0);
  if (kinds.length > 0) {
    lines.push('links:');
    for (const kind of kinds) lines.push(`  ${kind}: [${(links[kind] ?? []).join(', ')}]`);
  } else if (input.type === 'task') {
    // Задаче схема требует `links`, даже пустые: связь появится, когда появится.
    lines.push('links: {}');
  }

  lines.push(
    '---',
    '',
    `# ${input.title}`,
    '',
    'Зачем это, что делаем, чего не делаем, как понять, что готово.',
    '',
    '## Журнал',
    '',
    `- ${input.today} · заведена · приложение`,
    ''
  );

  return lines.join(eol);
}

export interface ManifestInput {
  id: string;
  name: string;
  description?: string;
}

/**
 * Манифест пустого проекта. Пишется текстом, а не сериализацией объекта:
 * человек будет его читать и править, и порядок ключей с комментариями здесь
 * важнее краткости кода.
 */
export function manifestYaml(input: ManifestInput, eol = '\n'): string {
  const lines = [
    'contract: docdd.workspace/1',
    'project:',
    `  id: ${input.id}`,
    `  name: ${input.name}`
  ];
  if (input.description) lines.push(`  description: ${input.description}`);
  lines.push(
    'paths:',
    ...(Object.keys(DEFAULT_PATHS) as SectionKey[]).map((key) => `  ${key}: ${DEFAULT_PATHS[key]}`),
    'sources:',
    '  # Где лежит код: по нему проверяются ссылки из документов.',
    '  code: []',
    '  # Где лежит старая документация: с неё начинается импорт.',
    '  docs: []',
    '  # Где живёт клиентская часть: по ней строится карта пользовательских путей.',
    '  client: []',
    'roles:',
    '  - id: architect',
    '    name: Архитектор',
    'policy:',
    '  require_approved_docs_before_dev: true',
    '  require_verification_before_done: true',
    '  stale_in_progress_days: 14',
    ''
  );
  return lines.join(eol);
}

export function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}
