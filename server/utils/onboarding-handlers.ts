import { registerStep } from './onboarding-steps';
import { detectProjectSources } from './source-scan';
import { createTestChecks, scanTests } from './test-checks-service';

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

// Проверки из существующих тестов (R-0079): сопоставленные тесты становятся проверками-черновиками.
registerStep('checks', (root) => {
  const outcome = createTestChecks(root);
  if (!outcome.ok) return { ok: false, created: 0, summary: outcome.message };
  const report = scanTests(root);
  const unmatched = report.matches.filter((item) => !item.requirement).length;
  return {
    ok: true,
    created: outcome.created,
    summary: outcome.created > 0
      ? `заведено проверок-черновиков: ${outcome.created}${unmatched ? `; тестов без требования: ${unmatched}` : ''}`
      : report.found === 0 ? 'тестовых файлов не найдено' : `новых проверок нет${unmatched ? `; тестов без требования: ${unmatched}` : ''}`
  };
});
