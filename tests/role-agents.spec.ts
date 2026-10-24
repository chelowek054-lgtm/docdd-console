// Агенты ролей: файл агента, набор по умолчанию, ограничения аккаунта агента (R-0091, ADR-0033).
import { describe, expect, it } from 'vitest';

import { AGENT_TYPES, agentFromType, agentSignature, agentText, agentVerdict, parseAgent, type AgentRecord } from '../server/lib/agents';
import { readAgentToken, readSession, signAgentToken, signSession } from '../server/lib/auth';
import { actionFor, can } from '../server/lib/permissions';

describe('файл агента', () => {
  it('запись и разбор — туда и обратно без потерь', () => {
    const agent = { id: 'qa-bot', type: 'qa', title: 'QA-агент', model: 'claude-sonnet-5-5', access: 'statuses' as const, prompt: 'Ты тестировщик.\n\nПрогоняй проверки.' };
    const parsed = parseAgent(agentText(agent));
    expect(parsed).toEqual({ ok: true, agent });
  });
  it('неверные id, access и отсутствие front matter называются словами', () => {
    expect(parseAgent('просто текст')).toMatchObject({ ok: false });
    expect(parseAgent('---\nid: Плохой\ntype: qa\naccess: read\n---\nx')).toMatchObject({ ok: false, problem: expect.stringContaining('id') });
    expect(parseAgent('---\nid: ok-bot\ntype: qa\naccess: всё\n---\nx')).toMatchObject({ ok: false, problem: expect.stringContaining('access') });
  });
});

describe('набор по умолчанию', () => {
  it('восемь типов, каждый — годный агент с промптом и правилом про документы', () => {
    expect(AGENT_TYPES.map((t) => t.type)).toEqual(['architect', 'analyst', 'developer', 'qa', 'devops', 'designer', 'marketer', 'critic']);
    for (const type of AGENT_TYPES) {
      const parsed = parseAgent(agentText(agentFromType(type)));
      expect(parsed.ok).toBe(true);
      expect(type.prompt).toContain('Документы не подтверждай');
    }
  });
});

describe('ограничения аккаунта агента', () => {
  const records: AgentRecord[] = [
    { id: 'R-1', type: 'requirement', status: 'review', links: { verified_by: ['V-1'] } },
    { id: 'V-1', type: 'verification', status: 'approved', links: { verifies: ['R-1'] } },
    { id: 'T-1', type: 'task', status: 'in_review', links: { implements: ['R-1'] }, extra: { assignee: 'qa-bot' } },
    { id: 'T-2', type: 'task', status: 'in_review', links: {}, extra: { assignee: 'ann' } }
  ];
  const v = (path: string, body: Record<string, unknown> | null = null) => agentVerdict('qa-bot', 'POST', path, body, records);

  it('нет merge, team, admin при любой роли', () => {
    const agent = { login: 'qa-bot', admin: false, agent: { type: 'qa' } };
    const team = [{ login: 'qa-bot', roles: ['architect'] }];
    expect(can(agent, team, 'merge').allowed).toBe(false);
    expect(can(agent, team, 'team').allowed).toBe(false);
    expect(can(agent, team, 'approve').allowed).toBe(true);
    expect(can({ login: 'qa-bot', admin: false }, team, 'merge').allowed).toBe(true);
  });
  it('текст документов не правит', () => {
    expect(v('/api/projects/p/records/R-1/body')).toMatchObject({ allowed: false, code: 'agent_text_edit' });
  });
  it('документы не подтверждает никогда — ни по одному, ни пачкой', () => {
    expect(v('/api/projects/p/records/R-1/status', { status: 'approved' })).toMatchObject({ allowed: false, code: 'agent_document_approve' });
    expect(v('/api/projects/p/records/bulk/status', { ids: ['T-2', 'R-1'], direction: 'forward' })).toMatchObject({ allowed: false, code: 'agent_document_approve' });
    expect(v('/api/projects/p/records/bulk/status', { ids: ['T-2'], direction: 'forward' }).allowed).toBe(true);
  });
  it('свою работу не принимает: ни закрыть свою задачу, ни «Проверено» по ней', () => {
    expect(v('/api/projects/p/records/T-1/status', { status: 'done' })).toMatchObject({ allowed: false, code: 'agent_own_acceptance' });
    expect(v('/api/projects/p/records/V-1/verified', { checked: true })).toMatchObject({ allowed: false, code: 'agent_own_acceptance' });
  });
  it('чужие задачи двигает: закрыть чужую, перевести свою на проверку', () => {
    expect(v('/api/projects/p/records/T-2/status', { status: 'done' }).allowed).toBe(true);
    expect(v('/api/projects/p/records/T-1/status', { status: 'in_review' }).allowed).toBe(true);
  });
  it('чтение не ограничено; подпись в журнале помечает агента', () => {
    expect(agentVerdict('qa-bot', 'GET', '/api/projects/p/records/R-1/body', null, records).allowed).toBe(true);
    expect(agentSignature('QA-агент (qa)')).toBe('QA-агент (qa) · агент');
  });
  it('маршруты агентов требуют права team', () => {
    expect(actionFor('POST', '/api/projects/p/agents')).toBe('team');
    expect(actionFor('DELETE', '/api/projects/p/agents/qa')).toBe('team');
  });
});

describe('токен агента', () => {
  const secret = 'тайна';
  it('токен агента читается как агентский и не годится как сессия человека', () => {
    const token = signAgentToken('qa-bot', 2_000, secret);
    expect(readAgentToken(token, secret, 1_000)).toBe('qa-bot');
    expect(readSession(token, secret, 1_000)).toBe('agent:qa-bot');
  });
  it('сессия человека не годится как токен агента; просроченный — null', () => {
    expect(readAgentToken(signSession('ann', 2_000, secret), secret, 1_000)).toBeNull();
    expect(readAgentToken(signAgentToken('qa-bot', 500, secret), secret, 1_000)).toBeNull();
  });
});
