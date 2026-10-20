import { RELATION_LABEL, RELATION_TYPES, isRelationType, type CapabilityLike, type RelationLike } from './functional';
import { mapDraftText, type CustomChange, type CustomLinks, type EvidenceVerdict, type Evidence, type ProjectMap } from './maps';
import type { CustomMapDefinition, CustomMapFeature, ProjectManifest } from './types';

/**
 * Пользовательские карты (docs/adr/0028-custom-maps.md): определения из манифеста,
 * вид одной карты из сложенной картины и текст черновика. Чистые функции — без
 * файловой системы, их зовут маршруты и правила.
 */

export const CUSTOM_MAP_FEATURES: readonly CustomMapFeature[] = ['status', 'priority', 'horizon', 'evidence', 'links'];

const MAP_ID = /^[A-Za-z0-9-]+$/;

export interface CustomDefinitionsResult {
  definitions: CustomMapDefinition[];
  /** Беды определений по-человечески; определение с бедой в `definitions` не попадает. */
  problems: string[];
}

/** Узел пользовательской карты в форме возможности: экран рисует его тем же деревом. */
export interface CustomNodeView extends CapabilityLike {
  links?: CustomLinks | undefined;
  declaredBy?: string | undefined;
  pending?: boolean | undefined;
}

export interface CustomRelationView extends RelationLike {
  evidence?: Evidence | undefined;
  /** Вердикт сверки, если у связи есть свидетельство. */
  verdict?: EvidenceVerdict | undefined;
  declaredBy?: string | undefined;
  pending?: boolean | undefined;
}

export interface CustomMapView {
  nodes: CustomNodeView[];
  relations: CustomRelationView[];
}

/** Пять видов функциональной карты — умолчание, когда определение своих видов не назвало. */
export function defaultCustomRelations(): CustomMapDefinition['relations'] {
  return RELATION_TYPES.map((type) => ({ id: type, label: RELATION_LABEL[type], style: type }));
}

/**
 * Отбирает годные определения из `maps.custom`. Неверное определение — беда
 * одной карты, а не всего проекта: его пропускаем и называем, остальные живут.
 * Незнакомые поля определения сохраняются как есть.
 */
export function customDefinitions(manifest: Pick<ProjectManifest, 'maps'>): CustomDefinitionsResult {
  const definitions: CustomMapDefinition[] = [];
  const problems: string[] = [];
  const raw = manifest.maps?.custom;
  if (raw === undefined) return { definitions, problems };
  if (!Array.isArray(raw)) return { definitions, problems: ['maps.custom: ожидается список определений карт.'] };

  const seen = new Set<string>();
  raw.forEach((entry, index) => {
    const where = `maps.custom[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${where}: ожидается объект.`);
      return;
    }
    const item = entry as Record<string, unknown>;
    const own: string[] = [];

    const id = item['id'];
    if (typeof id !== 'string' || !MAP_ID.test(id)) own.push(`${where}.id: латиница, цифры, дефис.`);
    else if (seen.has(id)) own.push(`${where}.id: карта «${id}» уже объявлена.`);

    const title = item['title'];
    if (typeof title !== 'string' || title.trim() === '') own.push(`${where}.title: нужно название.`);

    const summary = item['summary'];
    if (summary !== undefined && typeof summary !== 'string') own.push(`${where}.summary: ожидается строка.`);

    const node = item['node'] as Record<string, unknown> | undefined;
    if (!node || typeof node !== 'object' || typeof node['label'] !== 'string' || typeof node['plural'] !== 'string') {
      own.push(`${where}.node: нужны label и plural.`);
    }

    let relations = defaultCustomRelations();
    if (item['relations'] !== undefined) {
      if (!Array.isArray(item['relations'])) own.push(`${where}.relations: ожидается список.`);
      else {
        const ids = new Set<string>();
        relations = [];
        (item['relations'] as unknown[]).forEach((relation, at) => {
          const r = relation as Record<string, unknown> | null;
          const rid = r?.['id'];
          if (!r || typeof rid !== 'string' || rid === '' || typeof r['label'] !== 'string' || !isRelationType(r['style'])) {
            own.push(`${where}.relations[${at}]: нужны id, label и style — один из ${RELATION_TYPES.join(', ')}.`);
            return;
          }
          if (ids.has(rid)) {
            own.push(`${where}.relations[${at}].id: вид «${rid}» повторяется.`);
            return;
          }
          ids.add(rid);
          relations.push({ ...r, id: rid, label: r['label'] as string, style: r['style'] });
        });
      }
    }

    let features: CustomMapFeature[] = [];
    if (item['features'] !== undefined) {
      if (!Array.isArray(item['features'])) own.push(`${where}.features: ожидается список.`);
      else {
        for (const feature of item['features'] as unknown[]) {
          if ((CUSTOM_MAP_FEATURES as readonly unknown[]).includes(feature)) {
            if (!features.includes(feature as CustomMapFeature)) features = [...features, feature as CustomMapFeature];
          } else own.push(`${where}.features: «${String(feature)}» — неизвестно; можно ${CUSTOM_MAP_FEATURES.join(', ')}.`);
        }
      }
    }

    if (own.length > 0) {
      problems.push(...own);
      return;
    }
    seen.add(id as string);
    definitions.push({
      ...item,
      id: id as string,
      title: title as string,
      node: { ...node, label: node!['label'] as string, plural: node!['plural'] as string },
      relations,
      features
    });
  });

  return { definitions, problems };
}

/**
 * Узлы и связи одной пользовательской карты из сложенной картины. Поля, которых
 * карта в `features` не взяла, не показываются: выключенное состояние не должно
 * всплывать на экране только потому, что его записали в блок.
 */
export function customMapView(projectMap: Pick<ProjectMap, 'custom'>, def: CustomMapDefinition): CustomMapView {
  const has = (feature: CustomMapFeature) => def.features.includes(feature);

  const nodes = projectMap.custom.nodes
    .filter((node) => node.map === def.id)
    .map((node): CustomNodeView => ({
      id: node.id,
      title: node.title,
      parent: node.parent,
      summary: node.summary,
      status: has('status') ? node.status : undefined,
      note: node.note,
      priority: has('priority') ? node.priority : undefined,
      horizon: has('horizon') ? node.horizon : undefined,
      links: has('links') ? node.links : undefined,
      declaredBy: node.declaredBy,
      pending: node.pending
    }));

  const relations = projectMap.custom.relations
    .filter((relation) => relation.map === def.id)
    .map((relation): CustomRelationView => ({
      from: relation.from,
      to: relation.to,
      type: relation.type,
      summary: relation.summary,
      ...(has('evidence') && relation.evidence ? { evidence: relation.evidence, verdict: relation.status } : {}),
      declaredBy: relation.declaredBy,
      pending: relation.pending
    }));

  return { nodes, relations };
}

/**
 * Черновик записи `map` с одним блоком `docdd-custom` — той же `mapDraftText`,
 * что и черновики встроенных карт: формат записи один, расходиться ему не с чего.
 */
export function customDraftText(id: string, title: string, change: CustomChange, today: string): string {
  return mapDraftText(id, title, { custom: change }, ['custom'], today);
}
