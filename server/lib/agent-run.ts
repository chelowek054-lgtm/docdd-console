import type { Access } from '../utils/llm';

import type { AgentAccess, AgentDef } from './agents';

/**
 * «Запустить в работу» (R-0100, ADR-0033): какой агент берёт задачу, что ему
 * уходит в запрос и какие действия он вернул. Чистые функции: аккаунт и файл
 * агента находит маршрут, действия выполняет консоль через своё API токеном агента.
 *
 * Почему действия, а не вызов API самим агентом: агенты живут на общем сервере,
 * где модели без полного доступа командная строка закрыта; к тому же токен
 * тогда уходил бы провайдеру модели. Консоль же исполняет действия тем же API,
 * через те же права и ограничения, с подписью агента.
 */

export interface AgentAccount { login: string; name: string; agent?: { type: string } | undefined }
export interface TeamEntry { login: string; roles: readonly string[] }

export type AgentChoice =
  | { ok: true; account: AgentAccount; agent: AgentDef; roles: readonly string[] }
  | { ok: false; code: 'assignee_not_agent' | 'agent_not_defined' | 'agent_not_in_team'; message: string };

/**
 * Агент задачи по исполнителю. Аккаунт агента несёт тип; файл берём с `id`,
 * равным типу, иначе первый того же типа. Права агенту даёт строка в `team`
 * манифеста, как человеку: без неё любой его шаг отклонит сервер.
 */
export function agentForAssignee(
  assignee: string,
  accounts: readonly AgentAccount[],
  agents: readonly AgentDef[],
  team: readonly TeamEntry[] | undefined
): AgentChoice {
  const account = accounts.find((item) => item.login === assignee);
  if (!account?.agent) {
    return { ok: false, code: 'assignee_not_agent', message: assignee ? `Исполнитель задачи ${assignee} — не аккаунт агента: запускать некого` : 'У задачи нет исполнителя: назначьте аккаунт агента' };
  }
  const type = account.agent.type;
  const agent = agents.find((item) => item.id === type) ?? agents.find((item) => item.type === type);
  if (!agent) {
    return { ok: false, code: 'agent_not_defined', message: `Для типа «${type}» нет файла агента в docs/agents/: создайте его в «Настройки → Агенты»` };
  }
  const member = team?.find((item) => item.login === account.login);
  if (!member || member.roles.length === 0) {
    return { ok: false, code: 'agent_not_in_team', message: `Агент ${account.login} не в команде проекта: добавьте его с ролью в «Команда», иначе сервер отклонит каждый его шаг` };
  }
  return { ok: true, account, agent, roles: member.roles };
}

/** Что модели позволено в дереве задачи: код пишет только агент с доступом `code`; остальные читают. */
export const accessFor = (access: AgentAccess): Access => (access === 'code' ? 'full' : 'read');

export const ACTIONS_FENCE = 'docdd-actions';

export type AgentAction =
  | { do: 'status'; id: string; status: string }
  | { do: 'discussion'; id: string; text: string };

const TICK = '`';
const FENCE = TICK.repeat(3);

/** Правила проекта для запроса: длинный CLAUDE.md режем, чтобы он не съел бюджет задачи. */
export const RULES_LIMIT = 12_000;

/**
 * Запрос агенту: кто он и его системный промпт, правила проекта, рабочий
 * контекст задачи (его собирает `taskPrompt`: требования, карта, вектор,
 * практики, справочник) и как вернуть действия.
 */
export function agentRunPrompt(agent: AgentDef, account: AgentAccount, taskPrompt: string, taskId: string, rules = ''): string {
  const projectRules = rules.trim().length > RULES_LIMIT ? `${rules.trim().slice(0, RULES_LIMIT)}\n\n…(обрезано)` : rules.trim();
  return [
    `# Ты — ${agent.title} (${account.login})`,
    '',
    agent.prompt.trim(),
    '',
    ...(projectRules ? ['## Правила проекта', '', projectRules, ''] : []),
    '---',
    '',
    taskPrompt.trim(),
    '',
    '## Как двигать статусы',
    '',
    `Задача ${taskId} уже переведена в работу от твоего имени. Статусы и замечания ты не меняешь сам — перечисли их в конце ответа одним блоком ${TICK}${ACTIONS_FENCE}${TICK}, консоль выполнит их твоим аккаунтом в этом порядке:`,
    '',
    `${FENCE}${ACTIONS_FENCE}`,
    `[`,
    `  { "do": "discussion", "id": "${taskId}", "text": "что сделано и что проверить" },`,
    `  { "do": "status", "id": "${taskId}", "status": "in_review" }`,
    `]`,
    FENCE,
    '',
    'Документы подтверждает только человек; свою задачу не закрывай — её принимает ревьюер. Такие действия сервер отклонит, и отказ будет виден в журнале запуска.'
  ].join('\n');
}

const ID = /^[A-Za-z]+-\d+$/;
const STATUS = /^[a-z_]+$/;

/**
 * Действия из ответа агента: последний блок `docdd-actions`. Кривое не роняет
 * разбор — оно называется в `problems`, а годное выполняется.
 */
export function parseAgentActions(answer: string): { actions: AgentAction[]; problems: string[] } {
  const blocks = [...answer.matchAll(new RegExp(`${FENCE}${ACTIONS_FENCE}[ \\t]*\\r?\\n([\\s\\S]*?)${FENCE}`, 'g'))];
  const last = blocks.at(-1)?.[1];
  if (last === undefined) return { actions: [], problems: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(last);
  } catch (error) {
    return { actions: [], problems: [`Блок ${ACTIONS_FENCE} не читается как JSON: ${String(error)}`] };
  }
  if (!Array.isArray(raw)) return { actions: [], problems: [`Блок ${ACTIONS_FENCE} должен быть списком`] };
  const actions: AgentAction[] = [];
  const problems: string[] = [];
  raw.forEach((item, at) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const id = typeof entry['id'] === 'string' ? entry['id'] : '';
    if (!ID.test(id)) { problems.push(`Действие ${at + 1}: нет id записи`); return; }
    if (entry['do'] === 'status' && typeof entry['status'] === 'string' && STATUS.test(entry['status'])) {
      actions.push({ do: 'status', id, status: entry['status'] });
    } else if (entry['do'] === 'discussion' && typeof entry['text'] === 'string' && entry['text'].trim()) {
      actions.push({ do: 'discussion', id, text: entry['text'].trim() });
    } else {
      problems.push(`Действие ${at + 1}: известны только status (с полем status) и discussion (с полем text)`);
    }
  });
  return { actions, problems };
}
