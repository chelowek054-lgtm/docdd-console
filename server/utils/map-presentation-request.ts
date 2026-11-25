import { getRouterParam, type H3Event } from 'h3';
import { customDefinitions } from '../lib/custom-maps';
import { isPresentationMap } from '../lib/map-presentation';
import { OutsideRootError } from '../lib/paths';
import { can } from '../lib/permissions';
import { readManifest, WorkspaceError } from '../lib/workspace';
import { authEnabled } from './auth';
import { fail } from './http';
import { findProject } from './projects';

export function accountForMapEvent(context: Record<string, unknown>): string {
  const user = context.user as { login?: unknown } | undefined;
  return typeof user?.login === 'string' && user.login ? user.login : 'local';
}

export async function mapPresentationProject(event: H3Event, map: unknown) {
  if (!isPresentationMap(map)) return { error: fail(event, 400, 'map_invalid', 'Неизвестный вид карты') };
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return { error: fail(event, 404, 'project_not_found', 'Проект не найден в списке') };
  const manifest = readManifest(project.root);
  if (map.startsWith('custom:') && !customDefinitions(manifest).definitions.some((item) => item.id === map.slice(7))) {
    return { error: fail(event, 404, 'map_not_found', 'Карта не найдена в проекте') };
  }
  const user = event.context.user as { login: string; admin: boolean; agent?: boolean } | undefined;
  return { root: project.root, map, canPublish: !authEnabled() || can(user ?? null, manifest.team, 'edit_draft').allowed };
}

export function mapPresentationFailure(event: H3Event, error: unknown) {
  if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
  if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
  console.error('ДокDD: ошибка хранения раскладки карты', error);
  return fail(event, 500, 'map_presentation_failed', 'Не удалось прочитать или сохранить раскладку карты');
}
