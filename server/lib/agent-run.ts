import type { Access } from '../utils/llm';

import type { AgentAccess, AgentDef } from './agents';

/**
 * «Запустить в работу» (R-0100, ADR-0033): какой агент берёт задачу и что ему
 * уходит в запрос. Чистые функции: аккаунт и файл агента находит маршрут, здесь
 * только выбор и сборка текста.
 */

export interface AgentAccount { login: string; name: string; agent?: { type: string } | undefined }

export type AgentChoice =
  | { ok: true; account: AgentAccount; agent: AgentDef }
  | { ok: false; code: 'assignee_not_agent' | 'agent_not_defined'; message: string };

/**
 * Агент задачи по исполнителю. Аккаунт агента несёт тип; файл берём с `id`,
 * равным типу, иначе первый того же типа — так набор по умолчанию и свои агенты
 * одного типа не спорят.
 */
export function agentForAssignee(assignee: string, accounts: readonly AgentAccount[], agents: readonly AgentDef[]): AgentChoice {
  const account = accounts.find((item) => item.login === assignee);
  if (!account?.agent) {
    return { ok: false, code: 'assignee_not_agent', message: assignee ? `Исполнитель задачи ${assignee} — не аккаунт агента: запускать некого` : 'У задачи нет исполнителя: назначьте аккаунт агента' };
  }
  const type = account.agent.type;
  const agent = agents.find((item) => item.id === type) ?? agents.find((item) => item.type === type);
  if (!agent) {
    return { ok: false, code: 'agent_not_defined', message: `Для типа «${type}» нет файла агента в docs/agents/: создайте его в «Настройки → Агенты»` };
  }
  return { ok: true, account, agent };
}

/** Что модели позволено: код пишет только агент с доступом `code`; остальные читают и двигают статусы через API. */
export const accessFor = (access: AgentAccess): Access => (access === 'code' ? 'full' : 'read');

export interface AgentApi { baseUrl: string; projectId: string; taskId: string; token: string }

const TICK = '`';
const code = (text: string) => TICK + text + TICK;

/**
 * Запрос агенту: системный промпт, затем рабочий контекст задачи (его собирает
 * `taskPrompt`), затем как ходить в API. Токен живёт один запуск и отдан только
 * этому агенту; права на нём — ADR-0033, п. 3.
 */
export function agentRunPrompt(agent: AgentDef, account: AgentAccount, taskPrompt: string, api: AgentApi): string {
  const base = `${api.baseUrl.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(api.projectId)}`;
  return [
    `# Ты — ${agent.title} (${account.login})`,
    '',
    agent.prompt.trim(),
    '',
    '---',
    '',
    taskPrompt.trim(),
    '',
    '## Как двигать статусы',
    '',
    `Статусы задач и проверок меняй через API консоли своим токеном — заголовок ${code(`Authorization: Bearer ${api.token}`)}:`,
    '',
    `- ${code(`POST ${base}/records/${api.taskId}/status`)} с телом ${code('{"status": "..."}')} — перевести задачу;`,
    `- ${code(`POST ${base}/records/<id>/discussion`)} — написать в обсуждение записи.`,
    '',
    'Токен выдан на этот запуск и больше нигде не пригодится. Документы подтверждает только человек; текст документов не правь; свою задачу не закрывай — её принимает ревьюер. Отказ сервера не обходи, а опиши в обсуждении задачи.'
  ].join('\n');
}
