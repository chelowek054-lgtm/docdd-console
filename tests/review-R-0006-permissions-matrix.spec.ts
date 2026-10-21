// V-0006 (unit): проверка по тексту требования R-0006. Права из роли в team; манифест только сужает.
import { describe, expect, it } from 'vitest';

import { ALL_ACTIONS, actionFor, can, type TeamMember } from '../server/lib/permissions';

const user = (login: string, admin = false) => ({ login, admin });
const team = (roles: string[], deny?: string[]): TeamMember[] => [{ login: 'ivan', roles, ...(deny ? { deny } : {}) }];

describe('R-0006: can()', () => {
  it('без входа ничего нельзя, и причина названа', () => {
    const v = can(null, team(['architect']), 'read');
    expect(v.allowed).toBe(false);
    expect(v.reason).toBeTruthy();
  });
  it('не из команды или без команды — отказ с причиной', () => {
    expect(can(user('petr'), team(['architect']), 'read').allowed).toBe(false);
    expect(can(user('ivan'), undefined, 'read').allowed).toBe(false);
    expect(can(user('ivan'), [], 'read').reason).toBeTruthy();
  });
  it('роли дают то, что в матрице ADR-0020', () => {
    const grant = (role: string) => ALL_ACTIONS.filter((a) => can(user('ivan'), team([role]), a).allowed);
    expect(grant('architect')).toEqual(ALL_ACTIONS.filter((a) => a !== 'admin'));
    expect(grant('developer')).toEqual(['read', 'edit_draft', 'work', 'model', 'merge']);
    expect(grant('pm')).toEqual(['read', 'edit_draft', 'reorder', 'team']);
    expect(grant('analyst')).toEqual(['read', 'edit_draft', 'approve', 'model']);
    expect(grant('domain')).toEqual(['read', 'edit_draft']);
  });
  it('неизвестная роль и пустой список ролей не дают ничего', () => {
    for (const roles of [['wizard'], []]) {
      expect(ALL_ACTIONS.filter((a) => can(user('ivan'), team(roles), a).allowed)).toEqual([]);
    }
  });
  it('deny только сужает; в deny нельзя выдать лишнее', () => {
    expect(can(user('ivan'), team(['architect'], ['approve']), 'approve').allowed).toBe(false);
    expect(can(user('ivan'), team(['architect'], ['approve']), 'work').allowed).toBe(true);
    expect(can(user('ivan'), team(['viewer'], []), 'edit_draft').allowed).toBe(false);
    expect(can(user('ivan'), team(['viewer'], ['bogus']), 'read').allowed).toBe(true);
  });
  it('admin — только у администратора сервера, и он не становится ролью проекта', () => {
    expect(can(user('root', true), undefined, 'admin').allowed).toBe(true);
    expect(can(user('root', true), undefined, 'approve').allowed).toBe(false);
    expect(can(user('ivan'), team(['architect']), 'admin').allowed).toBe(false);
  });
});

describe('R-0006: actionFor()', () => {
  it('чтение — read, неизвестный пишущий маршрут — не меньше edit_draft', () => {
    expect(actionFor('get', '/api/projects/p/anything')).toBe('read');
    expect(actionFor('HEAD', '/x')).toBe('read');
    expect(actionFor('POST', '/api/projects/p/new-unknown')).toBe('edit_draft');
    expect(actionFor('DELETE', '/api/projects/p/new-unknown')).toBe('edit_draft');
  });
  it('подтверждение, порядок, команда, работа, модель', () => {
    expect(actionFor('POST', '/api/projects/p/records/T-1/status')).toBe('approve');
    expect(actionFor('POST', '/api/projects/p/priority/apply')).toBe('reorder');
    expect(actionFor('PATCH', '/api/projects/p/shared')).toBe('team');
    expect(actionFor('POST', '/api/projects/p/records/T-1/work')).toBe('work');
    expect(actionFor('POST', '/api/llm/ask')).toBe('model');
    expect(actionFor('DELETE', '/api/projects/p')).toBe('admin');
  });
  it('роль viewer не проходит пишущие маршруты, кроме вопроса о ходе работы', () => {
    const paths = ['/api/projects/p/records', '/api/projects/p/records/T-1/status', '/api/projects/p/records/T-1/work',
      '/api/projects/p/prompt', '/api/llm/ask', '/api/projects/p/shared', '/api/projects/p/phases', '/api/projects/p/runs'];
    for (const path of paths) {
      for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) {
        expect(can(user('ivan'), team(['viewer']), actionFor(m, path)).allowed, `${m} ${path}`).toBe(false);
      }
    }
    expect(can(user('ivan'), team(['viewer']), actionFor('POST', '/api/projects/p/progress-question')).allowed).toBe(true);
  });
});
