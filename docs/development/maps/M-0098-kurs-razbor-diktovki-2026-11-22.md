---
id: M-0098
type: map
title: 'Курс после разбора диктовки 2026-11-22: работа через LLM, четыре обязательные карты, тестеры, харнесс'
status: approved
created: 2026-11-23
updated: 2026-11-23
---

# Курс после разбора диктовки 2026-11-22: работа через LLM, четыре обязательные карты, тестеры, харнесс

Смена курса по замечаниям chelowek (docs/inbox/принятое/zamechaniya-2026-11-22.md) и разбору. Вектор не меняется. Добавлены возможности циклов Ц1–Ц7, убран помощник аналитика (п. 6.1). Прежние черновики M-0095, M-0096, M-0097 выведены из суммы.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "mcp.confirm",
        "title": "Подтверждение моделью после вопроса человеку",
        "parent": "mcp",
        "summary": "Модель подтверждает записи, принимает и закрывает задачи, принимает ручные проверки — только после явного вопроса человеку и его ответа. Вопрос и ответ — в журнале.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "mcp.local-write",
        "title": "Запись через MCP без входа на localhost",
        "parent": "mcp",
        "summary": "Личный режим: консоль слушает localhost — MCP пишет без входа. На общем сервере — только со входом и токеном агента.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "work.manual-accept.visible",
        "title": "Приём вручную виден заранее",
        "parent": "work.manual-accept",
        "summary": "Кнопка «Принять вручную» стоит на задаче «на проверке» сразу. Задача без проверок принимается через ручную проверку, заведённую в том же окне.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.inbox",
        "title": "Входящие тестера",
        "parent": "qa",
        "summary": "Отчёт прохода текстом — с экрана или через LLM: что прошёл, что получилось, что не так.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.regression",
        "title": "Регрессионный прогон",
        "parent": "qa",
        "summary": "Лид нарезает проверки между тестерами, каждый отмечает итог; непрошедшее становится дефектом.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.urgent",
        "title": "Срочный дефект с прода",
        "parent": "qa",
        "summary": "Пометка «срочно», колокольчик лиду и разработчику, задача починки через человека.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "qa.ux",
        "title": "Сверка глазами тестера",
        "parent": "qa",
        "summary": "Раздел «Сверка» проверен и переделан под тестеров; аналитика и менеджер проверены на нескольких пользователях.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.base",
        "title": "Базовая карта и обязательные шаблоны",
        "parent": "maps",
        "summary": "Все карты — одна сущность: базовая карта с подключаемыми возможностями. Обязательны четыре: стратегическая, доменная, System Design, кодовая база. Граф — основной вид.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.lint",
        "title": "Линтер карт",
        "parent": "maps",
        "summary": "Любое изменение карты проверяется на структуру; ошибка называет узел, поле и строку.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.mcp-edit",
        "title": "Правка карт через MCP",
        "parent": "maps",
        "summary": "Модель создаёт и правит карты инструментами MCP через тот же линтер.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.notation",
        "title": "Стандарт обозначений",
        "parent": "maps",
        "summary": "У каждого типа карты свой стандарт по образцу UML и C4: цвет и форма узлов и связей, «туда-обратно», подписи. Цветовые группы: DDD, слои, DevOps, интерфейс, внешнее.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.editor",
        "title": "Редактор карт мышью",
        "parent": "maps",
        "summary": "Как блюпринты: меню по правой кнопке, порты, соединение, перетаскивание, мини-карта. Vue Flow и elkjs, округлый вид.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.navigation",
        "title": "Провал в узел",
        "parent": "maps",
        "summary": "Двойной щелчок или «Открыть группу»; внутри внешние узлы полупрозрачные по краю, на связях подписаны данные; хлебные крошки.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.records-ux",
        "title": "Записи карт без поиска",
        "parent": "maps",
        "summary": "Ждущие подтверждения наверху с подтверждением из списка; подтверждённые, вне суммы и история курса — в свёрнутом архиве.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.strategic",
        "title": "Стратегическая карта: куда",
        "parent": "maps",
        "summary": "Обязательные параметры узлов и связей, полный ручной контроль, короткая форма «откуда, куда, зачем» для маленького проекта.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.domain",
        "title": "Доменная карта: почему",
        "parent": "maps",
        "summary": "Понятия и словарь области, её законы и ограничения, процессы, источники знания. DDD-контексты — необязательный слой.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.codebase",
        "title": "Кодовая база: что есть",
        "parent": "maps",
        "summary": "Слепок нынешнего состояния: опись внутри шаблона, назначение узлов, внешние связи групп, пороги деления, подсветка несостыковок.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.sysdesign",
        "title": "System Design: как",
        "parent": "maps",
        "summary": "Спроектированная система: модули, входы и выходы, форматы, технологии, стандарты; шаблон для типового, подробности для узких мест.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.sd-reconcile",
        "title": "Сверка System Design с кодовой базой",
        "parent": "maps",
        "summary": "По кнопке: модуль без кода, код вне проекта системы, незаявленная зависимость, расхождение входов и выходов.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.ml",
        "title": "ML и R&D: конвейер и карта развилок",
        "parent": "maps",
        "summary": "Профиль ML для System Design и кодовой базы; карта развилок «гипотеза → эксперимент → цифры → решение»; метрики этапов из отчётов прогонов.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "maps.domains-basic",
        "title": "Шаблоны направлений: геймдев и embedded",
        "parent": "maps",
        "summary": "Базовые шаблоны без глубины: дизайн-документ игры; блоки железа, шины, прошивка, радиомодули.",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "maps.code-assistant",
        "title": "Помощник кодовой базы",
        "parent": "maps",
        "summary": "Узкие места: безопасность, выкладка, мониторинг, подключаемый анализ.",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "validation.practices-ux",
        "title": "Практики — обязательный стандарт кода",
        "parent": "validation",
        "summary": "Выбор практик — шаг создания и подключения; экран «включено в проекте» с числом нарушений.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.system-record",
        "title": "Дизайн-система — запись для любой модели",
        "parent": "design",
        "summary": "Токены, единицы и почему, типографика и лицензии шрифтов, анимации, сетка, принципы UX/UI — одной записью, которую читает любая LLM.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.harness",
        "title": "Харнесс в консоли",
        "parent": "llm",
        "summary": "Запуск задачи моделью из консоли (Claude Code CLI), живой вывод, остановка, лента вопросов от всех запусков.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.roles-plus",
        "title": "Новая роль из настроек",
        "parent": "access",
        "summary": "Кнопка «+»: имя, права по разделам, агент роли.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.profiles",
        "title": "Профили архитектуры",
        "parent": "projects",
        "summary": "ddd-clean, fsd, layered, своя, без профиля; переход постепенный, старые папки — наследие.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.grill-scope",
        "title": "Допрос по объёму при создании и подключении",
        "parent": "projects",
        "summary": "Порядок нового проекта: стратегия → инженерия → System Design; вопрос о каркасе, линтерах и CI обязателен; подсказки новичку.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "projects.llm-onboarding",
        "title": "Подключение через LLM",
        "parent": "projects",
        "summary": "README «Для LLM» и инструмент MCP с вопросами подключения: модель ставит DocDD и проводит допрос в чате.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "work.model-review",
        "title": "Ревью моделью",
        "parent": "work",
        "summary": "Отдельная сессия модели сверяет дифф с требованием, проверками и System Design; человеку — только вопросы архитектору.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "work.test-pyramid",
        "title": "Тесты по пирамиде",
        "parent": "work",
        "summary": "У проверки — случаи: обычные, крайние, невозможные; автотест на каждую проверку.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "ops.release-rollback",
        "title": "Стратегия выкладки и откат",
        "parent": "ops",
        "summary": "Релиз несёт стратегию выкладки; «Откатить» с причиной возвращает фичи в работу или бэклог.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "work.debt",
        "title": "Техдолг в бэклоге",
        "parent": "work",
        "summary": "Задача вида «техдолг» уходит в бэклог с меткой; legacy — откат в никуда.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      }
    ]
  },
  "removed": {
    "capabilities": [
      {
        "id": "analyst.assistant",
        "title": "Помощник аналитика"
      }
    ]
  }
}
```

## Журнал

- 2026-11-23 · заведена из разбора razbor-2026-11-23.md (п. 1–10) · модель
- 2026-11-23 · подтверждён · модель по поручению chelowek («сам прими», разбор 2026-11-23, В-0.2)
