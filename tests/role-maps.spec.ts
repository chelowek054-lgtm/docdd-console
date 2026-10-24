// Заготовки своих карт под роли (R-0087, docs/adr/0028-custom-maps.md).
import { describe, expect, it } from 'vitest';

import { customDefinitions } from '../server/lib/custom-maps';
import { ROLE_MAP_TEMPLATES, roleMapTemplate } from '../server/lib/role-maps';

describe('заготовки карт по ролям', () => {
  it('на каждую из четырёх ролей — своя заготовка', () => {
    expect(ROLE_MAP_TEMPLATES.map((item) => item.role).sort()).toEqual(['architect', 'designer', 'developer', 'devops']);
  });
  it('каждая заготовка — годное определение своей карты, без бед', () => {
    const result = customDefinitions({ maps: { custom: ROLE_MAP_TEMPLATES.map((item) => item.definition) } });
    expect(result.problems).toEqual([]);
    expect(result.definitions).toHaveLength(ROLE_MAP_TEMPLATES.length);
  });
  it('id заготовок не пересекаются', () => {
    const ids = ROLE_MAP_TEMPLATES.map((item) => item.definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('roleMapTemplate: по роли; неизвестная — null', () => {
    expect(roleMapTemplate('devops')?.definition.id).toBe('infrastructure');
    expect(roleMapTemplate('qa')).toBeNull();
  });
});
