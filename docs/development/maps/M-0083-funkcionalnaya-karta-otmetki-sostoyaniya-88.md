---
id: M-0083
type: map
title: 'Функциональная карта: отметки состояния (88)'
status: draft
created: 2026-10-24
updated: 2026-10-24
---

# Функциональная карта: отметки состояния (88)

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками
то, что модель не поняла, и подтвердите — до этого карта на общую картину
не влияет.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "maps.functional.fill",
        "title": "Наполнение: связи пачкой, предложение связей, разбор входящего со связями",
        "parent": "maps.functional",
        "status": "implemented",
        "note": "По фактам: задачи T-0165 закрыты; проверки — пройдены: V-0107",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.functional.kinds",
        "title": "Пять видов связей, приоритет и горизонт",
        "parent": "maps.functional",
        "status": "implemented",
        "note": "По фактам: задачи T-0165 закрыты; проверки — пройдены: V-0107",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.functional.coverage",
        "title": "Покрытие процессом: требования, задачи и проверки за отметкой",
        "parent": "maps.functional",
        "status": "implemented",
        "note": "По фактам: задачи T-0165 закрыты; проверки — пройдены: V-0107",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "maps.functional.consistency",
        "title": "Предупреждения о расхождении отметки с задачами и проверками",
        "parent": "maps.functional",
        "status": "implemented",
        "note": "По фактам: задачи T-0165 закрыты; проверки — пройдены: V-0107",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "maps.functional.levels",
        "title": "Уровни и режимы графа: обзор, группа, покрытие, риски, порядок, влияние",
        "parent": "maps.functional",
        "status": "implemented",
        "note": "По фактам: задачи T-0165 закрыты; проверки — пройдены: V-0107",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "security.mode",
        "title": "Режим общего сервера: опасное выключено, пока нет прав",
        "parent": "security",
        "status": "implemented",
        "note": "По фактам: задачи T-0007, T-0008, T-0009, T-0010, T-0011 закрыты; проверки — пройдены: V-0003, V-0004, V-0020",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "security.roots",
        "title": "Проекты только из разрешённых каталогов",
        "parent": "security",
        "status": "implemented",
        "note": "По фактам: задачи T-0007, T-0008, T-0009, T-0010, T-0011 закрыты; проверки — пройдены: V-0003, V-0004, V-0020",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "security.sandbox",
        "title": "Модель на сервере не выходит за проект",
        "parent": "security",
        "status": "implemented",
        "note": "По фактам: задачи T-0007, T-0008, T-0009, T-0010, T-0011 закрыты; проверки — пройдены: V-0003, V-0004, V-0020",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.providers",
        "title": "Один интерфейс для многих провайдеров",
        "parent": "llm",
        "status": "implemented",
        "note": "По фактам: задачи T-0019, T-0020, T-0021, T-0022, T-0023, T-0024, T-0025, T-0026 закрыты; проверки — пройдены: V-0008, V-0009, V-0010",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.api",
        "title": "Модели по API: OpenAI-совместимые и Anthropic",
        "parent": "llm",
        "status": "implemented",
        "note": "По фактам: задачи T-0019, T-0020, T-0021, T-0022, T-0023, T-0024, T-0025, T-0026 закрыты; проверки — пройдены: V-0008, V-0009, V-0010",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.settings",
        "title": "Настройки моделей у администратора, ключи вне репозитория",
        "parent": "llm",
        "status": "implemented",
        "note": "По фактам: задачи T-0019, T-0020, T-0021, T-0022, T-0023, T-0024, T-0025, T-0026 закрыты; проверки — пройдены: V-0008, V-0009, V-0010",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.routing",
        "title": "Какой запрос какой моделью",
        "parent": "llm",
        "status": "implemented",
        "note": "По фактам: задачи T-0019, T-0020, T-0021, T-0022, T-0023, T-0024, T-0025, T-0026 закрыты; проверки — пройдены: V-0008, V-0009, V-0010",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.usage",
        "title": "Учёт запросов: кто, какая модель, сколько стоило",
        "parent": "llm",
        "status": "implemented",
        "note": "По фактам: задачи T-0019, T-0020, T-0021, T-0022, T-0023, T-0024, T-0025, T-0026 закрыты; проверки — пройдены: V-0008, V-0009, V-0010",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "llm.queue",
        "title": "Очередь запросов на сервере, видная команде",
        "parent": "llm",
        "status": "implemented",
        "note": "По фактам: задачи T-0019, T-0020, T-0021, T-0022, T-0023, T-0024, T-0025, T-0026 закрыты; проверки — пройдены: V-0008, V-0009, V-0010",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "context.pack",
        "title": "Пакет контекста из графа записей",
        "parent": "context",
        "status": "implemented",
        "note": "По фактам: задачи T-0027, T-0028, T-0029, T-0030, T-0031 закрыты; проверки — пройдены: V-0011, V-0012",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "context.preview",
        "title": "«Что уйдёт модели» перед отправкой",
        "parent": "context",
        "status": "implemented",
        "note": "По фактам: задачи T-0027, T-0028, T-0029, T-0030, T-0031 закрыты; проверки — пройдены: V-0011, V-0012",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "context.roles",
        "title": "Запросы к модели по ролям",
        "parent": "context",
        "status": "implemented",
        "note": "По фактам: задачи T-0027, T-0028, T-0029, T-0030, T-0031 закрыты; проверки — пройдены: V-0011, V-0012",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "context.ask",
        "title": "Вопрос модели из любой записи",
        "parent": "context",
        "status": "implemented",
        "note": "По фактам: задачи T-0027, T-0028, T-0029, T-0030, T-0031 закрыты; проверки — пройдены: V-0011, V-0012",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "context.migrate",
        "title": "Прежние запросы — на пакет контекста",
        "parent": "context",
        "status": "implemented",
        "note": "По фактам: задачи T-0027, T-0028, T-0029, T-0030, T-0031 закрыты; проверки — пройдены: V-0011, V-0012",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "pm.board",
        "title": "Доска задач по статусам",
        "parent": "pm",
        "status": "implemented",
        "note": "По фактам: задачи T-0032, T-0033, T-0034, T-0035, T-0036 закрыты; проверки — пройдены: V-0013, V-0014",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "pm.roadmap",
        "title": "Дорожная карта фаз",
        "parent": "pm",
        "status": "implemented",
        "note": "По фактам: задачи T-0032, T-0033, T-0034, T-0035, T-0036 закрыты; проверки — пройдены: V-0013, V-0014",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "pm.milestones",
        "title": "Вехи: целевая дата фазы и отклонение",
        "parent": "pm",
        "status": "implemented",
        "note": "По фактам: задачи T-0032, T-0033, T-0034, T-0035, T-0036 закрыты; проверки — пройдены: V-0013, V-0014",
        "priority": "could",
        "horizon": "next"
      },
      {
        "id": "pm.report",
        "title": "Сводка для заказчика",
        "parent": "pm",
        "status": "implemented",
        "note": "По фактам: задачи T-0032, T-0033, T-0034, T-0035, T-0036 закрыты; проверки — пройдены: V-0013, V-0014",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "pm.assistant",
        "title": "Помощник менеджера",
        "parent": "pm",
        "status": "implemented",
        "note": "По фактам: задачи T-0032, T-0033, T-0034, T-0035, T-0036 закрыты; проверки — пройдены: V-0013, V-0014",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "analyst.requirements",
        "title": "Требования с критериями приёмки",
        "parent": "analyst",
        "status": "implemented",
        "note": "По фактам: задачи T-0037, T-0038, T-0039, T-0040, T-0041 закрыты; проверки — пройдены: V-0015, V-0016",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "analyst.assistant",
        "title": "Помощник аналитика",
        "parent": "analyst",
        "status": "implemented",
        "note": "По фактам: задачи T-0037, T-0038, T-0039, T-0040, T-0041 закрыты; проверки — пройдены: V-0015, V-0016",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "knowledge.space",
        "title": "Пространство знаний: дерево страниц",
        "parent": "knowledge",
        "status": "implemented",
        "note": "По фактам: задачи T-0037, T-0038, T-0039, T-0040, T-0041 закрыты; проверки — пройдены: V-0015, V-0016",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "knowledge.search",
        "title": "Поиск по всему проекту",
        "parent": "knowledge",
        "status": "implemented",
        "note": "По фактам: задачи T-0037, T-0038, T-0039, T-0040, T-0041 закрыты; проверки — пройдены: V-0015, V-0016",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "knowledge.glossary",
        "title": "Глоссарий проекта",
        "parent": "knowledge",
        "status": "implemented",
        "note": "По фактам: задачи T-0037, T-0038, T-0039, T-0040, T-0041 закрыты; проверки — пройдены: V-0015, V-0016",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "scale.portfolio",
        "title": "Портфель проектов",
        "parent": "scale",
        "status": "implemented",
        "note": "По фактам: задачи T-0042, T-0043, T-0044, T-0045, T-0046, T-0154 закрыты; проверки — пройдены: V-0017, V-0018, V-0090",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "scale.zones",
        "title": "Зоны ответственности: владелец возможности и фазы",
        "parent": "scale",
        "status": "implemented",
        "note": "По фактам: задачи T-0042, T-0043, T-0044, T-0045, T-0046, T-0154 закрыты; проверки — пройдены: V-0017, V-0018, V-0090",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "scale.performance",
        "title": "Большие проекты без тормозов",
        "parent": "scale",
        "status": "implemented",
        "note": "По фактам: задачи T-0042, T-0043, T-0044, T-0045, T-0046, T-0154 закрыты; проверки — пройдены: V-0017, V-0018, V-0090",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "migration.jira",
        "title": "Импорт задач из Jira",
        "parent": "migration",
        "status": "implemented",
        "note": "По фактам: задачи T-0047, T-0048 закрыты; проверки — пройдены: V-0019",
        "priority": "could",
        "horizon": "later"
      },
      {
        "id": "migration.confluence",
        "title": "Импорт страниц Confluence",
        "parent": "migration",
        "status": "implemented",
        "note": "По фактам: задачи T-0047, T-0048 закрыты; проверки — пройдены: V-0019",
        "priority": "could",
        "horizon": "later"
      },
      {
        "id": "design.tokens",
        "title": "Токены в общем источнике и сложение «общее → локальное»",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0060, T-0061, T-0062, T-0063, T-0064, T-0065, T-0066, T-0067, T-0068, T-0069, T-0090 закрыты; проверки — пройдены: V-0030, V-0031, V-0032, V-0033",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.checks",
        "title": "Проверка токенов: контраст, обе темы, полнота шкал, конфликт",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0060, T-0061, T-0062, T-0063, T-0064, T-0065, T-0066, T-0067, T-0068, T-0069, T-0090 закрыты; проверки — пройдены: V-0030, V-0031, V-0032, V-0033",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.screen",
        "title": "Экран «Дизайн»: палитра обеих тем, шкалы, реестр компонентов",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0060, T-0061, T-0062, T-0063, T-0064, T-0065, T-0066, T-0067, T-0068, T-0069, T-0090 закрыты; проверки — пройдены: V-0030, V-0031, V-0032, V-0033",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.export",
        "title": "Выгрузка токенов в Nuxt UI, Expo, Compose, SwiftUI",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0060, T-0061, T-0062, T-0063, T-0064, T-0065, T-0066, T-0067, T-0068, T-0069, T-0090 закрыты; проверки — пройдены: V-0030, V-0031, V-0032, V-0033",
        "priority": "should",
        "horizon": "now"
      },
      {
        "id": "design.drift",
        "title": "Сверка файла темы и компонентов проекта с токенами",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0060, T-0061, T-0062, T-0063, T-0064, T-0065, T-0066, T-0067, T-0068, T-0069, T-0090 закрыты; проверки — пройдены: V-0030, V-0031, V-0032, V-0033",
        "priority": "should",
        "horizon": "now"
      },
      {
        "id": "design.screens",
        "title": "Проверка экранов моделью: Responsive и Pixel-Perfect",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0060, T-0061, T-0062, T-0063, T-0064, T-0065, T-0066, T-0067, T-0068, T-0069, T-0090 закрыты; проверки — пройдены: V-0030, V-0031, V-0032, V-0033",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.self",
        "title": "Консоль принимает собственные токены: rem, сетка, темы, i18n",
        "parent": "design",
        "status": "implemented",
        "note": "По фактам: задачи T-0077, T-0083 закрыты; проверки — пройдены: V-0035",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "work.manual-accept",
        "title": "Принять вручную: ручная проверка с записью, кто проверил и что проверено",
        "summary": "Задачу с ручной проверкой можно закрыть из блокировки: окно просит роль, имя проверившего и что проверено, ставит отметку «Проверено» с записью в отчёт и журнал и повторяет перевод.",
        "status": "implemented",
        "note": "По фактам: задачи T-0108, T-0109 закрыты; проверки — пройдены: V-0044, V-0045",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.map-tree",
        "title": "Функциональная карта без кнопок на каждой строке",
        "parent": "perf.client",
        "status": "implemented",
        "note": "По фактам: задачи T-0111, T-0112, T-0113, T-0114, T-0115, T-0116 закрыты; проверки — пройдены: V-0047, V-0048, V-0049, V-0050, V-0051, V-0052",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.map-payload",
        "title": "Страница карт грузит только открытую вкладку",
        "parent": "perf.client",
        "status": "implemented",
        "note": "По фактам: задачи T-0111, T-0112, T-0113, T-0114, T-0115, T-0116 закрыты; проверки — пройдены: V-0047, V-0048, V-0049, V-0050, V-0051, V-0052",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.lists",
        "title": "Лёгкие строки списков задач, требований, фаз и проверок",
        "parent": "perf.client",
        "status": "implemented",
        "note": "По фактам: задачи T-0111, T-0112, T-0113, T-0114, T-0115, T-0116 закрыты; проверки — пройдены: V-0047, V-0048, V-0049, V-0050, V-0051, V-0052",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.index-payload",
        "title": "Индекс проекта не встраивается целиком в каждую страницу",
        "parent": "perf.client",
        "status": "implemented",
        "note": "По фактам: задачи T-0111, T-0112, T-0113, T-0114, T-0115, T-0116 закрыты; проверки — пройдены: V-0047, V-0048, V-0049, V-0050, V-0051, V-0052",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.budget",
        "title": "Бюджет скорости страниц — проверка-метрика",
        "parent": "perf.client",
        "status": "implemented",
        "note": "По фактам: задачи T-0111, T-0112, T-0113, T-0114, T-0115, T-0116 закрыты; проверки — пройдены: V-0047, V-0048, V-0049, V-0050, V-0051, V-0052",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.prod-run",
        "title": "Ежедневный запуск консоли на собранной версии",
        "parent": "perf.client",
        "status": "implemented",
        "note": "По фактам: задачи T-0111, T-0112, T-0113, T-0114, T-0115, T-0116 закрыты; проверки — пройдены: V-0047, V-0048, V-0049, V-0050, V-0051, V-0052",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "design.catalog.contract",
        "title": "Контракт компонента: варианты, состояния, свойства, слоты, события; базовые и составные",
        "parent": "design.catalog",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.catalog.storybook",
        "title": "Storybook проекта — эталон: чтение каталога историй в реестр",
        "parent": "design.catalog",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.catalog.parity",
        "title": "Сверка переноса на стеки: Storybook RN, Compose, SwiftUI",
        "parent": "design.catalog",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "design.catalog.snapshots",
        "title": "Снимки историй — эталон Pixel-Perfect и визуальных регрессий",
        "parent": "design.catalog",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "design.catalog.port",
        "title": "Перенос компонента на стек моделью по контракту",
        "parent": "design.catalog",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.team-roles",
        "title": "Роли дизайнера, тестировщика, девопса и сопровождения",
        "parent": "access",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "collab.notify",
        "title": "Уведомления команды",
        "parent": "collab",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "collab.comments",
        "title": "Обсуждение у записи",
        "parent": "collab",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa.cases",
        "title": "Шаги и ожидаемый результат в проверке",
        "parent": "qa",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa.runs",
        "title": "Прогон набора проверок на сборку или релиз",
        "parent": "qa",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa.defects",
        "title": "Запись о дефекте",
        "parent": "qa",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "ops.releases",
        "title": "Релизы и окружения",
        "parent": "ops",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "ops.grafana",
        "title": "Grafana: метрики процесса, алерты во входящее, ссылки на панели",
        "parent": "ops",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "ops.metric-checks",
        "title": "Проверка-метрика по запросу Prometheus",
        "parent": "ops",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "self.facts",
        "title": "Состояния карты и проверки соответствуют сделанному",
        "parent": "self",
        "status": "implemented",
        "note": "По фактам: задачи T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 закрыты; проверки — пройдены: V-0053, V-0054, V-0055, V-0056, V-0057, V-0058, V-0059, V-0060, V-0061, V-0062, V-0063, V-0064, V-0065, V-0066, V-0067",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.core",
        "title": "Общий механизм разницы: маршрут «что меняется» и компонент над записью",
        "parent": "records.diff",
        "status": "implemented",
        "note": "По фактам: задачи T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 закрыты; проверки — пройдены: V-0068, V-0069, V-0070, V-0071, V-0072, V-0073",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.maps",
        "title": "Разница карты на самой схеме на всех уровнях вложенности",
        "parent": "records.diff",
        "status": "implemented",
        "note": "По фактам: задачи T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 закрыты; проверки — пройдены: V-0068, V-0069, V-0070, V-0071, V-0072, V-0073",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.vision",
        "title": "Разница вектора проекта по полям",
        "parent": "records.diff",
        "status": "implemented",
        "note": "По фактам: задачи T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 закрыты; проверки — пройдены: V-0068, V-0069, V-0070, V-0071, V-0072, V-0073",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.text",
        "title": "Разница текста, полей и связей документа или задачи",
        "parent": "records.diff",
        "status": "implemented",
        "note": "По фактам: задачи T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 закрыты; проверки — пройдены: V-0068, V-0069, V-0070, V-0071, V-0072, V-0073",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.previews",
        "title": "Предпросмотры порядка, фаз и починки — в виде «было → станет»",
        "parent": "records.diff",
        "status": "implemented",
        "note": "По фактам: задачи T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 закрыты; проверки — пройдены: V-0068, V-0069, V-0070, V-0071, V-0072, V-0073",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.design",
        "title": "Разница токенов дизайна: палитра, контраст, файлы выгрузки",
        "parent": "records.diff",
        "status": "implemented",
        "note": "По фактам: задачи T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 закрыты; проверки — пройдены: V-0068, V-0069, V-0070, V-0071, V-0072, V-0073",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.onboarding.wizard",
        "title": "Чек-лист «Готовность проекта» и запуск подключения",
        "parent": "projects.onboarding",
        "status": "implemented",
        "note": "По фактам: задачи T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0158 закрыты; проверки — пройдены: V-0101, V-0103, V-0102, V-0104, V-0105, V-0106, V-0094",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.onboarding.fresh",
        "title": "Сценарий нового проекта: вектор, возможности, требования, глоссарий",
        "parent": "projects.onboarding",
        "status": "implemented",
        "note": "По фактам: задачи T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0158 закрыты; проверки — пройдены: V-0101, V-0103, V-0102, V-0104, V-0105, V-0106, V-0094",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.onboarding.detect",
        "title": "Автопоиск источников и указание папок с экрана",
        "parent": "projects.onboarding",
        "status": "implemented",
        "note": "По фактам: задачи T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0158 закрыты; проверки — пройдены: V-0101, V-0103, V-0102, V-0104, V-0105, V-0106, V-0094",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.onboarding.as-is",
        "title": "Функциональная карта и требования «как есть» для готовой кодовой базы",
        "parent": "projects.onboarding",
        "status": "implemented",
        "note": "По фактам: задачи T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0158 закрыты; проверки — пройдены: V-0101, V-0103, V-0102, V-0104, V-0105, V-0106, V-0094",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.onboarding.tests",
        "title": "Проверки из существующих тестов и отчёт сборки",
        "parent": "projects.onboarding",
        "status": "implemented",
        "note": "По фактам: задачи T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0158 закрыты; проверки — пройдены: V-0101, V-0103, V-0102, V-0104, V-0105, V-0106, V-0094",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.onboarding.contracts",
        "title": "Контракты, справки и глоссарий из кода и документации",
        "parent": "projects.onboarding",
        "status": "implemented",
        "note": "По фактам: задачи T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0158 закрыты; проверки — пройдены: V-0101, V-0103, V-0102, V-0104, V-0105, V-0106, V-0094",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.strategy",
        "title": "Стратегический уровень — вид верхнего уровня функциональной карты",
        "parent": "maps",
        "summary": "Контуры проекта (возможности первого уровня) со здоровьем; владелец — руководитель проекта; клик проваливает в поддерево или связанную карту.",
        "status": "implemented",
        "note": "По фактам: задачи T-0148 закрыты; проверки — пройдены: V-0084",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.health",
        "title": "Здоровье узла карты из четырёх сигналов",
        "parent": "maps",
        "summary": "Прогресс, сроки, качество, нарушения — вычисляется, сворачивается снизу вверх; без бюджета и ручного светофора.",
        "status": "implemented",
        "note": "По фактам: задачи T-0149 закрыты; проверки — пройдены: V-0085",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.cross-links",
        "title": "Связи между картами: узел ссылается на узлы других карт",
        "parent": "maps",
        "summary": "Возможность ссылается на модули, пути, узлы своих карт; обратная сторона видна; висящая ссылка — нарушение.",
        "status": "implemented",
        "note": "По фактам: задачи T-0150 закрыты; проверки — пройдены: V-0086",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.role-maps",
        "title": "Карты по ролям: дизайнер, DevOps, архитектор, разработчик",
        "parent": "maps",
        "summary": "Заготовки своих карт под цели ролей на механизме ADR-0028.",
        "status": "implemented",
        "note": "По фактам: задачи T-0151 закрыты; проверки — пройдены: V-0087",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.block-contract",
        "title": "Контракт блока: входы и выходы узла",
        "parent": "maps",
        "summary": "Узел объявляет, что принимает и что выдаёт; неподтверждённые входы видны.",
        "status": "implemented",
        "note": "По фактам: задачи T-0152 закрыты; проверки — пройдены: V-0088",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.xray",
        "title": "Сквозные связи через уровни и режим «Рентген»",
        "parent": "maps",
        "summary": "Связи между узлами разной глубины скрыты по умолчанию и подсвечиваются при выборе узла.",
        "status": "implemented",
        "note": "По фактам: задачи T-0153 закрыты; проверки — пройдены: V-0089",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "inbox.batch-check",
        "title": "Обсуждение функции ролями и сверка пачки",
        "parent": "inbox",
        "summary": "Заметки с меткой роли по функции; одна сверка требований, задач и проверок перед ready.",
        "status": "implemented",
        "note": "По фактам: задачи T-0156 закрыты; проверки — пройдены: V-0092",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.token-economy",
        "title": "Экономия токенов: фактический учёт, кэш постоянной части, лимит на задачу",
        "parent": "llm",
        "summary": "Расход по токенам провайдера, постоянная часть запроса первой, дешёвая модель для разбора, лимит агента.",
        "status": "implemented",
        "note": "По фактам: задачи T-0157 закрыты; проверки — пройдены: V-0093",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.history",
        "title": "История курса отдельно от живых карт",
        "parent": "maps",
        "summary": "Смены курса — журналом; экран «Карты» показывает живые карты отдельно.",
        "status": "implemented",
        "note": "По фактам: задачи T-0159 закрыты; проверки — пройдены: V-0095",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "self.vision",
        "title": "Границы продукта в векторе",
        "parent": "self",
        "summary": "Чего консоль не делает — записано в векторе проекта.",
        "status": "implemented",
        "note": "По фактам: задачи T-0160 закрыты; проверки — пройдены: V-0096",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.assignee",
        "title": "Исполнитель проверки и фильтр «Мои»",
        "parent": "qa",
        "summary": "Проверку берут на себя; на «Сверке» — «Мои» и «Без исполнителя».",
        "status": "implemented",
        "note": "По фактам: задачи T-0161 закрыты; проверки — пройдены: V-0097",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.blocked",
        "title": "Итог прогона «заблокирована» с причиной",
        "parent": "qa",
        "summary": "Не могу проверить, мешает X — виден на Сверке, в здоровье — внимание.",
        "status": "implemented",
        "note": "По фактам: задачи T-0162 закрыты; проверки — пройдены: V-0098",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.attachments",
        "title": "Вложения к прогону и дефекту",
        "parent": "qa",
        "summary": "Скриншоты и логи файлами в репозитории проекта рядом с отчётами.",
        "status": "implemented",
        "note": "По фактам: задачи T-0163 закрыты; проверки — пройдены: V-0099",
        "priority": "must",
        "horizon": "now"
      }
    ]
  }
}
```

## Журнал

- 2026-10-24 · заведена черновиком · модель
