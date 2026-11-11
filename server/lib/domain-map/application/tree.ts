import { CLEAN_LAYERS, underRoot, type DomainAggregate, type DomainContext, type DomainState } from '../domain/model';

/**
 * Дерево «контекст → слой → модуль → файл» для экрана «Стратегия» (R-0119).
 * Модули и файлы не хранятся в доменной карте: их дают кодовая карта и список
 * файлов кода по корню контекста.
 */

export interface TreeModule {
  /** id модуля кодовой карты; `null` — файлы слоя, не отнесённые ни к одному модулю. */
  id: string | null;
  path: string;
  files: string[];
}

export interface TreeLayer {
  /** Имя каталога первого уровня под корнем контекста. */
  layer: string;
  /** Слой чистой архитектуры или нет: остальные каталоги показываются, но помечаются. */
  clean: boolean;
  modules: TreeModule[];
}

export interface ContextTree {
  context: DomainContext;
  aggregates: DomainAggregate[];
  layers: TreeLayer[];
  /** Файлов под корнем всего: дерево могли обрезать. */
  files: number;
}

const FILE_LIMIT = 200;

export function contextTrees(
  domain: DomainState,
  modules: readonly { id: string; path?: string | undefined }[],
  files: Iterable<string>
): ContextTree[] {
  const all = [...files].map((file) => file.replace(/\\/g, '/'));
  const modulePaths = modules
    .map((module) => ({ id: module.id, path: (module.path ?? module.id).replace(/\\/g, '/').replace(/\/+$/, '') }))
    .filter((module) => module.path.includes('/'))
    // Самый глубокий модуль забирает файл первым.
    .sort((a, b) => b.path.length - a.path.length);

  return domain.contexts.map((context) => {
    const aggregates = domain.aggregates.filter((item) => item.context === context.id);
    const root = context.root?.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!root) return { context, aggregates, layers: [], files: 0 };

    const inside = all.filter((file) => underRoot(file, root)).sort();
    const layers = new Map<string, Map<string, TreeModule>>();
    for (const file of inside.slice(0, FILE_LIMIT)) {
      const rest = file.slice(root.length + 1);
      const layer = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : '.';
      const owner = modulePaths.find((module) => underRoot(file, module.path));
      const key = owner?.id ?? '';
      const bucket = layers.get(layer) ?? new Map<string, TreeModule>();
      layers.set(layer, bucket);
      const module = bucket.get(key) ?? { id: owner?.id ?? null, path: owner?.path ?? (layer === '.' ? root : `${root}/${layer}`), files: [] };
      bucket.set(key, module);
      module.files.push(file);
    }

    const order = (name: string) => {
      const at = (CLEAN_LAYERS as readonly string[]).indexOf(name);
      return at < 0 ? CLEAN_LAYERS.length : at;
    };
    return {
      context,
      aggregates,
      files: inside.length,
      layers: [...layers.entries()]
        .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
        .map(([layer, bucket]) => ({ layer, clean: (CLEAN_LAYERS as readonly string[]).includes(layer), modules: [...bucket.values()] }))
    };
  });
}
