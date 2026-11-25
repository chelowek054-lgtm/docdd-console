import { defineEventHandler, readBody } from 'h3';
import { parseLayoutPublication, publishMapLayout } from '../../../../lib/map-presentation';
import { fail } from '../../../../utils/http';
import { accountForMapEvent, mapPresentationFailure, mapPresentationProject } from '../../../../utils/map-presentation-request';

export default defineEventHandler(async (event) => {
  const publication = parseLayoutPublication(await readBody<unknown>(event));
  if (!publication) return fail(event, 400, 'layout_invalid', 'Укажите карту, представление, версию и координаты узлов');
  try {
    const target = await mapPresentationProject(event, publication.map);
    if ('error' in target) return target.error;
    if (!target.canPublish) return fail(event, 403, 'forbidden', 'Нет права сохранять общую раскладку');
    const state = publishMapLayout(target.root, publication, accountForMapEvent(event.context));
    if (!state) return fail(event, 409, 'map_layout_conflict', 'Общая раскладка изменилась. Обновите её и повторите публикацию');
    return { ...state, canPublish: true };
  } catch (error) {
    return mapPresentationFailure(event, error);
  }
});
