import { defineEventHandler, getRequestURL, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { accessFor, agentForAssignee, agentRunPrompt } from '../../../../../../lib/agent-run';
import { normalizeRoot } from '../../../../../../lib/paths';
import { WorkspaceError } from '../../../../../../lib/workspace';
import { listAgents } from '../../../../../../utils/agents-service';
import { agentToken, authEnabled, loadUsers } from '../../../../../../utils/auth';
import { fail } from '../../../../../../utils/http';
import { feedStream } from '../../../../../../utils/job-feeds';
import { loadIndex } from '../../../../../../utils/index-service';
import { findProject } from '../../../../../../utils/projects';
import { accept, handover, reject } from '../../../../../../utils/work-service';
import { sharedDenied } from '../../../../../../utils/mode';

/**
 * Действия над работой: отдать модели, принять дифф, отправить на доработку,
 * отклонить. Приложение не сливает ничего само — принимает человек
 * (docs/adr/0009-work-through-console.md).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ action?: unknown; actor?: unknown; comment?: unknown }>(event);
  const action = typeof body?.action === 'string' ? body.action : '';
  // На общем сервере работа и слияние — только со входом: право work/merge проверяет middleware/auth.ts.
  if (action === 'handover' || action === 'rework' || action === 'agent' || action === 'accept') { const denied = sharedDenied(event, 'Работа над задачей и слияние'); if (denied) return denied; }
  const actor = typeof body?.actor === 'string' ? body.actor : '';
  const comment = typeof body?.comment === 'string' ? body.comment : '';

  try {
    const root = normalizeRoot(project.root);
    const index = loadIndex(root);
    const record = index.records.find((item) => item.id === recordId);
    if (!record) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    if (action === 'handover' || action === 'rework' || action === 'agent') {
      // Ворота те же, что и у перехода в работу: неподтверждённое не отдаётся.
      if (record.status !== 'ready' && record.status !== 'in_progress') {
        return fail(
          event,
          409,
          'task_not_ready',
          `Задача ${recordId} в статусе \`${record.status}\`. Отдавать модели можно только готовую к работе: подтверждение человеком идёт раньше кода`
        );
      }

      // «Запустить в работу» (R-0100): исполнитель — аккаунт агента; консоль выдаёт ему токен на запуск.
      let agent: NonNullable<Parameters<typeof handover>[3]['agent']> | undefined;
      if (action === 'agent') {
        if (!authEnabled()) {
          return fail(event, 409, 'agent_needs_auth', 'Агенты работают на общем сервере со входом (DOCDD_AUTH=on): без входа аккаунтов агентов нет');
        }
        const assignee = typeof record.extra['assignee'] === 'string' ? record.extra['assignee'] : '';
        const choice = agentForAssignee(assignee, await loadUsers(), listAgents(root).agents);
        if (!choice.ok) return fail(event, 409, choice.code, choice.message);
        const token = await agentToken(choice.account.login);
        const baseUrl = getRequestURL(event).origin;
        agent = {
          wrap: (prompt) => agentRunPrompt(choice.agent, choice.account, prompt, { baseUrl, projectId: id, taskId: recordId, token }),
          ...(choice.agent.model ? { model: choice.agent.model } : {}),
          access: accessFor(choice.agent.access)
        };
      }

      // Работа идёт минутами: экран показывает её ход лентой событий
      // (docs/04-ui.md, раздел «Запрос к модели»).
      const stream = feedStream(event, id);
      const outcome = await handover(root, index, record, {
        actor,
        rework: action === 'rework' ? comment : '',
        template: await template('task.md'),
        ...(agent ? { agent } : {}),
        signal: stream.signal,
        onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent)
      });

      // Заголовки ушли с первым событием — причина едет тем же путём.
      stream.send(outcome.ok ? 'done' : 'error', outcome.ok ? outcome : { error: outcome });
      stream.close();
      return;
    }

    if (action === 'accept') {
      const outcome = await accept(root, record, actor);
      return outcome.ok ? outcome : fail(event, statusFor(outcome.code), outcome.code, outcome.message, outcome.detail);
    }

    if (action === 'reject') {
      return reject(root, record, actor);
    }

    return fail(event, 400, 'action_invalid', 'Известны действия: handover, rework, agent, accept, reject');
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'work_failed', 'Не удалось выполнить действие', String(error));
  }
});

/** Отказ модели и отказ git — разные беды, и коды ответа у них разные. */
function statusFor(code: string): number {
  // Отмена — не беда: человек передумал ждать.
  if (code === 'llm_cancelled') return 499;
  if (code.startsWith('llm_')) return code === 'llm_unavailable' || code === 'llm_unauthorized' ? 503 : 502;
  if (code === 'not_a_repository' || code === 'detached_head') return 422;
  return 409;
}

async function template(name: string): Promise<string> {
  const raw = await useStorage('assets:prompts').getItem(name);
  if (typeof raw === 'string') return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString('utf8');
  throw new Error(`Шаблон запроса \`${name}\` не найден в сборке`);
}
