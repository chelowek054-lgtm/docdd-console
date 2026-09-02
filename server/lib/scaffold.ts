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
  /**
   * Тело записи. Не задано — заготовка с подсказкой, что писать. Задаётся
   * при разборе входящего: текст там уже есть, и просить писать его заново
   * значило бы терять сделанное (docs/10-inbox.md).
   */
  body?: string;
  /**
   * Откуда запись взялась: имя заметки входящего. Уходит в журнал —
   * через месяц вопрос «откуда это» задаётся обязательно.
   */
  source?: string;
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

  const said = (input.body ?? '').trim();
  const body = said === '' ? 'Зачем это, что делаем, чего не делаем, как понять, что готово.' : said;

  lines.push(
    '---',
    '',
    `# ${input.title}`,
    '',
    ...body.split(NEW_LINE),
    '',
    '## Журнал',
    '',
    `- ${input.today} · ${input.source ? `заведена из ${input.source}` : 'заведена'} · приложение`,
    ''
  );

  return lines.join(eol);
}

/** Склад сырых заметок по умолчанию: он же попадает в манифест (docs/10-inbox.md). */
export const DEFAULT_INBOX = 'docs/inbox';

export interface ManifestInput {
  id: string;
  name: string;
  description?: string;
  /** Где склад сырых заметок: правила для модели называют его поимённо. */
  inbox?: string;
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
    '  # Где лежат сырые заметки: из них заводятся записи (docs/10-inbox.md).',
    `  inbox: [${input.inbox ?? DEFAULT_INBOX}]`,
    'roles:',
    '  - id: architect',
    '    name: Архитектор',
    'policy:',
    '  require_approved_docs_before_dev: true',
    '  require_verification_before_done: true',
    '  stale_in_progress_days: 14',
    '  map_portion_files: 40',
    ''
  );
  return lines.join(eol);
}

/**
 * Правила для модели, работающей в этом проекте. Кладутся в корень при
 * заведении формата: без них модель, запущенная в папке проекта, про DocDD не
 * знает ничего и работает мимо правил (docs/08-usage.md).
 *
 * Файл — про порядок работы, а не про устройство проекта: устройство живёт в
 * картах и меняется, порядок — нет.
 */
const NEW_LINE = String.fromCharCode(10);

const DOCDD_IGNORE_LINE = '.docdd/';

/**
 * `.gitignore` с обязательной строкой `.docdd/`.
 *
 * `.docdd/worktrees/` — рабочие деревья задач и починки, каждое со своим
 * `.git`. Не исключишь их из чужого репозитория — git проекта увидит вложенный
 * `.git` как gitlink и станет считать рабочий каталог грязным при каждом новом
 * коммите внутри дерева задачи, хотя человек ничего не менял (так вышло на
 * InteractMed: слияние отказало с «есть несохранённые изменения», хотя
 * человек ничего не трогал). `existing` — уже имеющийся файл, `null`, если
 * его ещё нет.
 */
export function gitignoreWithDocdd(existing: string | null, eol = NEW_LINE): string {
  if (existing === null) return DOCDD_IGNORE_LINE + eol;

  const already = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === DOCDD_IGNORE_LINE || line.trim() === '.docdd');
  if (already) return existing;

  const separator = existing.endsWith(eol) || existing === '' ? '' : eol;
  return existing + separator + DOCDD_IGNORE_LINE + eol;
}

export function claudeMd(input: ManifestInput, eol = NEW_LINE): string {
  const lines = [
    `# ${input.name}: правила работы`,
    '',
    'Проект ведётся по **Documentation Driven Development**: документ ведёт код.',
    '',
    '```',
    'намерение → правка документа → подтверждение человеком → код → сверка',
    '```',
    '',
    '## Главное правило',
    '',
    '**Изменение кода не начинается, пока правка документации не подтверждена',
    'человеком.** Не «показана» — подтверждена. Молчание подтверждением не',
    'является.',
    '',
    'На практике:',
    '',
    '1. Найти запись в `docs/development`, которая описывает то, что предстоит',
    '   менять. Нет такой — сперва завести её, а не начинать с кода.',
    '2. Внести правку и показать человеку, назвав, что изменится в коде.',
    '3. Дождаться подтверждения.',
    '4. Написать код — ровно то, что описано, не больше.',
    '5. Сверить: документ и код говорят одно и то же.',
    '',
    'Исключения: опечатки, форматирование, переименование внутреннего, починка',
    'дефекта, восстанавливающая уже описанное поведение. Если дефект показал, что',
    'документ описывал не то, — сперва правится документ.',
    '',
    '## Где что лежит',
    '',
    '`docs/development` — записи процесса. У каждой свой тип, идентификатор и',
    'статус:',
    '',
    '| Тип | Префикс | О чём |',
    '|---|---|---|',
    '| requirement | `R-` | Что нужно и зачем |',
    '| design | `D-` | Как решено делать |',
    '| decision | `A-` | Выбор с последствиями |',
    '| contract | `C-` | Договорённость на стыке |',
    '| task | `T-` | Что делаем сейчас |',
    '| phase | `P-` | Из чего состоит этап |',
    '| verification | `V-` | Чем проверяется |',
    '| map | `M-` | Устройство: код, потоки, пути |',
    '',
    'Номера не переиспользуются: удалённая запись оставляет дыру, и это',
    'нормально.',
    '',
    '## Чего делать нельзя',
    '',
    '- **Не подтверждать документы за человека.** Статус `approved` ставит',
    '  человек через приложение — это его действие, и подменять его нельзя.',
    '- **Не переписывать тело чужих записей.** Меняются front matter и строка в',
    '  разделе «Журнал»; остальное — правка смысла, а её подтверждают.',
    '- **Не начинать задачу без требования.** У задачи обязателен `implements`,',
    '  начиная со статуса `ready`: работа без требования не проверяется фактом.',
    '- **Не обходить правило кнопкой.** Ошибка валидатора — свойство процесса, а',
    '  не досадная помеха.',
    '',
    '## Утверждение требует свидетельства',
    '',
    'Сказал «модуль A зависит от B» — покажи строку: путь, номер, фрагмент.',
    'Приложение сверяет каждое свидетельство с настоящим файлом. Утверждение без',
    'свидетельства — мнение, а не карта.',
    '',
    'Чего не понял — так и скажи. Догадка, выданная за факт, дороже пробела.',
    '',
    '## Куда складывать сырое',
    '',
    'Обсуждение, бриф, набросок — всё, до чего договорились, но что ещё не',
    `разложено на записи, — кладётся файлами в \`${input.inbox ?? DEFAULT_INBOX}\`. Это склад:`,
    'из него потом заводят требования и задачи.',
    '',
    '- **Один файл — одна тема.** Разбор идёт по файлам, и файл на сорок разных',
    '  мыслей разложится хуже, чем сорок файлов по одной.',
    '- Имя — по смыслу, латиницей через дефис: `oplata-kartoy.md`.',
    '- Внутри — своими словами: зачем нужно, что считается сделанным, чего не',
    '  делаем, что мешает. Никакой схемы: форму придаст приложение.',
    '- **Не выдумывай номера** вида `R-0001` и **не пиши front matter**: это не',
    '  запись процесса, а заметка.',
    '- **Не клади заметки в `docs/development`** — там схема, и сырой текст даст',
    '  ошибку разбора.',
    '',
    'Что дальше: во вкладке «Входящее» человек нажимает «Разобрать входящее» —',
    'приложение показывает список записей, которые из заметок выходят, человек',
    'его правит и заводит. Номера выдаёт приложение, статус у всех заведённых —',
    'черновик.',
    '',
    'Поэтому не заводи записи сам и не проси об этом: твоя часть — положить',
    'заметку так, чтобы её было из чего разложить.',
    '',
    '## Язык',
    '',
    'Записи и общение — по-русски. Комментарий объясняет **почему**, а не',
    'пересказывает код.',
    ''
  ];
  return lines.join(eol);
}

export function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}
