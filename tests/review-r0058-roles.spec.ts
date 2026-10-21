// V-0058
import { describe, expect, it } from 'vitest';

import { can } from '../server/lib/permissions';
import { reviewerOf } from '../server/lib/reviewer';
import { manifestYaml } from '../server/lib/scaffold';
import type { IndexRecord } from '../server/lib/types';

/** R-0058: роли designer, qa, devops, support есть в шаблоне проекта и в матрице прав. */
const rec = (id: string, type: string, extra: Record<string, unknown> = {}, links: IndexRecord['links'] = {}, owner: string | null = null): IndexRecord => ({
  id, type, title: id, status: 'in_review', owner, created: null, updated: null, phase: null, tags: [],
  path: `${id}.md`, section: null, links, backlinks: {}, extra
});
const ROLES = ['architect', 'developer', 'designer', 'qa', 'devops', 'support'].map((id) => ({ id }));

describe('роли команды (R-0058)', () => {
  it('шаблон project.yaml содержит четыре роли', () => {
    const yaml = manifestYaml({ id: 'p', name: 'P', today: '2026-10-21' } as never);
    for (const role of ['designer', 'qa', 'devops', 'support']) expect(yaml).toContain(`id: ${role}`);
  });

  it('матрица прав: новые роли читают, дизайнер и тестировщик подтверждают, сопровождение не подтверждает', () => {
    const team = ['designer', 'qa', 'devops', 'support'].map((role) => ({ login: role, roles: [role] }));
    for (const member of team) expect(can({ login: member.login, admin: false }, team, 'read').allowed).toBe(true);
    expect(can({ login: 'designer', admin: false }, team, 'approve').allowed).toBe(true);
    expect(can({ login: 'qa', admin: false }, team, 'approve').allowed).toBe(true);
    expect(can({ login: 'support', admin: false }, team, 'approve').allowed).toBe(false);
    expect(can({ login: 'devops', admin: false }, team, 'admin').allowed).toBe(false);
  });

  it('ревьюер: ручная проверка — qa, дизайн и экраны — designer; без ролей в проекте — как раньше', () => {
    const req = rec('R-1', 'requirement');
    const check = (kind: string) => rec('V-1', 'verification', { kind }, { verifies: ['R-1'] });
    const task = rec('T-1', 'task', { change: 'feature' }, { implements: ['R-1'] }, 'developer');
    expect(reviewerOf(task, [req, check('manual')], ROLES)?.role).toBe('qa');
    expect(reviewerOf(task, [req, check('design')], ROLES)?.role).toBe('designer');
    expect(reviewerOf(task, [req, check('screens')], ROLES)?.role).toBe('designer');
    const old = ROLES.filter((r) => !['qa', 'designer'].includes(r.id));
    expect(reviewerOf(task, [req, check('manual')], old)?.role).not.toBe('qa');
  });
});
