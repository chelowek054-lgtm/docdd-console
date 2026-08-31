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
export const STATE_MARKER = '<!-- СОСТОЯНИЕ -->';

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

  return body.replace(ISSUES_MARKER, list);
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
}

export function mapsPrompt(template: string, state: MapsState): string {
  const body = withoutFrontNote(template);
  const lines: string[] = [];

  lines.push('## Состояние на сейчас', '');
  lines.push(state.from.length === 0
    ? 'Подтверждённых карт нет: это первая карта проекта, опиши устройство целиком.'
    : `Сложено из ${state.from.length} подтверждённых карт (${state.from.join(', ')}): ${state.modules} модулей, ${state.sources} источников данных, ${state.screens} экранов. Опиши **изменение** к этой картине.`);
  lines.push('');
  lines.push(`Код лежит в: ${listOf(state.code)}.`);
  lines.push(`Клиентская часть: ${listOf(state.client)}.`);

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

  return body.replace(STATE_MARKER, lines.join(LF));
}

function listOf(values: readonly string[]): string {
  return values.length === 0 ? 'не объявлено в манифесте' : values.map((value) => `\`${value}\``).join(', ');
}
