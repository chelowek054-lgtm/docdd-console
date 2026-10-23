import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { actionFor, writeRoutes, type Action } from '../server/lib/permissions';

function walk(dir: string, base = ''): string[] {
  return readdirSync(join(dir, base), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(dir, join(base, entry.name)) : [join(base, entry.name)]);
}

/**
 * Матрица прав на всех пишущих маршрутах (T-0014, docs/adr/0020). Новый пишущий
 * маршрут без записи здесь роняет тест: право выбирают сознательно, а не получают
 * по умолчанию `edit_draft` молча.
 */
const EXPECTED: Record<string, Action> = {
  'POST /api/auth/login': 'edit_draft', // пропускается middleware до проверки права
  'POST /api/auth/logout': 'edit_draft', // пропускается middleware до проверки права
  'POST /api/auth/users': 'edit_draft', // middleware сам требует admin для /api/auth/users
  'POST /api/llm/ask': 'model',
  // Новые маршруты волны 2: право выбрано сознательно. alert — вебхук Grafana, закрыт токеном, права роли ему не нужны.
  'POST /api/llm/models/check': 'model',
  'PUT /api/llm/models': 'model',
  // Эмбеддинги поиска настраиваются как модели; индекс — производный кэш, пересобрать его вправе тот, кто правит черновики.
  'PUT /api/llm/embeddings': 'model',
  'POST /api/projects/x/search': 'edit_draft',
  'PUT /api/notifications/channel': 'admin',
  'POST /api/projects/x/analyst': 'edit_draft',
  'POST /api/projects/x/context': 'edit_draft',
  'POST /api/projects/x/inbox/alert': 'edit_draft',
  'POST /api/projects/x/inbox/external': 'edit_draft',
  'POST /api/projects/x/records/x/ask': 'edit_draft',
  'POST /api/projects/x/records/x/metric-run': 'edit_draft',
  'POST /api/projects/x/records/x/target': 'edit_draft',
  'POST /api/projects': 'admin',
  'POST /api/projects/git-init': 'admin',
  'POST /api/projects/init': 'admin',
  'DELETE /api/projects/x': 'admin',
  'DELETE /api/projects/x/llm/queue/x': 'edit_draft',
  'DELETE /api/projects/x/llm/feeds/x': 'edit_draft',
  'POST /api/projects/x/architecture': 'edit_draft',
  'POST /api/projects/x/design/findings/apply': 'edit_draft',
  'POST /api/projects/x/design/findings/preview': 'read',
  'POST /api/projects/x/design/port-prompt': 'edit_draft',
  'POST /api/projects/x/fix': 'work',
  'POST /api/projects/x/fix/work': 'work',
  'POST /api/projects/x/import': 'edit_draft',
  'POST /api/projects/x/inbox/accept': 'edit_draft',
  'POST /api/projects/x/inbox/notes': 'edit_draft',
  'POST /api/projects/x/inbox/preview': 'read',
  'POST /api/projects/x/inbox/records': 'edit_draft',
  'POST /api/projects/x/map/capability': 'edit_draft',
  'POST /api/projects/x/map/draft': 'edit_draft',
  'POST /api/projects/x/map/functional-check': 'edit_draft',
  'POST /api/projects/x/map/functional-relations': 'edit_draft',
  'POST /api/projects/x/map/inventory/rebuild': 'edit_draft',
  'POST /api/projects/x/maps/custom': 'edit_draft',
  'POST /api/projects/x/maps/custom/x/node': 'edit_draft',
  'POST /api/projects/x/notifications/read': 'edit_draft',
  'POST /api/projects/x/onboarding/run': 'edit_draft',
  'POST /api/projects/x/onboarding/wizard': 'edit_draft',
  'POST /api/projects/x/onboarding/tests': 'edit_draft',
  'POST /api/projects/x/sources/apply': 'edit_draft',
  'POST /api/projects/x/phases': 'reorder',
  'POST /api/projects/x/phases/preview': 'read',
  'POST /api/projects/x/priority/apply': 'reorder',
  'POST /api/projects/x/priority/preview': 'read',
  'POST /api/projects/x/progress-question': 'read', // единственный вопрос к модели у наблюдателя: без инструментов
  'POST /api/projects/x/prompt': 'model',
  'POST /api/projects/x/records/bulk/link-map': 'edit_draft',
  'POST /api/projects/x/records/bulk/status': 'approve',
  'POST /api/projects/x/records': 'edit_draft',
  'POST /api/projects/x/records/x/body': 'edit_draft',
  'POST /api/projects/x/records/x/diff/viewed': 'edit_draft',
  'POST /api/projects/x/records/x/discussion': 'edit_draft',
  'POST /api/projects/x/records/x/status': 'approve',
  'POST /api/projects/x/records/x/verified': 'approve',
  'POST /api/projects/x/records/x/work': 'work', // accept в теле — 'merge', см. отдельный тест
  'PATCH /api/projects/x/records/x': 'edit_draft',
  'POST /api/projects/x/reference/rebuild': 'edit_draft',
  'DELETE /api/projects/x/agents/x': 'team',
  'POST /api/projects/x/agents': 'team',
  'POST /api/projects/x/agents/defaults': 'team',
  'POST /api/projects/x/attachments': 'edit_draft',
  'POST /api/projects/x/runs': 'edit_draft',
  'PATCH /api/projects/x/shared': 'team'
};

describe('матрица прав: тест-обход пишущих маршрутов', () => {
  const routes = writeRoutes(walk(join(__dirname, '../server/api')));

  it('перечисляет маршруты из имён файлов', () => {
    expect(writeRoutes(['a/[id]/b.post.ts', 'a/[id]/index.patch.ts', 'a/c.get.ts']))
      .toEqual([{ method: 'POST', path: '/api/a/x/b' }, { method: 'PATCH', path: '/api/a/x' }]);
  });

  it('каждый пишущий маршрут есть в таблице и получает указанное право', () => {
    const seen: Record<string, Action> = {};
    for (const route of routes) seen[`${route.method} ${route.path}`] = actionFor(route.method, route.path);
    expect(seen).toEqual(EXPECTED);
  });
});
