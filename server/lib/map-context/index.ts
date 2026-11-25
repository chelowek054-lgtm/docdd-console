import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import codemap from '../../../docs/schemas/codemap.schema.json';
import custom from '../../../docs/schemas/custommap.schema.json';
import dataflow from '../../../docs/schemas/dataflow.schema.json';
import domain from '../../../docs/schemas/domain.schema.json';
import evidence from '../../../docs/schemas/evidence.schema.json';
import functional from '../../../docs/schemas/functional.schema.json';
import sysdesign from '../../../docs/schemas/sysdesign.schema.json';
import userflow from '../../../docs/schemas/userflow.schema.json';
import skipped from '../../../docs/schemas/skipped.schema.json';
import { customDefinitions } from '../custom-maps';
import { groupTree } from '../groups';
import { customStandard, overridesFrom, standardFor } from '../map-core';
import type { MapChange, MapStructure, ProjectMap } from '../maps';
import type { ProjectManifest } from '../types';
import type { InventoryState } from '../inventory';

const schemas = { functional, domain, sysdesign, codemap, dataflow, userflow, custom };
const secret = randomBytes(32);
const aliases: Readonly<Record<string, string>> = { strategy: 'functional', strategic: 'functional', codebase: 'codemap', code: 'codemap' };
const common = 'Сверься с текущей картой, источниками, схемой и легендой проекта. Используй стабильные ID. Принадлежность к группе задаётся родителем. Для новых узлов указывай назначение; не добавляй узлы без группы и связей, самоссылки, дубли, циклы родителей и ссылки на отсутствующие узлы. Опиши недостающие сведения отдельно. Отправь минимальный черновик на проверку линтером и приёмку человеком.';
const instructions = {
  functional: ['Куда движется проект?', 'Сверяй требования, фазы, задачи и проверки. Фиксируй возможности, цели и зависимости. Состояние подтверждай проверками, приоритет, горизонт и владельца бери из плана. Связь зависимости направлена от зависимого к необходимому.'],
  domain: ['Какие понятия и правила определяют предметную область?', 'Начни с контекстов и границ ответственности. Используй глоссарий и требования. Фиксируй участников, агрегаты, события, процессы и инварианты, называя смысл каждой связи. Код и сетевые вызовы относятся к System Design или кодовой карте.'],
  sysdesign: ['Как устроена или будет устроена система?', 'Сверь архитектурные решения с доменной и кодовой картами. Опиши системы, интерфейсы, контейнеры, компоненты и ответственность каждой границы. Укажи смысл, направление и известный формат взаимодействия. Отметь планы отдельно от реализованного.'],
  codemap: ['Что реализовано в коде?', 'Границы обхода находятся в sources.code, очередь — в описи. Для каждого файла партии прочитай исходник и окружение; запиши точный путь, стабильный ID, назначение, группу и тип по схеме. Для точки входа назови, что запускается, для теста — что проверяется, для конфигурации — что настраивается. Импорты направляй от импортирующего к импортируемому. К каждому импорту приложи фактические path, line и fragment. Сверь удалённые файлы и зависимости с описью и текущей картой. Будущий код описывается в System Design.'],
  dataflow: ['Откуда и куда идут данные?', 'Сверь источники и хранилища с кодом и API. Укажи направление чтения или записи и добавь свидетельство. Импорт модуля не доказывает передачу данных.'],
  userflow: ['Как человек проходит сценарий?', 'Сверь маршруты, экраны и действия с интерфейсом. Различай переход между экранами и вызов API. Укажи свидетельство действия, обработчика или маршрута.'],
  custom: ['Как связаны объекты выбранной карты?', 'Следуй назначению, полям, типам связей и условным обозначениям из определения карты в манифесте.']
} satisfies Record<MapStructure, readonly [string, string]>;

export function normalizeMapContextId(value: string): string | undefined {
  const key = Object.hasOwn(aliases, value) ? aliases[value]! : value;
  if (key !== 'custom' && Object.hasOwn(schemas, key)) return key;
  return /^custom:[a-zA-Z0-9-]+$/.test(key) ? key : undefined;
}

export function targetsOfMapChange(change: MapChange, present: readonly MapStructure[]): string[] {
  const ids = new Set<string>(present.filter((kind) => kind !== 'custom'));
  if (change.skipped?.length) ids.add('codemap');
  for (const part of [change.custom?.added, change.custom?.removed]) {
    for (const item of [...(part?.nodes ?? []), ...(part?.relations ?? [])]) {
      if (item.map) ids.add('custom:' + item.map);
    }
  }
  return [...ids];
}

export interface MapContextOptions { offset?: number; limit?: number; group?: string }
type State = Record<string, unknown>;

function statePage(state: State, options: MapContextOptions, nodeIds?: ReadonlySet<string>) {
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 50)));
  const totals: Record<string, number> = {};
  const current = Object.fromEntries(Object.entries(state).map(([key, raw]) => {
    if (!Array.isArray(raw)) return [key, raw];
    const items = nodeIds ? raw.filter((item) => item && typeof item === 'object' &&
      [item.id, item.from, item.to, item.context].some((id) => nodeIds.has(id))) : raw;
    totals[key] = items.length;
    return [key, items.slice(offset, offset + limit)];
  }));
  return { current, page: { offset, limit, totals, group: options.group } };
}

function groupMembers(state: State, group: string) {
  const ids = new Set([group]);
  let before = 0;
  while (ids.size !== before) {
    before = ids.size;
    for (const list of Object.values(state)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (item && typeof item.id === 'string' && (ids.has(item.parent) || ids.has(item.context))) ids.add(item.id);
      }
    }
  }
  return ids;
}

export function mapContextFor(root: string, projectId: string, map: string, manifest: ProjectManifest,
  project: ProjectMap, inventory: InventoryState | undefined, options: MapContextOptions = {}) {
  const customId = map.startsWith('custom:') ? map.slice(7) : undefined;
  const kind = (customId ? 'custom' : map) as MapStructure;
  const definition = customId && customDefinitions(manifest).definitions.find((item) => item.id === customId);
  if (customId && !definition) return;
  const current: State = customId ? {
    nodes: project.custom.nodes.filter((node) => node.map === customId),
    relations: project.custom.relations.filter((edge) => edge.map === customId)
  } : { ...project[kind] };
  const [question, rule] = instructions[kind];
  const overrides = overridesFrom(manifest.maps?.['standards']);
  const standard = definition ? customStandard(definition) : standardFor(kind, overrides)?.standard ?? (kind === 'dataflow' ? {
    visual: standardFor('codebase', overrides)?.standard,
    nodeKinds: dataflow.$defs.source.properties.kind.enum,
    edgeKinds: [
      { id: 'read', direction: 'источник → потребитель' },
      { id: 'write', direction: 'писатель → источник' },
      { id: 'both', direction: 'чтение и запись' }
    ]
  } : kind === 'userflow' ? {
    visual: standardFor('codebase', overrides)?.standard,
    nodeKinds: ['screen', 'api'],
    edgeKinds: [
      { id: 'transition', direction: 'исходный экран → следующий экран' },
      { id: 'call', direction: 'экран → маршрут API' }
    ]
  } : null);
  const schema = schemas[kind];
  const instruction = [common, rule, definition ? (definition.summary ?? '') : ''].filter(Boolean).join('\n\n');
  const revision = createHash('sha256').update(JSON.stringify(
    { current, standard, definition, schema, instruction, inventory, sources: manifest.sources },
    (key, value) => key === 'pending' ? undefined : value
  )).digest('hex');
  const contextToken = createHmac('sha256', secret).update(JSON.stringify([root, projectId, map, revision])).digest('hex');
  const ids = options.group ? groupMembers(current, options.group) : undefined;
  if (ids && kind === 'codemap') {
    const tree = groupTree(project.codemap.modules, project.codemap.imports, project.codemap.groups);
    for (const node of tree.nodes) {
      let parent = node.parent;
      for (let hops = 0; parent && hops < tree.nodes.length; ++hops) {
        if (ids.has(parent)) { ids.add(node.id); break; }
        parent = tree.nodes.find((item) => item.id === parent)?.parent;
      }
    }
    for (const module of project.codemap.modules) if (ids.has(tree.groupOf(module.id))) ids.add(module.id);
  }
  return {
    map, question, instructions: instruction, schema, additionalSchemas: { evidence, ...(kind === 'codemap' ? { skipped } : {}) },
    standard, definition: definition || undefined, revision, contextToken, ...statePage(current, options, ids),
    sources: manifest.sources,
    ...(inventory ? { inventory: { total: inventory.total, next: inventory.next, changed: inventory.changed.slice(0, 50), gone: inventory.gone.slice(0, 50) } } : {})
  };
}

export function mapContextMatches(expected: string, supplied: readonly unknown[]) {
  return supplied.some((token) => typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) &&
    timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex')));
}
