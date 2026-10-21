import { defineEventHandler, getQuery } from 'h3';

import { summarize } from '../../lib/llm-usage';
import { readUsage } from '../../utils/llm-usage-store';

/** Сводка расходов за месяц (`?month=YYYY-MM`, по умолчанию текущий) по людям и моделям; `?projectId=` — один проект. Суммы — оценка по символам. */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const month = typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month) ? query.month : new Date().toISOString().slice(0, 7);
  const projectId = typeof query.projectId === 'string' && query.projectId !== '' ? query.projectId : undefined;
  return summarize(readUsage(), month, projectId);
});
