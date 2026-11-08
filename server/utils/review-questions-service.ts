import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { applyJournalNote } from '../lib/actions';
import { renderContextPack } from '../lib/context-pack';
import { addThread, discussionPath, emptyDiscussion, parseDiscussion, serializeDiscussion } from '../lib/discussion';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { answersSummary, answersThread, expectedResultOf, reviewPrompt, type ReviewAnswer } from '../lib/review-questions';
import { packFor } from './context-service';
import { loadIndex } from './index-service';
import { journalNow, openRecord, saveRecord } from './record-write';
import { workState } from './work-service';

/**
 * Проверка задачи вопросами (R-0117): запрос собирается здесь, чтобы модель получала только
 * разрешённое. Закрытое в запрос не идёт, а по ответам статус задачи не меняется.
 */
export type ReviewRefusal = { ok: false; status: number; code: string; message: string };

/** Глубины 2 хватает на «задача → требование → проверка»: вопросы задаются по проверкам требования. */
const NEEDS = { kinds: ['record', 'links', 'vision'] as const, depth: 2, linkKinds: ['implements', 'verified_by', 'verifies'] as const, budget: 24_000 };

function reviewable(root: string, recordId: string) {
  const record = loadIndex(root).records.find((item) => item.id === recordId);
  if (!record) return { ok: false as const, status: 404, code: 'record_not_found', message: `Записи \`${recordId}\` в проекте нет` };
  if (record.type !== 'task' || record.status !== 'in_review') {
    return { ok: false as const, status: 409, code: 'task_not_in_review', message: `Вопросы задаются только задаче на проверке, а ${recordId} в статусе \`${record.status}\`` };
  }
  return { ok: true as const, record };
}

export async function reviewQuestionsPrompt(root: string, recordId: string, template: string): Promise<{ ok: true; prompt: string } | ReviewRefusal> {
  const normalized = normalizeRoot(root);
  const found = reviewable(normalized, recordId);
  if (!found.ok) return found;
  const { record } = found;
  // Закрытую задачу не показать по кускам: и её ожидаемый результат, и дифф пришлось бы отдать модели.
  if (record.tags.includes('confidential')) {
    return { ok: false, status: 422, code: 'task_confidential', message: `Задача ${recordId} помечена \`confidential\`: модели она не отдаётся` };
  }
  const body = readFileSync(resolveInside(normalized, record.path), 'utf8');
  const state = await workState(normalized, record, body);
  const pack = packFor(normalized, recordId, { kinds: [...NEEDS.kinds], depth: NEEDS.depth, linkKinds: [...NEEDS.linkKinds], budget: NEEDS.budget });
  return {
    ok: true,
    prompt: reviewPrompt(template, {
      id: record.id,
      title: record.title,
      expected: expectedResultOf(body),
      context: renderContextPack(pack),
      diff: state.started ? state.diff : ''
    })
  };
}

/** Ответы — в обсуждение, итог — в журнал. Статус не трогаем: закрывает и возвращает человек отдельным действием. */
export function saveReviewAnswers(root: string, recordId: string, answers: readonly ReviewAnswer[], actor: string, now = new Date()): { ok: true; summary: string } | ReviewRefusal {
  const normalized = normalizeRoot(root);
  const found = reviewable(normalized, recordId);
  if (!found.ok) return found;
  if (!answers.length) return { ok: false, status: 400, code: 'answers_required', message: 'Ответов нет: записывать нечего' };
  const summary = answersSummary(answers);
  const context = openRecord(normalized, recordId);
  if (!context) return { ok: false, status: 404, code: 'record_not_found', message: `Записи \`${recordId}\` в проекте нет` };
  const signed = actor.trim() || 'человек';
  const saved = saveRecord(context, applyJournalNote(context.original, { action: summary, actor: signed, today: journalNow(normalized) }), normalized);
  if (!saved.ok) return { ok: false, status: 409, code: 'record_not_saved', message: `Итог проверки в ${recordId} записать не удалось` };
  const file = resolveInside(normalized, discussionPath(found.record.path));
  const current = existsSync(file) ? parseDiscussion(readFileSync(file, 'utf8')) : emptyDiscussion();
  writeFileSync(file, serializeDiscussion(addThread(current, signed, answersThread(answers), now)), 'utf8');
  return { ok: true, summary };
}
