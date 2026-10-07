# Справочник проекта

Сгенерировано приложением, не править: источник — справки (S-…) и подтверждённая карта кода (docs/13-reference.md).

## Модули проекта
Что уже написано. Прежде чем заводить новое — посмотри, нет ли такого.

### app/composables
- `app/composables/useProjectIndex.ts` — описания нет
- `app/composables/useModelRequest.ts` — описания нет
### app/utils
- `app/utils/map-mermaid.ts` — Перевод карт в текст mermaid вместе с данными для карточки, подсказок, соседей, порядком узлов mindmap и pending.
- `app/utils/highlight.ts` — описания нет
### server/lib
- `server/lib/types.ts` — описания нет
- `server/lib/maps.ts` — Разбор блоков карт, сверка свидетельств, свод подтверждённых карт в общую картину и пометка pending у ещё не устоявшихся.
- `server/lib/import.ts` — описания нет
- `server/lib/inbox.ts` — описания нет
- `server/lib/workspace.ts` — описания нет
- `server/lib/actions.ts` — описания нет
- `server/lib/analyze.ts` — описания нет
- `server/lib/cache.ts` — описания нет
- `server/lib/indexer.ts` — описания нет
- `server/lib/inventory.ts` — описания нет
- `server/lib/parse.ts` — описания нет
- `server/lib/paths.ts` — описания нет
- `server/lib/scaffold.ts` — описания нет
- `server/lib/schema.ts` — описания нет
- `server/lib/write.ts` — описания нет
- `server/lib/branch.ts` — описания нет
- `server/lib/diagrams.ts` — описания нет
- `server/lib/manifest-write.ts` — описания нет
- `server/lib/map-schemas.ts` — описания нет
- `server/lib/prompt.ts` — Чистые функции сборки запросов к модели: подставляют данные проекта в шаблоны, включая дерево возможностей для проверки по коду.
- `server/lib/rules.ts` — описания нет
- `server/lib/shared.ts` — описания нет
- `server/lib/stream-events.ts` — описания нет
- `server/lib/transitions.ts` — описания нет
### server/utils
- `server/utils/fix-service.ts` — описания нет
- `server/utils/inbox-service.ts` — описания нет
- `server/utils/shared-service.ts` — описания нет
- `server/utils/work-service.ts` — описания нет
- `server/utils/abort.ts` — описания нет
- `server/utils/chosen.ts` — описания нет
- `server/utils/http.ts` — описания нет
- `server/utils/index-service.ts` — описания нет
- `server/utils/inventory-service.ts` — описания нет
- `server/utils/llm.ts` — Запуск Claude Code для запросов к модели, потоковый разбор событий и отмена.
- `server/utils/map-service.ts` — Общая картина проекта: сложенные подтверждённые карты, статус свидетельств по рёбрам, pending-разметка и счётчик unverified.
- `server/utils/projects.ts` — описания нет
- `server/utils/record-write.ts` — описания нет
- `server/utils/sse.ts` — описания нет

## Внешние решения
Пока ничего.

## Приёмы и данные
Пока ничего.
