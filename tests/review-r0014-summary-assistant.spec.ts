// V-0014 manual — подготовка (R-0014; задачи T-0035, T-0036)
import { describe, expect, it } from 'vitest';

import { assistantPrompt, customerSummary, roadmap } from '../server/lib/manager';
import type { IndexRecord } from '../server/lib/types';

const idx = (id: string, type: string, status: string, o: Partial<IndexRecord> & { extra?: Record<string, unknown> } = {}): IndexRecord =>
  ({ id, type, status, title: `Запись ${id}`, links: {}, extra: {}, ...o }) as unknown as IndexRecord;

describe('R-0014 сводка и помощник', () => {
  it('сводка собирается в Markdown без номеров процесса', () => {
    const caps = [
      { id: 'M-1', title: 'Готовое', status: 'implemented' },
      { id: 'M-2', title: 'В пути', status: 'partial' },
      { id: 'M-3', title: 'Дальше', status: 'planned' }
    ];
    const md = customerSummary('Проект', '2026-10-11', caps, roadmap([], '2026-10-11'));
    expect(md).toMatch(/^# Проект: сводка на 2026-10-11/);
    expect(md).toContain('Готово 1 из 3 возможностей (33%).');
    expect(md).toContain('## Что готово\n- Готовое');
    expect(md).toContain('## Что в работе\n- В пути');
    expect(md).toContain('## Что следующее\n- Дальше');
  });
  it('помощник: три вопроса — только текст запроса, данные внутри, ничего не применяет', () => {
    const records = [idx('T-0001', 'task', 'ready', { title: 'Первая', updated: '2026-10-10' }), idx('T-0002', 'task', 'done', { updated: '2026-10-01' })];
    for (const q of ['blockers', 'changes', 'plan'] as const) {
      const p = assistantPrompt(q, records, '2026-10-11');
      expect(typeof p).toBe('string');
      expect(p).toContain('Ничего не меняй');
      expect(p).toContain('T-0001');
    }
    expect(assistantPrompt('changes', records, '2026-10-11')).not.toContain('T-0002');
    expect(assistantPrompt('plan', records, '2026-10-11')).not.toContain('T-0002');
  });
});
