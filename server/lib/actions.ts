import type { LinkKind } from './types';
import {
  appendJournal,
  applyFrontMatter,
  joinRecord,
  journalLine,
  splitRecord,
  verifyWrite,
  type FrontMatterChanges
} from './write';

/**
 * Действия процесса: что именно меняется в файле и что уходит в журнал.
 * Чистые функции над текстом файла — файловая система остаётся у маршрута.
 */

/**
 * Слова журнала. Строка попадает в документ человека, поэтому она не
 * складывается из названий статусов контракта: `- 2026-08-30 · в разработку · architect`
 * читается, `- … · in_progress · …` — нет.
 */
const JOURNAL_ACTIONS: Record<string, string> = {
  review: 'на подтверждение',
  approved: 'подтверждён',
  draft: 'возвращён в черновик',
  superseded: 'заменён',
  rejected: 'отклонён',
  dropped: 'отменён',
  backlog: 'в очередь',
  ready: 'готова к работе',
  in_progress: 'в разработку',
  in_review: 'на проверку',
  done: 'закрыта'
};

/** Смена статуса меняет `status` и `updated` — и ничего больше. */
export const STATUS_FIELDS = ['status', 'updated'] as const;

/** Правка полей: тело документа не трогается вовсе, журнал не пишется. */
export const PATCH_FIELDS = ['owner', 'phase', 'tags', 'links', 'change', 'updated'] as const;

export interface WriteOutcome {
  text: string;
  /** Что не сошлось у сторожа. Пусто — можно писать. */
  problems: string[];
  journal?: string;
}

export function applyStatusChange(
  original: string,
  options: { status: string; actor: string; today: string }
): WriteOutcome {
  const file = splitRecord(original);
  if (!file) {
    return { text: original, problems: ['Файл не является записью с front matter.'] };
  }

  const action = JOURNAL_ACTIONS[options.status] ?? options.status;
  const line = journalLine(options.today, action, options.actor);

  const changed = appendJournal(
    applyFrontMatter(file, { status: options.status, updated: options.today }),
    line
  );
  const text = joinRecord(changed);

  return {
    text,
    journal: line,
    problems: verifyWrite(original, text, {
      allowedFields: [...STATUS_FIELDS],
      addedJournalLine: line
    })
  };
}

/**
 * Строка в журнал без смены статуса: заход к модели, принятый дифф, отказ.
 * Движение работы должно оставлять след, даже когда статус не меняется
 * (docs/09-execution.md).
 */
export function applyJournalNote(
  original: string,
  options: { action: string; actor: string; today: string }
): WriteOutcome {
  const file = splitRecord(original);
  if (!file) {
    return { text: original, problems: ['Файл не является записью с front matter.'] };
  }

  const line = journalLine(options.today, options.action, options.actor);
  const text = joinRecord(appendJournal(applyFrontMatter(file, { updated: options.today }), line));

  return {
    text,
    journal: line,
    problems: verifyWrite(original, text, { allowedFields: ['updated'], addedJournalLine: line })
  };
}

export interface PatchFields {
  owner?: string | null;
  /** Что за изменение: от него зависит, нужна ли задаче карта. */
  change?: string | null;
  phase?: string | null;
  tags?: string[];
  links?: Partial<Record<LinkKind, string[]>>;
}

export function applyFieldPatch(
  original: string,
  fields: PatchFields,
  today: string
): WriteOutcome {
  const file = splitRecord(original);
  if (!file) {
    return { text: original, problems: ['Файл не является записью с front matter.'] };
  }

  const changes: FrontMatterChanges = { updated: today };
  if (fields.owner !== undefined) changes.owner = fields.owner;
  if (fields.change !== undefined) changes.change = fields.change;
  if (fields.phase !== undefined) changes.phase = fields.phase;
  if (fields.tags !== undefined) changes.tags = fields.tags;
  if (fields.links !== undefined) changes.links = fields.links;

  const text = joinRecord(applyFrontMatter(file, changes));

  return {
    text,
    // Строку журнала правка полей не пишет: журнал — про движение работы,
    // а не про то, что кто-то поправил тег.
    problems: verifyWrite(original, text, { allowedFields: [...PATCH_FIELDS] })
  };
}

export function journalAction(status: string): string {
  return JOURNAL_ACTIONS[status] ?? status;
}
