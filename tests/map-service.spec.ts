import { describe, expect, it } from 'vitest';

import { pendingMapIds } from '../server/utils/map-service';
import { rec } from './helpers';

/**
 * Какие подтверждённые карты ещё не «устоялись» — то же понятие, что
 * `settled`/`intent` уже несут `checkMaps` (server/lib/rules.ts) и экран
 * одной записи (server/api/projects/[id]/records/[recordId].get.ts), здесь
 * применённое к сложенной картине проекта (server/utils/map-service.ts).
 */

describe('pendingMapIds', () => {
  const approved = (id: string, extra?: Record<string, unknown>) => rec(id, 'map', 'approved', { extra });

  it('карту без единой связанной задачи считает устоявшейся', () => {
    const map = approved('M-0001');
    expect(pendingMapIds([map], [map])).toEqual(new Set());
  });

  it('карту с незакрытой задачей `affects` считает не устоявшейся', () => {
    const map = approved('M-0001');
    const task = rec('T-0001', 'task', 'in_progress', { links: { affects: ['M-0001'] } });
    expect(pendingMapIds([map], [map, task])).toEqual(new Set(['M-0001']));
  });

  it('закрытая (done/dropped) задача снимает pending', () => {
    const map = approved('M-0001');
    const done = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    expect(pendingMapIds([map], [map, done])).toEqual(new Set());

    const dropped = rec('T-0002', 'task', 'dropped', { links: { affects: ['M-0001'] } });
    expect(pendingMapIds([map], [map, dropped])).toEqual(new Set());
  });

  it('несколько задач на одну карту — устоялась, только когда закрыты все', () => {
    const map = approved('M-0001');
    const done = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    const open = rec('T-0002', 'task', 'ready', { links: { affects: ['M-0001'] } });
    expect(pendingMapIds([map], [map, done, open])).toEqual(new Set(['M-0001']));
  });

  it('intent: true — не устоялась, даже без единой задачи', () => {
    const map = approved('M-0001', { intent: true });
    expect(pendingMapIds([map], [map])).toEqual(new Set(['M-0001']));
  });

  it('intent: true сильнее закрытой задачи', () => {
    const map = approved('M-0001', { intent: true });
    const done = rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } });
    expect(pendingMapIds([map], [map, done])).toEqual(new Set(['M-0001']));
  });
});
