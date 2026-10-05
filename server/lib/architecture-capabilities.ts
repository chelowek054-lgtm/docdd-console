import type { ArchModule } from './architecture';
import type { CapabilityLike } from './functional';
import { declaredGroupOf, type DeclaredGroup } from './groups';

/**
 * Сверка модулей с функциональной картой (docs/07-maps.md, «Аудит моделью»):
 * модуль верхнего уровня без возможности и возможность без модуля. Это
 * замечания, а не нарушения: связь идёт через объявленные группы кода с полем
 * `capability`, и пока ни одна группа его не назвала, сверять нечего — тогда
 * `enabled: false`, а не стена замечаний. Чистая функция.
 */

export interface CapabilityReconcile {
  /** Ни одна группа не назвала возможность — сверка не про что. */
  enabled: boolean;
  /** Каталоги модулей верхнего уровня, в которых ни один файл не лежит в группе с возможностью. */
  modulesWithoutCapability: string[];
  /** Возможности, которых не реализует ни одна группа — ни сама, ни через предков и потомков. */
  capabilitiesWithoutModule: { id: string; title: string }[];
}

const under = (path: string, dir: string): boolean => path === dir || path.startsWith(`${dir}/`);

export function reconcileCapabilities(input: {
  modules: readonly Pick<ArchModule, 'dir' | 'parent'>[];
  /** Модули кодовой карты: по ним видно, какие файлы к каким группам относятся. */
  mapModules: readonly { id: string; path?: string | undefined }[];
  groups: readonly DeclaredGroup[];
  capabilities: readonly CapabilityLike[];
}): CapabilityReconcile {
  const linked = new Set(input.groups.map((group) => group.capability).filter((id): id is string => !!id));
  if (linked.size === 0) return { enabled: false, modulesWithoutCapability: [], capabilitiesWithoutModule: [] };

  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  /** Возможность группы — собственная, а нет её — у ближайшей родительской. */
  const capabilityOfGroup = (id: string | null): string | undefined => {
    const seen = new Set<string>();
    for (let at = id; at && !seen.has(at); at = groupById.get(at)?.parent ?? null) {
      seen.add(at);
      const capability = groupById.get(at)?.capability;
      if (capability) return capability;
    }
    return undefined;
  };

  const topLevel = input.modules.filter((module) => module.parent === null).map((module) => module.dir);
  const modulesWithoutCapability = topLevel.filter((dir) => !input.mapModules.some((module) => {
    const path = module.path ?? module.id;
    return under(path, dir) && capabilityOfGroup(declaredGroupOf(module, input.groups)) !== undefined;
  }));

  const byId = new Map(input.capabilities.map((item) => [item.id, item]));
  const ancestors = (id: string): string[] => {
    const chain: string[] = [];
    for (let at = byId.get(id)?.parent; at && !chain.includes(at); at = byId.get(at)?.parent) chain.push(at);
    return chain;
  };
  const covered = new Set<string>();
  for (const id of linked) {
    covered.add(id);
    // Группа, реализующая подпункт, закрывает и родителя — «потомки»; группа родителя закрывает подпункты — «предки».
    for (const parent of ancestors(id)) covered.add(parent);
  }
  const capabilitiesWithoutModule = input.capabilities
    .filter((item) => !covered.has(item.id) && !ancestors(item.id).some((parent) => linked.has(parent)))
    .map((item) => ({ id: item.id, title: item.title ?? item.id }));

  return { enabled: true, modulesWithoutCapability, capabilitiesWithoutModule };
}
