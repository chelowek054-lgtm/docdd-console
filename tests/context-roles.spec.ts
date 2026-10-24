// V-0011 unit (npm run test -- tests/context-roles.spec.ts); ролевые нужды пакета, T-0030, T-0031.
import { describe, expect, it } from 'vitest';

import { buildContextPack } from '../server/lib/context-pack';
import { capabilityIdsOf, NEEDS, roleNeeds } from '../server/utils/context-service';
import { rec } from './helpers';

const chain = () => [
  rec('R-1', 'requirement', 'approved', { body: '# R-1', links: {} }),
  rec('T-1', 'task', 'ready', { body: '# T-1', links: { implements: ['R-1'] } }),
  rec('T-2', 'task', 'ready', { body: '# T-2', links: { depends_on: ['T-1'] } }),
  rec('T-3', 'task', 'ready', { body: '# T-3', links: { depends_on: ['T-2'] } })
];

describe('R-0012: нужды ролей', () => {
  it('менеджер и аналитик ходят на глубину 2, менеджеру нужны issues, домену глубина 1', () => {
    expect(roleNeeds('manager').depth).toBe(2);
    expect(roleNeeds('manager').kinds).toContain('issues');
    expect(roleNeeds('analyst').depth).toBe(2);
    expect(roleNeeds('analyst').kinds).toContain('glossary');
    expect(roleNeeds('domain').depth).toBe(1);
    expect(NEEDS['ask']!.depth).toBe(1);
  });

  it('глубина роли достаёт то, что вид ask не достаёт', () => {
    const keys = (needs: ReturnType<typeof roleNeeds>) => buildContextPack({ records: chain(), centerId: 'T-1', needs }).chunks.map((c) => c.key);
    expect(keys(roleNeeds('analyst'))).toContain('record:T-3');
    expect(keys(NEEDS['ask']!)).not.toContain('record:T-3');
  });

  it('issues попадают в пакет менеджера и не попадают в пакет аналитика', () => {
    const issues = [{ code: 'x', message: 'нет проверки', recordId: 'T-1' }];
    const manager = buildContextPack({ records: chain(), centerId: 'T-1', needs: roleNeeds('manager'), issues });
    const analyst = buildContextPack({ records: chain(), centerId: 'T-1', needs: roleNeeds('analyst'), issues });
    expect(manager.chunks.map((c) => c.key)).toContain('issues');
    expect(analyst.chunks.map((c) => c.key)).not.toContain('issues');
  });
});

describe('R-0011: цепочка возможностей записи', () => {
  it('возможности берутся через affects карты и подтягивают родителей', () => {
    const records = [
      rec('M-1', 'map', 'approved', { links: { affects: ['T-1'] } }),
      rec('T-1', 'task', 'ready', { links: {} })
    ];
    const capabilities = [{ id: 'cap-root', title: 'Корень' }, { id: 'cap-leaf', title: 'Лист', parent: 'cap-root', declaredBy: 'M-1' }];
    const ids = capabilityIdsOf(records, 'T-1', capabilities);
    expect(ids).toEqual(['cap-leaf']);
    const pack = buildContextPack({ records, centerId: 'T-1', needs: { kinds: ['record', 'capability'], budget: 9999 }, capabilities, capabilityIds: ids });
    expect(pack.chunks.map((c) => c.key)).toEqual(expect.arrayContaining(['capability:cap-leaf', 'capability:cap-root']));
    expect(capabilityIdsOf(records, 'cap-root', capabilities)).toEqual(['cap-root']);
  });
});
