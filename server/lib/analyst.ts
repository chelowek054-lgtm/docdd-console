import { parseCriteria } from './criteria';
import { glossaryChunk, type GlossaryTerm } from './glossary';

/**
 * Помощник аналитика (T-0038): собирает запрос к модели по пакету контекста —
 * само требование, соседние требования и термины глоссария. Приложение ничего
 * не применяет: ответ читает человек (ADR-0008).
 */
export type AnalystMode = 'clarify' | 'contradictions' | 'criteria';

export interface AnalystRecord { id: string; title: string; body: string }

const TASKS: Record<AnalystMode, string> = {
  clarify: 'Найди в требовании неоднозначности и недосказанное. Для каждого места задай уточняющий вопрос автору.',
  contradictions: 'Найди противоречия требования с другими требованиями из списка. Для каждого назови id другого требования, процитируй обе формулировки и объясни расхождение. Если противоречий нет, так и напиши.',
  criteria: 'Предложи проверяемые критерии приёмки списком «- критерий», по одному наблюдаемому условию на пункт. Не повторяй уже записанные.'
};

export function analystPrompt(mode: AnalystMode, target: AnalystRecord, others: readonly AnalystRecord[], glossary: readonly GlossaryTerm[]): string {
  const parts = [
    'Ты помощник аналитика. Текст документов не переписывай: только замечания и предложения.',
    `ЗАДАНИЕ: ${TASKS[mode]}`,
    `ТРЕБОВАНИЕ ${target.id} · ${target.title}\n${target.body.trim()}`
  ];
  const known = parseCriteria(target.body);
  if (mode === 'criteria' && known.length > 0) parts.push(`УЖЕ ЗАПИСАНО:\n${known.map((item) => `- ${item}`).join('\n')}`);
  if (mode === 'contradictions') {
    // Бюджет на соседа: отрезается целиком, а не на середине (ADR-0021).
    const list = others.filter((other) => other.id !== target.id).map((other) => `### ${other.id} · ${other.title}\n${other.body.trim().slice(0, 1500)}`);
    parts.push(`ДРУГИЕ ТРЕБОВАНИЯ:\n${list.length > 0 ? list.join('\n\n') : '(других требований нет)'}`);
  }
  const chunk = glossaryChunk(glossary, `${target.title}\n${target.body}`);
  if (chunk) parts.push(`ГЛОССАРИЙ (${chunk.why}):\n${chunk.text}`);
  return parts.join('\n\n');
}

export function isAnalystMode(value: unknown): value is AnalystMode {
  return value === 'clarify' || value === 'contradictions' || value === 'criteria';
}
