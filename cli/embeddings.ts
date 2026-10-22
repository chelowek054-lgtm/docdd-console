import { ensureIndex } from '../server/utils/semantic-service';

/**
 * Досчитать индекс смыслового поиска без консоли — для CI и сервера после
 * обновления (docs/adr/0031-semantic-search.md). Без настроек моделей —
 * локальный хеш-эмбеддинг: сеть и ключи не нужны.
 */
const root = process.argv[2] ?? process.cwd();
const started = Date.now();
const state = await ensureIndex(root);
console.log(`Индекс смыслового поиска: ${state.blocks} блоков, модель ${state.model}, ${Date.now() - started} мс`);
