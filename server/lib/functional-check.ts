import { CAPABILITY_STATUSES, summarize, isCapabilityStatus, type CapabilityStatus } from './functional';

/**
 * Разбор ответа «Проверить по коду» (docs/07-maps.md, «“Проверить по коду” —
 * мнение, не свидетельство»). Чистая функция: ответ приходит строкой, карта —
 * списком возможностей. Ничего не пишет и ничего не подтверждает — результат
 * это таблица предложений, а отметки заносит человек.
 */

export interface CheckProposal {
  id: string;
  title?: string;
  /** Отметка в карте сейчас; `null` — ещё не оценена. */
  current: CapabilityStatus | null;
  /** Что предложила модель. */
  proposed: CapabilityStatus;
  note?: string;
}

export type CheckResult =
  | { ok: true; proposals: CheckProposal[]; problems: string[] }
  | { ok: false; reason: string };

const BLOCK = /^[ \t]*(?:```|~~~)[ \t]*docdd-functional-check[ \t]*\r?\n([\s\S]*?)^[ \t]*(?:```|~~~)[ \t]*$/m;

const ALLOWED = CAPABILITY_STATUSES.map((status) => `\`${status}\``).join(', ');

export function parseFunctionalCheck(
  answer: string,
  capabilities: readonly { id: string; title?: string; parent?: string; status?: string }[]
): CheckResult {
  const match = BLOCK.exec(answer);
  if (!match) {
    return { ok: false, reason: 'В ответе нет блока `docdd-functional-check`: разобрать нечего.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch (error) {
    return {
      ok: false,
      reason: `Блок \`docdd-functional-check\` не разбирается как JSON: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const list = (parsed as { capabilities?: unknown } | null)?.capabilities;
  if (!Array.isArray(list)) {
    return { ok: false, reason: 'В блоке `docdd-functional-check` нет списка `capabilities`.' };
  }

  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const leaves = summarize(capabilities).byId;
  const proposals = new Map<string, CheckProposal>();
  const problems: string[] = [];

  for (const [index, entry] of list.entries()) {
    const raw = (entry ?? {}) as Record<string, unknown>;
    const id = typeof raw['id'] === 'string' ? raw['id'].trim() : '';
    if (!id) {
      problems.push(`Запись №${index + 1}: нет \`id\` — пропущена`);
      continue;
    }
    const known = byId.get(id);
    if (!known) {
      problems.push(`Возможность \`${id}\`: нет в карте — пропущена`);
      continue;
    }
    // Состояние родителя считается по нижним: оценка родителя устарела бы с
    // первой же отметкой под ним (docs/07-maps.md, «Состояние реализации»).
    if (!leaves.get(id)?.leaf) {
      problems.push(`Возможность \`${id}\`: у неё есть подпункты — состояние считается по нижним, пропущена`);
      continue;
    }
    const status = raw['status'];
    if (!isCapabilityStatus(status)) {
      problems.push(`Возможность \`${id}\`: недопустимое состояние \`${String(status)}\`, допустимы ${ALLOWED} — пропущена`);
      continue;
    }
    const note = typeof raw['note'] === 'string' && raw['note'].trim() ? raw['note'].trim() : undefined;
    // Повтор id в ответе — уточнение, побеждает последний, как и в самой карте.
    proposals.set(id, {
      id,
      title: known.title,
      current: isCapabilityStatus(known.status) ? known.status : null,
      proposed: status,
      note
    });
  }

  return { ok: true, proposals: [...proposals.values()], problems };
}
