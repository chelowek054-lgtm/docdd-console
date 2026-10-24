// «Запустить в работу» (R-0100, ADR-0033): выбор агента по исполнителю, запрос и действия из ответа.
import { describe, expect, it } from 'vitest';

import { ACTIONS_FENCE, RULES_LIMIT, accessFor, agentForAssignee, agentRunPrompt, parseAgentActions } from '../server/lib/agent-run';
import type { AgentDef } from '../server/lib/agents';

const qa: AgentDef = { id: 'qa', type: 'qa', title: 'Тестировщик', access: 'statuses', prompt: 'Ты тестировщик.' };
const accounts = [
  { login: 'qa-bot', name: 'QA-агент', agent: { type: 'qa' } },
  { login: 'ann', name: 'Анна' },
  { login: 'dev-bot', name: 'Dev', agent: { type: 'developer' } }
];
const team = [{ login: 'qa-bot', roles: ['qa'] }, { login: 'ann', roles: ['architect'] }];
const fence = (body: string) => '```' + ACTIONS_FENCE + '\n' + body + '\n```';

describe('агент по исполнителю', () => {
  it('аккаунт агента в команде находит файл своего типа и роли', () => {
    expect(agentForAssignee('qa-bot', accounts, [qa], team)).toMatchObject({ ok: true, agent: { id: 'qa' }, roles: ['qa'] });
  });
  it('человек и пустой исполнитель — отказ словами', () => {
    expect(agentForAssignee('ann', accounts, [qa], team)).toMatchObject({ ok: false, code: 'assignee_not_agent' });
    expect(agentForAssignee('', accounts, [qa], team)).toMatchObject({ ok: false, code: 'assignee_not_agent' });
  });
  it('нет файла агента нужного типа — отказ с подсказкой', () => {
    expect(agentForAssignee('dev-bot', accounts, [qa], team)).toMatchObject({ ok: false, code: 'agent_not_defined' });
  });
  it('агент не в команде — отказ до модели: сервер отклонил бы каждый его шаг', () => {
    expect(agentForAssignee('qa-bot', accounts, [qa], [])).toMatchObject({ ok: false, code: 'agent_not_in_team' });
    expect(agentForAssignee('qa-bot', accounts, [qa], undefined)).toMatchObject({ ok: false, code: 'agent_not_in_team' });
  });
});

describe('запрос агенту', () => {
  const prompt = agentRunPrompt(qa, accounts[0]!, '## Задача T-1', 'T-1', '# Правила\nДокумент ведёт код.');
  it('сначала кто он и его промпт, затем правила проекта, затем задача и блок действий', () => {
    const order = ['Ты тестировщик.', '## Правила проекта', 'Документ ведёт код.', '## Задача T-1', ACTIONS_FENCE];
    const at = order.map((part) => prompt.indexOf(part));
    expect(at.every((value) => value >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('ни токена, ни адреса API в запросе нет: действия исполняет консоль', () => {
    expect(prompt).not.toMatch(/Bearer|\/api\//);
  });
  it('длинные правила обрезаются, без правил раздела нет', () => {
    expect(agentRunPrompt(qa, accounts[0]!, 'x', 'T-1', 'а'.repeat(RULES_LIMIT + 50))).toContain('…(обрезано)');
    expect(agentRunPrompt(qa, accounts[0]!, 'x', 'T-1')).not.toContain('## Правила проекта');
  });
  it('код пишет только агент с доступом code', () => {
    expect(accessFor('code')).toBe('full');
    expect(accessFor('statuses')).toBe('read');
    expect(accessFor('propose')).toBe('read');
  });
});

describe('действия из ответа', () => {
  it('статус и замечание — по порядку из последнего блока', () => {
    const answer = `Сделал.\n${fence('[{"do":"status","id":"T-1","status":"in_progress"}]')}\nИтог:\n${fence('[{"do":"discussion","id":"T-1","text":"готово"},{"do":"status","id":"T-1","status":"in_review"}]')}`;
    expect(parseAgentActions(answer)).toEqual({
      actions: [{ do: 'discussion', id: 'T-1', text: 'готово' }, { do: 'status', id: 'T-1', status: 'in_review' }],
      problems: []
    });
  });
  it('блока нет — действий нет и это не ошибка', () => {
    expect(parseAgentActions('просто ответ')).toEqual({ actions: [], problems: [] });
  });
  it('кривой JSON и незнакомые действия названы, годное выполняется', () => {
    expect(parseAgentActions(fence('{не json'))).toMatchObject({ actions: [], problems: [expect.stringContaining('JSON')] });
    const mixed = parseAgentActions(fence('[{"do":"merge","id":"T-1"},{"do":"status","status":"done"},{"do":"status","id":"T-1","status":"in_review"}]'));
    expect(mixed.actions).toEqual([{ do: 'status', id: 'T-1', status: 'in_review' }]);
    expect(mixed.problems).toHaveLength(2);
  });
});
