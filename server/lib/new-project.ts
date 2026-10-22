import type { ProposedRecord } from './inbox';
import { slugify } from './scaffold';

/**
 * Мастер нового проекта (R-0076, docs/04-ui.md, «Подключение»): из вектора, списка
 * возможностей и глоссария — черновики записей до первой задачи. Чистые функции:
 * записи заводит `createRecords` (номера раздаёт приложение), подтверждает человек.
 */

export interface WizardVision { problem: string; audience: string; outcome: string; not: string }

export interface WizardFeature {
  /** Название возможности: что система должна уметь. */
  title: string;
  /** Требование под неё — как понять, что готово; нет — берётся название. */
  requirement?: string;
}

export interface WizardInput {
  vision: WizardVision;
  features: WizardFeature[];
  /** Название фазы с первыми задачами. */
  phase?: string;
}

export interface WizardPlan {
  records: ProposedRecord[];
  problems: string[];
}

/** Строки «Название — требование» (или «Название: требование») в список возможностей; пустые отбрасываются. */
export function parseFeatures(text: string): WizardFeature[] {
  const out: WizardFeature[] = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '').trim();
    if (!clean) continue;
    const split = /^(.+?)\s+[—–-]\s+(.+)$/.exec(clean) ?? /^(.+?)\s*:\s+(.+)$/.exec(clean);
    out.push(split ? { title: (split[1] as string).trim(), requirement: (split[2] as string).trim() } : { title: clean });
  }
  return out;
}

/** Строки «Термин — определение» в список терминов. */
export function parseTerms(text: string): { term: string; definition: string }[] {
  return parseFeatures(text).filter((item) => item.requirement).map((item) => ({ term: item.title, definition: item.requirement as string }));
}

/** Текст `glossary.md`: заголовок, пример формата и термины — по строке `- **Термин** — определение`. */
export function glossaryText(terms: readonly { term: string; definition: string }[], project: string): string {
  const lines = [`# Глоссарий проекта «${project}»`, '', 'Термины, которыми говорит команда. Формат строки: `- **Термин** — определение.`', ''];
  if (terms.length === 0) lines.push('- **Пример** — слово, которое в проекте значит что-то своё; замените строкой с настоящим термином.');
  for (const item of terms) lines.push(`- **${item.term}** — ${item.definition}`);
  return lines.join('\n') + '\n';
}

const VERIFICATION_STEPS = (title: string) => `Проверка возможности «${title}».\n\n## Предусловия\n\n- Что должно быть готово до начала.\n\n## Шаги\n\n1. Действие — ожидаемый результат.\n\n## Ожидаемый результат\n\nЧто считается «прошла».`;

/**
 * План записей: карта с вектором и возможностями, на каждую возможность — требование,
 * проверка и задача, и фаза, что покрывает задачи. Всё — черновики; связи — по ключам.
 */
export function wizardPlan(input: WizardInput): WizardPlan {
  const problems: string[] = [];
  const vision = input.vision;
  if (!vision.problem.trim()) problems.push('Не записана проблема, которую решает продукт.');
  const features = input.features.filter((item) => item.title.trim());
  if (features.length === 0) problems.push('Не названа ни одна возможность: мастеру нечего заводить.');
  if (problems.length) return { records: [], problems };

  // Идентификаторы возможностей — из названий; повтор получает номер, а не затирает соседа.
  const used = new Set<string>();
  const ids = features.map((feature) => {
    const base = slugify(feature.title, 30) || 'feature';
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  });

  const records: ProposedRecord[] = [{
    key: 'map', type: 'map', title: 'Вектор и первые возможности',
    vision: { problem: vision.problem.trim(), audience: vision.audience.trim(), outcome: vision.outcome.trim(), not: vision.not.trim() },
    capabilities: features.map((feature, at) => ({ id: ids[at] as string, title: feature.title.trim(), priority: 'must', horizon: 'now' }))
  }];
  features.forEach((feature, at) => {
    const n = at + 1;
    const requirement = (feature.requirement ?? '').trim();
    records.push(
      { key: `r${n}`, type: 'requirement', title: requirement || feature.title.trim(), body: `${requirement || feature.title.trim()}\n\nГотово, когда: что должно быть видно, чтобы считать это выполненным.` },
      { key: `v${n}`, type: 'verification', title: `Проверка: ${feature.title.trim()}`, kind: 'manual', body: VERIFICATION_STEPS(feature.title.trim()), links: { verifies: [`r${n}`] } },
      { key: `t${n}`, type: 'task', title: feature.title.trim(), change: 'feature', reuse: 'none', links: { implements: [`r${n}`], verified_by: [`v${n}`], affects: ['map'] } }
    );
  });
  records.push({ key: 'phase', type: 'phase', title: input.phase?.trim() || 'Первая фаза', links: { covers: features.map((_, at) => `t${at + 1}`) } });
  return { records, problems: [] };
}
