import { registerStep } from './onboarding-steps';
import { detectProjectSources } from './source-scan';

/**
 * Обработчики автоматических шагов подключения (R-0075). Каждая задача подключения
 * регистрирует свой: автопоиск источников, проверки из тестов, контракты и справки.
 */

// Источники: приложение находит, человек подтверждает и записывает в project.yaml (R-0077).
registerStep('sources', (root) => {
  const found = detectProjectSources(root);
  const fresh = found.fresh.length;
  return {
    ok: true,
    created: 0,
    summary: fresh > 0
      ? `найдено папок: ${fresh} — подтвердите их на этой вкладке, и они запишутся в project.yaml`
      : found.folders.length > 0 ? 'все найденные папки уже названы в project.yaml' : 'источников не найдено: укажите папки вручную'
  };
});
