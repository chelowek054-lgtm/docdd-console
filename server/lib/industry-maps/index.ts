import { INDUSTRY_STANDARDS } from '../map-core';
import { isRelationType } from '../functional';
import type { CustomMapDefinition } from '../types';
export { researchHistory, stageMeasurements, verificationRuns, type MlStage } from './domain/model';

/** Определение для манифеста и легенда используют один отраслевой стандарт. */
export function industryDefinitions(): CustomMapDefinition[] {
  return Object.values(INDUSTRY_STANDARDS).map((standard) => ({
    id: standard.template,
    notation: standard.template,
    title: standard.title,
    summary: standard.question,
    node: { label: 'Элемент', plural: 'Элементы' },
    relations: standard.edgeKinds.map((edge) => ({
      id: edge.id, label: edge.title, style: isRelationType(edge.id) ? edge.id : 'depends'
    })),
    features: ['status', 'evidence', 'links']
  }));
}
