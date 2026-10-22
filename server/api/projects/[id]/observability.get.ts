import { defineEventHandler, getRouterParam } from 'h3';

import { readManifest } from '../../../lib/workspace';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/**
 * Метрики продукта для обзора (docs/04-ui.md, «Наблюдаемость»). Сервер сам
 * ходит в Prometheus по запросам из манифеста: браузер туда не ходит, адрес и
 * сеть Prometheus наружу не видны. Каждый запрос — с таймаутом: недоступный
 * Prometheus не держит страницу.
 */

interface Metric { id: string; label: string; unit: string; value: number | null; warn: number | null; error?: string }

const TIMEOUT_MS = 3000;

async function query(url: string, expression: string): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/api/v1/query?query=${encodeURIComponent(expression)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { status?: string; data?: { result?: { value?: [number, string] }[] } };
    const raw = body.data?.result?.[0]?.value?.[1];
    const value = raw === undefined ? Number.NaN : Number(raw);
    if (body.status !== 'success' || Number.isNaN(value)) throw new Error('пустой ответ');
    return value;
  } finally {
    clearTimeout(timer);
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  let config: ReturnType<typeof readManifest>['observability'];
  try {
    config = readManifest(project.root).observability;
  } catch {
    config = undefined;
  }
  const url = config?.url || process.env['DOCDD_PROMETHEUS_URL'] || '';
  const queries = config?.queries ?? [];
  if (!url || !queries.length) {
    return { configured: false, dashboard: config?.dashboard ?? null, metrics: [] as Metric[] };
  }

  const metrics = await Promise.all(queries.map(async (item): Promise<Metric> => {
    const base = { id: item.id, label: item.label, unit: item.unit ?? '', warn: typeof item.warn === 'number' ? item.warn : null };
    try {
      return { ...base, value: await query(url, item.query) };
    } catch (error) {
      return { ...base, value: null, error: error instanceof Error && error.name === 'AbortError' ? 'нет ответа' : String((error as Error).message ?? error) };
    }
  }));
  return { configured: true, dashboard: config?.dashboard ?? null, metrics };
});
