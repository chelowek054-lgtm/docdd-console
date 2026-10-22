// Шаблон проекта software-core разворачивает контуры, роли и карты (R-0090).
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { customDefinitions } from '../server/lib/custom-maps';
import { SOFTWARE_CORE, contourCapabilities, customMapsYaml, projectTemplate } from '../server/lib/project-templates';
import { manifestYaml, recordTemplate } from '../server/lib/scaffold';
import { parseMapRecord } from '../server/lib/maps';
import { splitRecord } from '../server/lib/write';

describe('шаблон software-core', () => {
  it('шесть контуров с уникальными id', () => {
    expect(SOFTWARE_CORE.contours).toHaveLength(6);
    expect(new Set(SOFTWARE_CORE.contours.map((item) => item.id)).size).toBe(6);
  });
  it('projectTemplate: по идентификатору; незнакомый — null', () => {
    expect(projectTemplate('software-core')?.id).toBe('software-core');
    expect(projectTemplate('nope')).toBeNull();
  });
  it('манифест с шаблоном читается и даёт годные определения карт, роли на месте', () => {
    const text = manifestYaml({ id: 'demo', name: 'Демо' }) + customMapsYaml(SOFTWARE_CORE.customMaps).join('\n') + '\n';
    const manifest = yaml.load(text) as { roles: { id: string }[]; maps: { custom: unknown[] } };
    expect(manifest.roles.map((role) => role.id)).toEqual(expect.arrayContaining(['architect', 'developer', 'designer', 'qa', 'devops', 'pm']));
    const result = customDefinitions({ maps: manifest.maps });
    expect(result.problems).toEqual([]);
    expect(result.definitions.map((item) => item.id)).toEqual(SOFTWARE_CORE.customMaps.map((item) => item.id));
  });
  it('черновик контуров — карта с шестью возможностями верхнего уровня', () => {
    const text = recordTemplate({ id: 'M-0002', type: 'map', title: 'Контуры проекта', today: '2026-10-22', capabilities: contourCapabilities(SOFTWARE_CORE) });
    const parsed = parseMapRecord(splitRecord(text)!.body);
    expect(parsed.problems).toEqual([]);
    const capabilities = parsed.change.functional?.added?.capabilities ?? [];
    expect(capabilities.map((item) => item.id)).toEqual(SOFTWARE_CORE.contours.map((item) => item.id));
    expect(capabilities.every((item) => !item.parent)).toBe(true);
  });
});
