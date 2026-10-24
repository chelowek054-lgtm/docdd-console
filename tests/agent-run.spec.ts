// «Запустить в работу» (R-0100, ADR-0033): выбор агента по исполнителю и запрос с токеном.
import { describe, expect, it } from 'vitest';

import { accessFor, agentForAssignee, agentRunPrompt } from '../server/lib/agent-run';
import type { AgentDef } from '../server/lib/agents';

const qa: AgentDef = { id: 'qa', type: 'qa', title: 'Тестировщик', access: 'statuses', prompt: 'Ты тестировщик.' };
const accounts = [
  { login: 'qa-bot', name: 'QA-агент', agent: { type: 'qa' } },
  { login: 'ann', name: 'Анна' },
  { login: 'dev-bot', name: 'Dev', agent: { type: 'developer' } }
];

describe('агент по исполнителю', () => {
  it('аккаунт агента находит файл своего типа', () => {
    expect(agentForAssignee('qa-bot', accounts, [qa])).toMatchObject({ ok: true, agent: { id: 'qa' } });
  });
  it('человек и пустой исполнитель — отказ словами', () => {
    expect(agentForAssignee('ann', accounts, [qa])).toMatchObject({ ok: false, code: 'assignee_not_agent' });
    expect(agentForAssignee('', accounts, [qa])).toMatchObject({ ok: false, code: 'assignee_not_agent' });
  });
  it('нет файла агента нужного типа — отказ с подсказкой', () => {
    expect(agentForAssignee('dev-bot', accounts, [qa])).toMatchObject({ ok: false, code: 'agent_not_defined' });
  });
});

describe('запрос агенту', () => {
  it('промпт агента, задача, токен и адрес API', () => {
    const prompt = agentRunPrompt(qa, accounts[0]!, '## Задача T-1', { baseUrl: 'http://h:3000/', projectId: 'p', taskId: 'T-1', token: 'TOK' });
    expect(prompt).toContain('Ты тестировщик.');
    expect(prompt).toContain('## Задача T-1');
    expect(prompt).toContain('Bearer TOK');
    expect(prompt).toContain('http://h:3000/api/projects/p/records/T-1/status');
    expect(prompt.indexOf('Ты тестировщик.')).toBeLessThan(prompt.indexOf('## Задача T-1'));
  });
  it('код пишет только агент с доступом code', () => {
    expect(accessFor('code')).toBe('full');
    expect(accessFor('statuses')).toBe('read');
    expect(accessFor('propose')).toBe('read');
  });
});
