import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { useStorage } from 'nitropack/runtime';

import { checkEvidence, evidenceClaims, parseMapRecord } from '../../../../lib/maps';
import { fixPrompt, mapsPrompt, type MapsState } from '../../../../lib/prompt';
import { mapSchemas } from '../../../../lib/map-schemas';
import { readWorkspace, sourceReader, WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';

/**
 * Сборка запроса к модели по шаблону из репозитория. Приложение подставляет
 * данные и отдаёт текст: отправлять его или нет — решает человек
 * (docs/prompts/README.md).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ kind?: unknown; codes?: unknown; severity?: unknown }>(event);
  const kind = typeof body?.kind === 'string' ? body.kind : '';

  try {
    if (kind === 'fix') {
      const index = loadIndex(project.root);
      const codes = Array.isArray(body?.codes)
        ? new Set((body.codes as unknown[]).filter((code): code is string => typeof code === 'string'))
        : null;
      const severity = typeof body?.severity === 'string' ? body.severity : '';

      const issues = index.issues
        .filter((issue) => (codes === null || codes.has(issue.code)))
        .filter((issue) => (severity === '' || issue.severity === severity))
        // Ошибки первыми: запрос читается сверху, и чинить надо тоже сверху.
        .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));

      return { prompt: fixPrompt(await template('fix-plan.md'), issues), count: issues.length };
    }

    if (kind === 'maps') {
      return {
        prompt: mapsPrompt(await template('update-maps.md'), await mapsState(project.root), mapSchemas()),
        count: 0
      };
    }

    return fail(event, 400, 'kind_invalid', 'Известны два запроса: `fix` и `maps`');
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'prompt_failed', 'Не удалось собрать запрос', String(error));
  }
});

/** Шаблон приходит из ресурсов сборки — того же файла, что лежит в docs/prompts. */
async function template(name: string): Promise<string> {
  const raw = await useStorage('assets:prompts').getItem(name);
  if (typeof raw === 'string') return raw;
  // Буфер: ресурсы Nitro отдают файл байтами, если не признали его текстом.
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString('utf8');
  throw new Error(`Шаблон запроса \`${name}\` не найден в сборке`);
}

/** Что модели полезно знать: из чего сложена картина и что перестало сходиться. */
async function mapsState(root: string): Promise<MapsState> {
  const workspace = readWorkspace(root);
  const map = buildProjectMap(root);
  const read = sourceReader(root);

  const unverified: { label: string; path: string; line: number; verdict: string }[] = [];
  const index = loadIndex(root);
  for (const record of index.records) {
    if (record.type !== 'map' || record.status !== 'approved') continue;
    const parsed = parseMapRecord(readRecordBody(root, record.path));
    for (const claim of evidenceClaims(parsed.change)) {
      const verdict = checkEvidence(claim.evidence, read(claim.evidence.path), claim.side);
      if (verdict === 'ok') continue;
      unverified.push({
        label: claim.label,
        path: claim.evidence.path,
        line: claim.evidence.line,
        verdict
      });
    }
  }

  return {
    from: map.from,
    modules: map.codemap.modules.length,
    sources: map.dataflow.sources.length,
    screens: map.userflow.screens.length,
    unverified,
    code: workspace.manifest.sources?.code ?? [],
    client: workspace.manifest.sources?.client ?? []
  };
}

function readRecordBody(root: string, path: string): string {
  const read = sourceReader(root);
  return read(path) ?? '';
}
