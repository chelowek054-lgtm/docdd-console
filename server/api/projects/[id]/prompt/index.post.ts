import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { useStorage } from 'nitropack/runtime';

import { checkEvidence, evidenceClaims, parseMapRecord } from '../../../../lib/maps';
import { fixPrompt, inboxPrompt, mapFixPrompt, mapsPrompt, type MapsState } from '../../../../lib/prompt';
import { inboxNotes } from '../../../../utils/inbox-service';
import { mapSchemas } from '../../../../lib/map-schemas';
import { worthAsking } from '../../../../lib/inventory';
import { inventoryOf } from '../../../../utils/inventory-service';
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

  const body = await readBody<{
    kind?: unknown;
    codes?: unknown;
    severity?: unknown;
    answer?: unknown;
    problems?: unknown;
    notes?: unknown;
  }>(event);
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
      const inventory = inventoryOf(project.root);

      // Пустой проект — состояние, а не ошибка, и говорить о нём надо словами.
      // К модели не идём: запрос стоит времени и денег (docs/07-maps.md).
      if (inventory.total === 0) {
        return fail(event, 422, 'project_empty', 'В проекте нет файлов кода: описывать нечего. Проверьте `sources.code` в манифесте');
      }
      if (!worthAsking(inventory)) {
        return fail(event, 422, 'nothing_to_describe', `Все ${inventory.total} файлов описаны подтверждёнными картами и с тех пор не менялись`);
      }

      const state = await mapsState(project.root);
      return {
        prompt: mapsPrompt(await template('update-maps.md'), {
          ...state,
          inventory: {
            total: inventory.total,
            describedCount: inventory.described.length,
            next: inventory.next,
            gone: inventory.gone,
            changed: inventory.changed.filter((path) => inventory.next.includes(path)),
            left: inventory.pending.length + inventory.changed.length - inventory.next.length
          }
        }, mapSchemas()),
        count: inventory.next.length
      };
    }

    if (kind === 'inbox') {
      // Разбор идёт по заметкам, названным человеком; не назвал — по всем.
      const chosen = Array.isArray(body?.notes)
        ? body.notes.filter((note): note is string => typeof note === 'string')
        : [];

      const all = inboxNotes(project.root);
      const notes = chosen.length ? all.filter((note) => chosen.includes(note.path)) : all;
      if (notes.length === 0) {
        return fail(event, 422, 'inbox_empty', 'Во входящем нет заметок: разбирать нечего');
      }

      const known = loadIndex(project.root).records.map((record) => ({
        id: record.id,
        type: record.type,
        title: record.title
      }));

      return {
        prompt: inboxPrompt(await template('inbox-plan.md'), notes, known),
        count: notes.length
      };
    }

    if (kind === 'map-fix') {
      // Форма не сошлась — но разбор файлов в силе, и переделывать его незачем.
      const answer = typeof body?.answer === 'string' ? body.answer : '';
      const problems = Array.isArray(body?.problems)
        ? body.problems.filter((problem): problem is string => typeof problem === 'string')
        : [];

      if (answer.trim() === '') {
        return fail(event, 400, 'answer_required', 'Нечего править: прошлого ответа нет');
      }
      return {
        prompt: mapFixPrompt(await template('fix-map-answer.md'), answer, problems),
        count: problems.length
      };
    }

    return fail(event, 400, 'kind_invalid', 'Известны запросы: `fix`, `maps`, `map-fix`, `inbox`');
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
