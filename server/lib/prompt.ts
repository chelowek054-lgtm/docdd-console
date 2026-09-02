import { contractDigest } from './contract-digest';
import type { IssueDto } from './types';

/**
 * Сборка запроса к модели: шаблон из репозитория плюс данные проекта.
 * Чистые функции над строками — сам шаблон приходит снаружи, а запуск модели
 * живёт в `server/utils/llm.ts` (docs/adr/0008-llm-through-claude-code.md).
 *
 * Приложение не сочиняет текст запроса. Оно подставляет в него то, что знает:
 * качество запроса — это содержимое репозитория, и спорить о нём нужно в дифф.
 */

const LF = String.fromCharCode(10);

export const ISSUES_MARKER = '<!-- НАРУШЕНИЯ -->';
export const CONTRACT_MARKER = '<!-- КОНТРАКТ -->';
export const STATE_MARKER = '<!-- СОСТОЯНИЕ -->';
export const TASK_MARKER = '<!-- ЗАДАЧА -->';

/** Шапка шаблона — объяснение для человека, модели она не нужна. */
function withoutFrontNote(template: string): string {
  const at = template.indexOf(`${LF}---${LF}`);
  return at === -1 ? template : template.slice(at + 5).trimStart();
}

export function fixPrompt(template: string, issues: readonly IssueDto[]): string {
  const body = withoutFrontNote(template);

  const list = issues.length === 0
    ? 'Нарушений нет.'
    : issues.map((issue, at) => [
      `### ${at + 1}. \`${issue.code}\` — ${issue.severity === 'error' ? 'ошибка' : 'предупреждение'}`,
      '',
      issue.recordId ? `Запись: ${issue.recordId}` : 'Запись: не определена',
      `Файл: \`${issue.path}\``,
      '',
      issue.message
    ].join(LF)).join(LF + LF);

  return body.replace(ISSUES_MARKER, list).replace(CONTRACT_MARKER, contractDigest());
}

export interface MapsState {
  /** Карты, из которых сложена текущая картина. */
  from: readonly string[];
  modules: number;
  sources: number;
  screens: number;
  /** Утверждения, переставшие сходиться: их и надо переописать в первую очередь. */
  unverified: readonly { label: string; path: string; line: number; verdict: string }[];
  /** Каталоги, объявленные в манифесте: где модели искать код и клиент. */
  code: readonly string[];
  client: readonly string[];
  /** Опись: что описывать сейчас и сколько осталось (docs/07-maps.md). */
  inventory?: {
    total: number;
    describedCount: number;
    next: readonly string[];
    gone: readonly string[];
    changed: readonly string[];
    left: number;
  };
}

/** Места, куда подставляется входящее и уже заведённое. */
export const NOTES_MARKER = '<!-- ЗАМЕТКИ -->';
export const KNOWN_MARKER = '<!-- ЗАВЕДЕНО -->';

/**
 * Разбор входящего: сырые заметки и список уже заведённого, чтобы модель не
 * предлагала второй раз то, что есть (docs/10-inbox.md).
 */
export function inboxPrompt(
  template: string,
  notes: readonly { path: string; title: string; text: string }[],
  known: readonly { id: string; type: string; title: string }[]
): string {
  const said = notes.length
    ? notes.map((note) => [`### ${note.title}`, '', `Файл: \`${note.path}\``, '', note.text.trim()].join(LF)).join(LF + LF)
    : 'Заметок нет.';

  const already = known.length
    ? known.map((record) => `- \`${record.id}\` (${record.type}) — ${record.title}`).join(LF)
    : 'Пока не заведено ничего: это первые записи проекта.';

  return withoutFrontNote(template)
    .replace(NOTES_MARKER, said)
    .replace(KNOWN_MARKER, already);
}

/** Места, куда подставляется прошлый ответ и претензии схемы к нему. */
export const ANSWER_MARKER = '<!-- ОТВЕТ -->';
export const PROBLEMS_MARKER = '<!-- ПРЕТЕНЗИИ -->';

/**
 * Просьба поправить ответ, не прошедший схему. Разбор файлов заново не идёт:
 * работа сделана, чинится только форма (docs/07-maps.md).
 */
export function mapFixPrompt(template: string, answer: string, problems: readonly string[]): string {
  const said = problems.length
    ? problems.map((problem) => `- ${problem}`).join(LF)
    : '- Схема не сошлась, а причину приложение не назвало.';

  return withoutFrontNote(template)
    .replace(PROBLEMS_MARKER, said)
    .replace(ANSWER_MARKER, answer.trim());
}

/** Место, куда подставляется форма блоков карты. */
export const SCHEMAS_MARKER = '<!-- СХЕМЫ -->';

export function mapsPrompt(template: string, state: MapsState, schemas = ''): string {
  const body = withoutFrontNote(template);
  const lines: string[] = [];

  lines.push('## Состояние на сейчас', '');
  lines.push(state.from.length === 0
    ? 'Подтверждённых карт нет: это первая карта проекта, опиши устройство целиком.'
    : `Сложено из ${state.from.length} подтверждённых карт (${state.from.join(', ')}): ${state.modules} модулей, ${state.sources} источников данных, ${state.screens} экранов. Опиши **изменение** к этой картине.`);
  lines.push('');
  lines.push(`Код лежит в: ${listOf(state.code)}.`);
  lines.push(`Клиентская часть: ${listOf(state.client)}.`);

  const inventory = state.inventory;
  if (inventory) {
    lines.push('', '## Что описывать', '');
    lines.push(
      `Файлов кода: ${inventory.total}, из них описано подтверждёнными картами ${inventory.describedCount}.`
    );
    lines.push('');
    lines.push('**Опиши ровно эти файлы и ничего сверх них** — остальные уже описаны, и переописывать их не надо:', '');
    for (const path of inventory.next) lines.push(`- \`${path}\``);

    if (inventory.left > 0) {
      lines.push('', `Это порция: после неё останется ещё ${inventory.left} файлов. Их опишет следующий заход — не пытайся охватить всё разом.`);
    }

    if (inventory.changed.length > 0) {
      lines.push('', `Из них изменились после описания: ${inventory.changed.map((path) => '`' + path + '`').join(', ')}. Про них карта сейчас говорит неправду.`);
    }

    if (inventory.gone.length > 0) {
      lines.push('', '**Этих файлов больше нет** — объяви убранным всё, что на них опиралось:', '');
      for (const path of inventory.gone.slice(0, 40)) lines.push(`- \`${path}\``);
    }
  }

  if (state.unverified.length > 0) {
    lines.push('', '## Что перестало сходиться', '');
    lines.push('Свидетельства этих утверждений больше не совпадают с файлами — их надо переописать или объявить убранными:', '');
    for (const item of state.unverified.slice(0, 40)) {
      lines.push(`- ${item.label} — \`${item.path}\`:${item.line} (${item.verdict})`);
    }
    if (state.unverified.length > 40) {
      lines.push(`- …и ещё ${state.unverified.length - 40}`);
    }
  }

  // Форма блоков идёт в самом запросе: сослаться на файл схемы нельзя —
  // модель работает в чужом проекте, а схемы живут здесь.
  return body.replace(STATE_MARKER, lines.join(LF)).replace(SCHEMAS_MARKER, schemas);
}

export interface TaskContext {
  id: string;
  title: string;
  /** Тело задачи без раздела «Журнал»: он про движение, а не про суть. */
  body: string;
  requirements: { id: string; title: string; body: string }[];
  documents: { id: string; title: string; body: string }[];
  /** Карта изменения: что задача меняет в устройстве. */
  map: string;
  /** Сжатая карта проекта: где что лежит, без обхода всех файлов. */
  modules: { id: string; title?: string; layer?: string }[];
  /** Что человек сказал по прошлому заходу. Пусто — заход первый. */
  rework: string;
  round: number;
}

/**
 * Запрос на выполнение задачи. Подтверждённое кладётся целиком, устройство —
 * сжатой картой: три тысячи знаков вместо трёхсот тысяч исходников
 * (docs/09-execution.md).
 */
export function taskPrompt(template: string, task: TaskContext): string {
  const body = withoutFrontNote(template);
  const lines: string[] = [];

  lines.push(`## Задача ${task.id}: ${task.title}`, '', task.body.trim(), '');

  for (const requirement of task.requirements) {
    lines.push(`## Требование ${requirement.id}: ${requirement.title}`, '', requirement.body.trim(), '');
  }
  for (const document of task.documents) {
    lines.push(`## Документ ${document.id}: ${document.title}`, '', document.body.trim(), '');
  }
  if (task.map.trim()) {
    lines.push('## Что меняется в устройстве', '', task.map.trim(), '');
  }

  if (task.modules.length > 0) {
    lines.push('## Где что лежит', '');
    lines.push('Подтверждённая карта проекта — по ней видно устройство, читать все файлы не нужно:', '');
    for (const module of task.modules) {
      const title = module.title ? ` — ${module.title}` : '';
      const layer = module.layer ? ` [${module.layer}]` : '';
      lines.push(`- \`${module.id}\`${title}${layer}`);
    }
    lines.push('');
  }

  if (task.rework.trim()) {
    lines.push(
      `## Заход ${task.round}: что не так с прошлым`,
      '',
      task.rework.trim(),
      '',
      'Правь то, что уже написано в этой ветке, а не начинай заново.',
      ''
    );
  }

  return body.replace(TASK_MARKER, lines.join(LF));
}

function listOf(values: readonly string[]): string {
  return values.length === 0 ? 'не объявлено в манифесте' : values.map((value) => `\`${value}\``).join(', ');
}
