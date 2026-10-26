import { defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';

import { contentTypeOf, withSizeProbe, withTheme } from '../../../../../../lib/design-mockups';
import { OutsideRootError } from '../../../../../../lib/paths';
import { fail } from '../../../../../../utils/http';
import { readMockupFile } from '../../../../../../utils/mockups-service';
import { findProject } from '../../../../../../utils/projects';

/**
 * Файл HTML-макета (R-0106): только из каталога экрана. `sandbox` в заголовке — макет
 * изолирован и открытый напрямую: его скрипты не видят ни cookie, ни API консоли.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const screen = decodeURIComponent(getRouterParam(event, 'screen') ?? '');
  const path = decodeURIComponent(getRouterParam(event, 'path') ?? '');
  try {
    const file = readMockupFile(project.root, screen, path);
    if (!file) return fail(event, 404, 'mockup_file_not_found', `У экрана «${screen}» нет файла \`${path || 'index.html'}\``);
    setHeader(event, 'Content-Type', contentTypeOf(file.path));
    setHeader(event, 'Content-Security-Policy', 'sandbox allow-scripts');
    setHeader(event, 'X-Content-Type-Options', 'nosniff');
    // Главная страница макета сообщает холсту свой размер; тема — по запросу.
    if (/(^|\/)index\.html?$/i.test(file.path)) {
      const theme = getQuery(event)['theme'];
      const html = file.data.toString('utf8');
      const themed = typeof theme === 'string' && theme ? withTheme(html, theme, getQuery(event)['dark'] === '1') : html;
      return withSizeProbe(themed, screen);
    }
    return file.data;
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'mockup_failed', 'Не удалось отдать файл макета', String(error));
  }
});
