import { existsSync, readFileSync } from 'node:fs';

import { accessFor, agentForAssignee, agentRunPrompt, parseAgentActions, type AgentAction, type AgentChoice } from '../lib/agent-run';
import { agentSignature } from '../lib/agents';
import { signature } from '../lib/auth';
import { resolveInside } from '../lib/paths';
import type { IndexRecord } from '../lib/types';
import { readManifest } from '../lib/workspace';
import type { Access } from './llm';
import { listAgents } from './agents-service';
import { agentToken, authEnabled, loadUsers } from './auth';

/**
 * Запуск агента по задаче (R-0100, docs/09-execution.md, «Запуск агента роли»).
 * Токен агента не покидает сервер: консоль сама ходит в своё API от имени агента
 * внутренним запросом, и тот проходит middleware/auth.ts как любой другой — права
 * роли, ограничения ADR-0033, подпись агента в журнале.
 */

export interface ActionResult { action: AgentAction; ok: boolean; message: string }

export interface AgentReport { login: string; title: string; actions: ActionResult[]; problems: string[] }

export interface PreparedAgent {
  ok: true;
  login: string;
  title: string;
  /** То, что уходит в `handover`: промпт агента поверх контекста задачи, его модель и доступ. */
  handover: { wrap: (prompt: string) => string; model?: string; access: Access; journal: string };
  /** После ответа модели: выполнить действия агента его токеном. */
  finish: (answer: string) => Promise<AgentReport>;
}

/** Агент задачи: вход включён, исполнитель — аккаунт агента с файлом и местом в команде. */
export async function chooseAgent(root: string, record: IndexRecord): Promise<AgentChoice | { ok: false; code: 'agent_needs_auth'; message: string }> {
  if (!authEnabled()) {
    return { ok: false, code: 'agent_needs_auth', message: 'Агенты работают на общем сервере со входом (DOCDD_AUTH=on): без входа аккаунтов агентов нет' };
  }
  const assignee = typeof record.extra['assignee'] === 'string' ? record.extra['assignee'] : '';
  let team: { login: string; roles: string[] }[] | undefined;
  try { team = readManifest(root).team; } catch { team = undefined; }
  return agentForAssignee(assignee, await loadUsers(), listAgents(root).agents, team);
}

/**
 * Внутренний запрос к своему API с токеном агента. Глобальный `$fetch` Nitro
 * с относительным адресом идёт в то же приложение без сети: ни порта, ни nginx
 * с паролем на пути нет, а middleware проверяет всё как обычно.
 */
async function callAsAgent(path: string, token: string, body: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await $fetch.raw(path, { method: 'POST', body, headers: { authorization: `Bearer ${token}` }, ignoreResponseError: true });
    if (response.status < 400) return { ok: true, message: 'выполнено' };
    const data = response._data as { error?: { message?: string; detail?: string } } | undefined;
    return { ok: false, message: data?.error?.message ?? `ответ ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Правила проекта для агента: CLAUDE.md, а нет его — AGENTS.md. */
function projectRules(root: string): string {
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const path = resolveInside(root, name);
    if (existsSync(path)) {
      try { return readFileSync(path, 'utf8'); } catch { return ''; }
    }
  }
  return '';
}

/**
 * Подготовить запуск: выбрать агента, выдать токен и перевести задачу в работу
 * от его имени — с этого шага в журнале видна подпись агента. Отказ сервера
 * на этом шаге (нет права у роли, ворота статуса) останавливает запуск до модели.
 */
export async function prepareAgent(root: string, projectId: string, record: IndexRecord): Promise<PreparedAgent | { ok: false; code: string; message: string }> {
  const choice = await chooseAgent(root, record);
  if (!choice.ok) return choice;
  const { account, agent, roles } = choice;
  const token = await agentToken(account.login);
  const base = `/api/projects/${encodeURIComponent(projectId)}/records`;

  if (record.status === 'ready') {
    const started = await callAsAgent(`${base}/${encodeURIComponent(record.id)}/status`, token, { status: 'in_progress' });
    if (!started.ok) return { ok: false, code: 'agent_start_refused', message: `Агент не смог взять задачу в работу: ${started.message}` };
  }

  const author = agentSignature(signature(account.name, roles));
  const rules = projectRules(root);
  return {
    ok: true,
    login: account.login,
    title: agent.title,
    handover: {
      wrap: (prompt) => agentRunPrompt(agent, account, prompt, record.id, rules),
      ...(agent.model ? { model: agent.model } : {}),
      access: accessFor(agent.access),
      journal: `отдана агенту ${agent.title} (${account.login})`
    },
    async finish(answer) {
      const { actions, problems } = parseAgentActions(answer);
      const results: ActionResult[] = [];
      // По порядку: замечание обычно идёт перед сменой статуса, и порядок агент выбрал сам.
      for (const action of actions) {
        const path = `${base}/${encodeURIComponent(action.id)}/${action.do === 'status' ? 'status' : 'discussion'}`;
        const body = action.do === 'status' ? { status: action.status } : { action: 'thread', author, text: action.text };
        results.push({ action, ...(await callAsAgent(path, token, body)) });
      }
      return { login: account.login, title: agent.title, actions: results, problems };
    }
  };
}
