import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AGENTS_DIR, agentText, parseAgent, type AgentDef } from '../lib/agents';
import { normalizeRoot, resolveInside } from '../lib/paths';

/**
 * Агенты проекта — файлы `docs/agents/<id>.md` (ADR-0033). Всё — внутри корня
 * проекта; незнакомое в папке не трогаем, нечитаемый файл называем, а не роняем список.
 */

export function listAgents(root: string): { agents: AgentDef[]; problems: { file: string; problem: string }[] } {
  const dir = resolveInside(normalizeRoot(root), AGENTS_DIR);
  const agents: AgentDef[] = [];
  const problems: { file: string; problem: string }[] = [];
  if (!existsSync(dir)) return { agents, problems };
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.md')).sort()) {
    const parsed = parseAgent(readFileSync(join(dir, file), 'utf8'));
    if (parsed.ok) agents.push(parsed.agent);
    else problems.push({ file: `${AGENTS_DIR}/${file}`, problem: parsed.problem });
  }
  return { agents, problems };
}

export function saveAgent(root: string, agent: AgentDef): string {
  const dir = resolveInside(normalizeRoot(root), AGENTS_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${agent.id}.md`);
  writeFileSync(path, agentText(agent), 'utf8');
  return `${AGENTS_DIR}/${agent.id}.md`;
}

export function deleteAgent(root: string, id: string): boolean {
  const path = resolveInside(normalizeRoot(root), `${AGENTS_DIR}/${id}.md`);
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}
