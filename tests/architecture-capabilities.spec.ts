import { describe, expect, it } from 'vitest';

import { reconcileCapabilities } from '../server/lib/architecture-capabilities';

/** Сверка модулей с функциональной картой (docs/07-maps.md, «Аудит моделью»). */

const modules = [
  { dir: 'app/billing', parent: null },
  { dir: 'app/billing/invoices', parent: 'app/billing' },
  { dir: 'app/reports', parent: null }
];
const mapModules = [
  { id: 'app/billing/__init__.py' },
  { id: 'app/billing/invoices/lines.py' },
  { id: 'app/reports/summary.py' }
];
const capabilities = [
  { id: 'pay', title: 'Оплата' },
  { id: 'pay.invoice', title: 'Счета', parent: 'pay' },
  { id: 'report', title: 'Отчёты' },
  { id: 'chat', title: 'Чат' }
];

describe('сверка модулей с возможностями', () => {
  it('ни одна группа не назвала возможность — сверять не про что', () => {
    const result = reconcileCapabilities({ modules, mapModules, groups: [{ id: 'g', paths: ['app/billing'] }], capabilities });
    expect(result).toEqual({ enabled: false, modulesWithoutCapability: [], capabilitiesWithoutModule: [] });
  });

  it('модуль верхнего уровня без группы с возможностью — замечание', () => {
    const result = reconcileCapabilities({
      modules, mapModules, capabilities,
      groups: [{ id: 'billing', paths: ['app/billing'], capability: 'pay' }]
    });
    expect(result.enabled).toBe(true);
    expect(result.modulesWithoutCapability).toEqual(['app/reports']);
  });

  it('возможность без группы — замечание; родитель и потомок закрыты группой одной ветки', () => {
    const result = reconcileCapabilities({
      modules, mapModules, capabilities,
      groups: [{ id: 'billing', paths: ['app/billing'], capability: 'pay.invoice' }]
    });
    expect(result.capabilitiesWithoutModule.map((item) => item.id)).toEqual(['report', 'chat']);
  });

  it('группа родителя закрывает подпункты', () => {
    const result = reconcileCapabilities({
      modules, mapModules, capabilities,
      groups: [{ id: 'billing', paths: ['app/billing'], capability: 'pay' }, { id: 'rep', paths: ['app/reports'], capability: 'report' }]
    });
    expect(result.capabilitiesWithoutModule.map((item) => item.id)).toEqual(['chat']);
    expect(result.modulesWithoutCapability).toEqual([]);
  });

  it('подгруппа наследует возможность родителя', () => {
    const result = reconcileCapabilities({
      modules, mapModules, capabilities,
      groups: [
        { id: 'billing', paths: ['app/billing'], capability: 'pay' },
        { id: 'rep-sub', parent: 'rep', paths: ['app/reports'] },
        { id: 'rep', capability: 'report' }
      ]
    });
    expect(result.modulesWithoutCapability).toEqual([]);
  });

  it('вложенные модули в счёт верхнего уровня не идут', () => {
    const result = reconcileCapabilities({
      modules, mapModules, capabilities,
      groups: [{ id: 'billing', paths: ['app/billing'], capability: 'pay' }]
    });
    expect(result.modulesWithoutCapability).not.toContain('app/billing/invoices');
  });
});
