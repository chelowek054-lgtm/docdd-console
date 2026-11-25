import { defineEventHandler, getQuery } from 'h3';
import { loadMapPresentation } from '../../../../lib/map-presentation';
import { mapPresentationFailure, mapPresentationProject } from '../../../../utils/map-presentation-request';

export default defineEventHandler(async (event) => {
  try {
    const target = await mapPresentationProject(event, getQuery(event).map);
    if ('error' in target) return target.error;
    return { ...loadMapPresentation(target.root, target.map), canPublish: target.canPublish };
  } catch (error) {
    return mapPresentationFailure(event, error);
  }
});
