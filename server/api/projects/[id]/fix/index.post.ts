import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { normalizeRoot } from '../../../../lib/paths';
import { abortSignalOf } from '../../../../utils/abort';
import { borderOf, borderOfChosen, startFix } from '../../../../utils/fix-service';
import { pickedIssues } from '../../../../utils/chosen';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';
import { eventStream } from '../../../../utils/sse';

/**
 * Починка нарушений по подтверждённому плану
 * (docs/adr/0010-model-fixes-violations.md). Границу — какие файлы можно
 * трогать — приложение берёт из тех же нарушений, из которых собрало план, а
 * не из запроса браузера: иначе граница ничего не значит.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ plan?: unknown; codes?: unknown; severity?: unknown; issues?: unknown }>(event);
  const plan = typeof body?.plan === 'string' ? body.plan : '';
  const codes = Array.isArray(body?.codes) ? body.codes.filter((code): code is string => typeof code === 'string') : [];
  const severity = typeof body?.severity === 'string' ? body.severity : '';

  const root = normalizeRoot(project.root);
  const index = loadIndex(root);
  // Граница считается по отмеченным нарушениям, а не по фильтру экрана.
  const chosen = pickedIssues(body?.issues);
  const border = chosen.length ? borderOfChosen(index, chosen) : borderOf(index, codes, severity);
  const files = [...border.keys()];

  const stream = eventStream(event);
  const outcome = await startFix(root, {
    plan,
    files,
    template: await template('fix-apply.md'),
    signal: abortSignalOf(event),
    onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent)
  });

  // Заголовки ушли с первым событием — причина едет тем же путём.
  stream.send(outcome.ok ? 'done' : 'error', outcome.ok ? outcome : { error: outcome });
  stream.close();
});

async function template(name: string): Promise<string> {
  const raw = await useStorage('assets:prompts').getItem(name);
  if (typeof raw === 'string') return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString('utf8');
  throw new Error(`Шаблон запроса \`${name}\` не найден в сборке`);
}
