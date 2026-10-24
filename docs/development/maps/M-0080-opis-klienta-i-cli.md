---
id: M-0080
type: map
title: Опись клиента и командной строки
status: draft
created: 2026-10-24
updated: 2026-10-24
---

# Опись клиента и командной строки

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками
то, что модель не поняла, и подтвердите — до этого карта на общую картину
не влияет.

Опись файлов клиента и командной строки, которых не было в картах: экраны, компоненты, переводы, состояние, скрипты. Описание — из шапочного комментария, связи — import со свидетельством (алиасы ~ и ~~ разрешены в пути). Группы для этих модулей объявлены в M-0079. **Пользовательские пути**: экраны всех страниц, которых не было в карте, и вызовы API и переходы, что видны прямо в файле страницы (вызовы из компонентов сюда не входят).

```docdd-codemap
{
  "added": {
    "modules": [
      {
        "id": "app/app.config.ts",
        "title": "app.config",
        "layer": "каркас",
        "summary": "Акцент в Nuxt UI (docs/16-design-system.md, «Акцент в Nuxt UI»). У библиотеки одна переменная `--ui-primary` и для заливки, и для текста, а подпись на сплошной заливке берётся из общей `--ui-text-inverted`, парной к…"
      },
      {
        "id": "app/assets/css/main.css",
        "title": "main",
        "layer": "стили"
      },
      {
        "id": "app/components/AgentsPanel.vue",
        "title": "AgentsPanel",
        "layer": "компоненты",
        "summary": "Агенты проекта (R-0091, docs/adr/0033-role-agents.md): файлы `docs/agents/<id>.md`. Создать из типа, изменить промпт, модель и доступ, удалить."
      },
      {
        "id": "app/components/ArchitectureAudit.vue",
        "title": "ArchitectureAudit",
        "layer": "компоненты",
        "summary": "Ответ «Аудита архитектуры» таблицей: путь, вид, что не так (docs/04-ui.md, «Архитектура на карте кода»). Мнение модели, а не свидетельство: ничего не пишется, а в задачи находки превращает человек."
      },
      {
        "id": "app/components/ArchitectureNote.vue",
        "title": "ArchitectureNote",
        "layer": "компоненты",
        "summary": "Строка проверки архитектуры над схемой кода (docs/04-ui.md, «Архитектура на карте кода»): сколько импортов проверено из скольких — чтобы тишина не выглядела как «всё хорошо» — и список нарушений словами."
      },
      {
        "id": "app/components/AsIsPanel.vue",
        "title": "AsIsPanel",
        "layer": "компоненты",
        "summary": "«Восстановить „как есть“» (R-0078, docs/04-ui.md, «Подключение»): для готовой кодовой базы модель предлагает возможности функциональной карты со свидетельством в коде и требования «как есть»."
      },
      {
        "id": "app/components/AutoHeight.vue",
        "title": "AutoHeight",
        "layer": "компоненты",
        "summary": "Плавная смена высоты: окно с разным содержимым (разделы настроек) не прыгает, а растёт и сжимается. Высоту меряет ResizeObserver у содержимого."
      },
      {
        "id": "app/components/BehindMarks.vue",
        "title": "BehindMarks",
        "layer": "компоненты",
        "summary": "«Отметить по фактам» (R-0101, docs/07-maps.md): возможности, все задачи которых закрыты, а отметка отстала. Кнопка заводит один черновик карты на подтверждение — отметку меняет подтверждение человеком, а не она."
      },
      {
        "id": "app/components/BodyEditor.vue",
        "title": "BodyEditor",
        "layer": "компоненты",
        "summary": "Правка текста документа человеком (docs/adr/0011-body-editing.md). `body` — тело записи целиком, как отдаёт сервер (текст человека и раздел «Журнал» вместе):"
      },
      {
        "id": "app/components/BulkBar.vue",
        "title": "BulkBar",
        "layer": "компоненты",
        "summary": "Панель массовых действий над отмеченными записями (docs/04-ui.md, «Массовые действия»). Целевой статус каждой записи выбирает сервер; панель называет число до нажатия и показывает отчёт после."
      },
      {
        "id": "app/components/ChecksPanel.vue",
        "title": "ChecksPanel",
        "layer": "экраны",
        "summary": "Факт и вид — то, по чему тестировщик ищет работу (docs/04-ui.md, «Сверка — рабочее место тестировщика»)."
      },
      {
        "id": "app/components/ContextPreview.vue",
        "title": "ContextPreview",
        "layer": "компоненты",
        "summary": "«Что уйдёт модели» (docs/adr/0021-context-pack.md): куски пакета, размер и оценка цены до отправки. Снятая галочка исключает кусок из запроса."
      },
      {
        "id": "app/components/CourseHistory.vue",
        "title": "CourseHistory",
        "layer": "компоненты",
        "summary": "История курса: по строке на подтверждённую карту с функциональным блоком, от новых к старым — когда, кто подтвердил, что изменилось (docs/04-ui.md, «Функциональная карта»). Собирается из записей, своего журнала нет."
      },
      {
        "id": "app/components/CustomMapForm.vue",
        "title": "CustomMapForm",
        "layer": "компоненты",
        "summary": "Заготовка под роль (R-0087): подставляет определение, дальше его правят как обычно."
      },
      {
        "id": "app/components/CustomMapView.vue",
        "title": "CustomMapView",
        "layer": "компоненты",
        "summary": "Вид связи карты → один из пяти стилей: по нему граф рисует стрелку, считает «ждёт» и циклы."
      },
      {
        "id": "app/components/DefectFromCheck.vue",
        "title": "DefectFromCheck",
        "layer": "компоненты",
        "summary": "«Завести дефект» из проваленной проверки (R-0063): заготовка получает связь `found_by` на проверку и `breaks` на требования, которые та проверяет. Показывается только при результате «провалена»."
      },
      {
        "id": "app/components/DesignComponents.vue",
        "title": "DesignComponents",
        "layer": "компоненты",
        "summary": "Реестр обязательных компонентов (docs/16-design-system.md): что объявлено, откуда, какие состояния и слои у него есть, на каком он этапе жизни и найден ли в коде проекта."
      },
      {
        "id": "app/components/DesignConstructors.vue",
        "title": "DesignConstructors",
        "layer": "компоненты",
        "summary": "Конструкторы форм и таблиц (docs/04-ui.md, «Дизайн»; docs/16-design-system.md, «Конструкторы»): по полям или колонкам — заготовка компонента выбранного стека на токенах и заготовка словаря на каждый язык проекта."
      },
      {
        "id": "app/components/DesignDiff.vue",
        "title": "DesignDiff",
        "layer": "компоненты",
        "summary": "Разница токенов дизайна (R-0073). Подключение: `<DesignDiff :diff=\"...\" />`, где `diff` — ответ `GET /api/projects/:id/design/record-diff?record=…`."
      },
      {
        "id": "app/components/DesignFigma.vue",
        "title": "DesignFigma",
        "layer": "компоненты",
        "summary": "Импорт токенов из Figma Variables (docs/04-ui.md, «Дизайн»; docs/16-design-system.md, «Токены из Figma»):"
      },
      {
        "id": "app/components/DesignScreens.vue",
        "title": "DesignScreens",
        "layer": "компоненты",
        "summary": "Проверка экранов (docs/04-ui.md, «Дизайн»; docs/16-design-system.md): опись снимков «экран · ширина · тема · когда снят», шаблон скрипта снятия и два прохода моделью — Responsive и Pixel-Perfect."
      },
      {
        "id": "app/components/DesignStacks.vue",
        "title": "DesignStacks",
        "layer": "компоненты",
        "summary": "Стеки проекта (docs/04-ui.md, «Дизайн»): для каждого объявленного в манифесте стека — текст выгрузки токенов по файлам, версия токенов против версии файла проекта и сверка. Файл приложение не пишет (ADR-0022):"
      },
      {
        "id": "app/components/DesignThemeBuilder.vue",
        "title": "DesignThemeBuilder",
        "layer": "компоненты",
        "summary": "Конструктор тем (docs/04-ui.md, «Дизайн»; docs/16-design-system.md, «Цветовые темы»): человек выбирает базу и меняет роли, а число контраста обновляется на глазах — по тем же правилам, что у проверки токенов."
      },
      {
        "id": "app/components/DesignTokens.vue",
        "title": "DesignTokens",
        "layer": "компоненты",
        "summary": "Токены проекта после сложения «общее → локальное» (docs/04-ui.md, «Дизайн»): палитра всех тем рядом с числами контраста, шкалы в натуральную величину в rem, сетка, языки, принципы, версия и список изменений."
      },
      {
        "id": "app/components/DiffUnviewed.vue",
        "title": "DiffUnviewed",
        "layer": "компоненты",
        "summary": "Значок «разница не открывалась» в списке на подтверждении (R-0068). Список id общий на проект."
      },
      {
        "id": "app/components/DocumentText.vue",
        "title": "DocumentText",
        "layer": "компоненты",
        "summary": "Разметка документа. Блоки mermaid вырезаются и отдаются отрисовщику: внутри markdown-it они остались бы текстом в рамке."
      },
      {
        "id": "app/components/ExternalImportPanel.vue",
        "title": "ExternalImportPanel",
        "layer": "компоненты",
        "summary": "Загрузка выгрузки Jira (CSV/JSON) или страниц Confluence (HTML/Markdown) во входящее (T-0047, T-0048)."
      },
      {
        "id": "app/components/FixWork.vue",
        "title": "FixWork",
        "layer": "компоненты",
        "summary": "Починка нарушений по подтверждённому плану (docs/adr/0010-model-fixes-violations.md). «Принять ответ» — это и есть подтверждение: до него не заводится ни ветка, ни правка."
      },
      {
        "id": "app/components/FunctionalCheck.vue",
        "title": "FunctionalCheck",
        "layer": "компоненты",
        "summary": "Ответ «Проверить по коду» таблицей: возможность, что в карте сейчас, что думает модель, её `note` (docs/04-ui.md, «Функциональная карта»). Это мнение, а не свидетельство:"
      },
      {
        "id": "app/components/FunctionalGraphBar.vue",
        "title": "FunctionalGraphBar",
        "layer": "компоненты",
        "summary": "Управление графом состояния: уровень (группы / всё), режим окраски и фильтры (docs/04-ui.md, «Уровни графа», «Режимы окраски», «Фильтры»). Все они только читают: ничего не пишут и не меняют карту."
      },
      {
        "id": "app/components/FunctionalLegendBar.vue",
        "title": "FunctionalLegendBar",
        "layer": "компоненты",
        "summary": "Легенда графа состояния — полоса над схемой, вне холста (docs/04-ui.md, «Легенда — над схемой»). Только то, что нарисовано, и с числом: данные те же, что строят схему, поэтому разойтись с ней легенда не может."
      },
      {
        "id": "app/components/FunctionalNext.vue",
        "title": "FunctionalNext",
        "layer": "компоненты",
        "summary": "«Можно начинать» (docs/07-maps.md, «Что дальше и что заденет»): нижние возможности, которым ничто не мешает, в порядке приоритета, горизонта и «освободит N». Ответ на «какой кусок брать следующим». Только читает:"
      },
      {
        "id": "app/components/FunctionalRelations.vue",
        "title": "FunctionalRelations",
        "layer": "компоненты",
        "summary": "Ответ «Предложить связи» таблицей: от — вид — к — фраза (docs/04-ui.md, «Функциональная карта»). Это мнение, а не свидетельство: «Занести связи» кладёт отмеченное в пачку связей на экране — не в карту."
      },
      {
        "id": "app/components/FunctionalSummary.vue",
        "title": "FunctionalSummary",
        "layer": "компоненты",
        "summary": "Сводка над деревом и графом функциональной карты: сколько возможностей в каком состоянии (docs/04-ui.md, «Функциональная карта»). Клик по счёту — фильтр: остаётся только это состояние, повторный клик снимает."
      },
      {
        "id": "app/components/GitGate.vue",
        "title": "GitGate",
        "layer": "компоненты",
        "summary": "Git при подключении (R-0094, docs/04-ui.md, «Подключение»): формат заводится в репозитории. Нет репозитория — консоль предлагает `git init` с ветки `main`, но только по кнопке: без согласия человека ничего не создаётся."
      },
      {
        "id": "app/components/GlobalSearch.vue",
        "title": "GlobalSearch",
        "layer": "компоненты",
        "summary": "Глобальный смысловой поиск (docs/adr/0031-semantic-search.md): окно поверх текущего экрана, а не страница. Пока запрос не введён — ни одного запроса к серверу. Результат — ссылка на запись и её раздел."
      },
      {
        "id": "app/components/GraphPanel.vue",
        "title": "GraphPanel",
        "layer": "экраны",
        "summary": "Вкладка «Граф» экрана «Сверка»: проверки, результат, нарушения и граф на одном экране (docs/04-ui.md, «Навигация»)."
      },
      {
        "id": "app/components/ImportPanel.vue",
        "title": "ImportPanel",
        "layer": "экраны",
        "summary": "«Выбрать всё» трогает только то, что можно перенести: файл с front matter — запись, а не импорт."
      },
      {
        "id": "app/components/InboxPanel.vue",
        "title": "InboxPanel",
        "layer": "экраны",
        "summary": "Входящее: сырые заметки и заведение записей по ним (docs/10-inbox.md). Записи создаёт приложение — модель только предлагает список, а человек его правит и подтверждает."
      },
      {
        "id": "app/components/IssueList.vue",
        "title": "IssueList",
        "layer": "компоненты",
        "summary": "Список нарушений. Флажок у каждого: чинить будут отмеченные, а не всё, что попало под фильтр (docs/04-ui.md, раздел «Нарушения»)."
      },
      {
        "id": "app/components/IssuesPanel.vue",
        "title": "IssuesPanel",
        "layer": "экраны",
        "summary": "Отмеченные нарушения: чинить будут их, а не всё под фильтром."
      },
      {
        "id": "app/components/LightBadge.vue",
        "title": "LightBadge",
        "layer": "компоненты",
        "summary": "Лёгкая метка для строк длинных списков: тот же вид, что у UBadge size=\"sm\" (subtle/outline), но один <span> без обвязки компонента Nuxt UI — на сотнях строк разница видна во времени отрисовки."
      },
      {
        "id": "app/components/ManagerAssistant.vue",
        "title": "ManagerAssistant",
        "layer": "компоненты",
        "summary": "Помощник менеджера (T-0036): три вопроса к модели. Данные подставляются в текст запроса, инструменты модели выключены; ответ — черновик, порядок применяется отдельно кнопкой «Применить порядок» на экране «Работа»."
      },
      {
        "id": "app/components/ManagerBoard.vue",
        "title": "ManagerBoard",
        "layer": "компоненты",
        "summary": "Доска задач по статусам (T-0032; docs/04-ui.md, «Менеджер и Релизы»). Перенос карточки — тот же маршрут смены статуса, что и кнопка в записи: правила переходов не обходятся, причина отказа показывается перечнем."
      },
      {
        "id": "app/components/ManagerRoadmap.vue",
        "title": "ManagerRoadmap",
        "layer": "компоненты",
        "summary": "Дорожная карта фаз (T-0033) с вехами (T-0034): фазы по `rank`, прогресс задач, чужие задачи, из-за которых фаза стоит, и отклонение от целевой даты."
      },
      {
        "id": "app/components/ManagerSummary.vue",
        "title": "ManagerSummary",
        "layer": "компоненты",
        "summary": "Сводка для заказчика (T-0035): возможности карты простым языком, копирование и выгрузка в Markdown."
      },
      {
        "id": "app/components/ManualAcceptModal.vue",
        "title": "ManualAcceptModal",
        "layer": "компоненты",
        "summary": "«Принять вручную» (docs/04-ui.md): отметка «Проверено» на ручных проверках и повторный перевод задач. Окно само находит, чего не хватает задаче, — по цепочке задача → требование → проверка."
      },
      {
        "id": "app/components/MapBatchDescribe.vue",
        "title": "MapBatchDescribe",
        "layer": "компоненты",
        "summary": "«Описать пачками» (docs/07-maps.md, «Описать всё пачками»): запустить один раз и не нажимать «Обновить карты» на каждый заход. Расход остаётся в руках человека:"
      },
      {
        "id": "app/components/MapDepthBar.vue",
        "title": "MapDepthBar",
        "layer": "компоненты",
        "summary": "Какая карта: от неё зависит имя параметра группы в адресе."
      },
      {
        "id": "app/components/MapDiff.vue",
        "title": "MapDiff",
        "layer": "компоненты",
        "summary": "Разница карты на схеме (R-0069). Подключение: `<MapDiff :diff=\"...\" />`, где `diff` — ответ `GET /api/projects/:id/records/:recordId/map-diff`. Дерево со вложенностью, цвета:"
      },
      {
        "id": "app/components/MapInspector.vue",
        "title": "MapInspector",
        "layer": "компоненты",
        "summary": "Клик по узлу или ребру карты открывает эту карточку сбоку — не уводя с диаграммы (docs/04-ui.md, «Карты»). У узла:"
      },
      {
        "id": "app/components/MapInventory.vue",
        "title": "MapInventory",
        "layer": "компоненты",
        "summary": "Состояние описи файлов (docs/07-maps.md, раздел «Опись файлов»). Цифра всегда с причиной: за каждой — список файлов, а не общее ощущение."
      },
      {
        "id": "app/components/MapLegendBar.vue",
        "title": "MapLegendBar",
        "layer": "компоненты",
        "summary": "Легенда вкладок «Кодовая база», «Потоки данных», «Пользовательские пути» — полоса над схемой, вне холста (docs/04-ui.md, «Легенда кодовой базы, потоков и путей»)."
      },
      {
        "id": "app/components/MapRecordsCard.vue",
        "title": "MapRecordsCard",
        "layer": "компоненты",
        "summary": "Записи, из которых сложены карты (docs/04-ui.md, «Карты»), — аккордеоном, как вектор: список длинный и нужен не всегда."
      },
      {
        "id": "app/components/MapSplitHints.vue",
        "title": "MapSplitHints",
        "layer": "компоненты",
        "summary": "Подсказки дробления группы (ADR-0027): слишком много детей, слабая связность, цикл. Это совет, а не запрет; тексты и условия считает hierarchy.ts."
      },
      {
        "id": "app/components/MermaidDiagram.vue",
        "title": "MermaidDiagram",
        "layer": "компоненты",
        "summary": "id узла в тексте mermaid → полный текст для наведения (app/utils/map-mermaid.ts)."
      },
      {
        "id": "app/components/ModelJobsBar.vue",
        "title": "ModelJobsBar",
        "layer": "компоненты",
        "summary": "«Модель работает: N» в шапке (docs/04-ui.md, «Запрос к модели»): запросы живут в общем хранилище, и с любой страницы видно, что идёт, сколько, и куда вернуться."
      },
      {
        "id": "app/components/ModelLog.vue",
        "title": "ModelLog",
        "layer": "компоненты",
        "summary": "Лента работы модели (docs/04-ui.md, раздел «Что модель делает прямо сейчас»). Показывает то же, что человек увидел бы в её чате: текст ответа по мере написания и обращения к файлам и командам. Лента — не ответ:"
      },
      {
        "id": "app/components/ModelProgress.vue",
        "title": "ModelProgress",
        "layer": "компоненты",
        "summary": "Ход запроса к модели и его итог (docs/04-ui.md, раздел «Запрос к модели»). Пока идёт — сколько прошло, сколько ждём и «Отменить». Кончилось — чем кончилось. Один вид ожидания на все места, откуда зовут модель."
      },
      {
        "id": "app/components/NewProjectWizard.vue",
        "title": "NewProjectWizard",
        "layer": "компоненты",
        "summary": "Мастер нового проекта (R-0076, docs/04-ui.md, «Подключение»): вектор, первые возможности с требованиями, глоссарий — и черновики записей до первой задачи. «Подтвердить и подготовить» — решение человека:"
      },
      {
        "id": "app/components/NewRecord.vue",
        "title": "NewRecord",
        "layer": "компоненты",
        "summary": "Справка (docs/13-reference.md): строка для индекса обязательна, вид — из четырёх."
      },
      {
        "id": "app/components/NotificationsBell.vue",
        "title": "NotificationsBell",
        "layer": "компоненты",
        "summary": "Колокольчик в шапке (R-0059): число непрочитанных и список по нажатию. Кто читает, решает сервер: вошедший видит своё, без входа — все уведомления проекта. Всплывающее окно закрывается по клику вне и по Esc."
      },
      {
        "id": "app/components/OnboardingChecklist.vue",
        "title": "OnboardingChecklist",
        "layer": "компоненты",
        "summary": "Чек-лист «Готовность проекта» (R-0075, docs/04-ui.md, «Подключение»): шаги подключения со статусом, вычисленным по состоянию проекта."
      },
      {
        "id": "app/components/OnboardingTour.vue",
        "title": "OnboardingTour",
        "layer": "компоненты",
        "summary": "Обучение новому человеку (R-0094, docs/04-ui.md, «Обучение»): три коротких шага — как читать стратегию и карты, почему задача не уходит в работу без документа, как работать с моделью через ветку и дифф."
      },
      {
        "id": "app/components/OrderDiff.vue",
        "title": "OrderDiff",
        "layer": "компоненты",
        "summary": "Общий вид «было → станет» (R-0072): фаза и задача со стрелкой и номерами места. Подключение: `<OrderDiff :before=\"[{ id, items }]\" :after=\"[{ id, items }]\" :titles=\"{ id:"
      },
      {
        "id": "app/components/OverallProgress.vue",
        "title": "OverallProgress",
        "layer": "компоненты",
        "summary": "Две общие шкалы проекта: задачи и фазы (docs/04-ui.md, «Общие шкалы»). Записи приходят все, без фильтров экрана, — шкала про проект, а не про выбранное."
      },
      {
        "id": "app/components/PhasePlan.vue",
        "title": "PhasePlan",
        "layer": "компоненты",
        "summary": "Предложенное моделью разбиение (docs/04-ui.md, «Разбить на фазы»): список, который человек правит — выключает лишнее, переименовывает, — и только потом «Создать фазы». Файлы задач не меняются."
      },
      {
        "id": "app/components/PhasePlanner.vue",
        "title": "PhasePlanner",
        "layer": "компоненты",
        "summary": "Кнопка «Разбить на фазы» (docs/04-ui.md, «Разбить на фазы»): запрос к модели по задачам, которые ещё ни в какой фазе, и список предложенного под ним."
      },
      {
        "id": "app/components/PracticeRules.vue",
        "title": "PracticeRules",
        "layer": "компоненты",
        "summary": "Правила проверки в практиках (docs/04-ui.md, «Правила в практиках»; docs/12-practice-rules.md):"
      },
      {
        "id": "app/components/PriorityPreview.vue",
        "title": "PriorityPreview",
        "layer": "компоненты",
        "summary": "Ответ «Сортировать по важности» таблицей: фаза → задачи с причиной у каждой строки (docs/04-ui.md, «Порядок по важности»). Мнение модели: ничего не пишется, пока человек не нажал «Применить порядок»."
      },
      {
        "id": "app/components/ProjectDashboard.vue",
        "title": "ProjectDashboard",
        "layer": "компоненты",
        "summary": "Обзор реального проекта (docs/04-ui.md, «Обзор»): готово ли обещанное, что в проде, что делается и проверяется, здорова ли система. Цифры считает server/lib/overview.ts, каждая ведёт к своему списку."
      },
      {
        "id": "app/components/PromptPanel.vue",
        "title": "PromptPanel",
        "layer": "компоненты",
        "summary": "Запрос к модели: показать, скопировать, отправить. Отправка идёт через Claude Code на этой же машине, и ответ ничего не меняет сам — он показывается человеку (docs/adr/0008-llm-through-claude-code.md)."
      },
      {
        "id": "app/components/RecordActions.vue",
        "title": "RecordActions",
        "layer": "компоненты",
        "summary": "Закрытие держит ручная проверка — предлагаем принять её вручную (docs/04-ui.md)."
      },
      {
        "id": "app/components/RecordAsk.vue",
        "title": "RecordAsk",
        "layer": "компоненты",
        "summary": "Кнопка «Спросить» в карточке записи (T-0030): вопрос идёт с пакетом контекста этой записи, ответ ложится черновиком заметки, а не правкой записи."
      },
      {
        "id": "app/components/RecordCriteria.vue",
        "title": "RecordCriteria",
        "layer": "компоненты",
        "summary": "Критерии приёмки требования и черновики проверок из них (T-0037). Черновики заводятся обычным созданием записи — id выдаёт сервер, статус draft."
      },
      {
        "id": "app/components/RecordDiff.vue",
        "title": "RecordDiff",
        "layer": "компоненты",
        "summary": "Разница записи на подтверждении: «было → станет» (R-0068, R-0070, R-0071). Открытие разворачивает блок и ставит отметку просмотра на сервере: от неё зависит строка журнала при подтверждении."
      },
      {
        "id": "app/components/RecordDiscussion.vue",
        "title": "RecordDiscussion",
        "layer": "компоненты",
        "summary": "Обсуждение на карточке записи (R-0060): оставить замечание, ответить, закрыть. Хранится файлом рядом с записью; текст документа не меняется."
      },
      {
        "id": "app/components/ResultsPanel.vue",
        "title": "ResultsPanel",
        "layer": "экраны",
        "summary": "Вкладка «Результат» экрана «Сверка»: проверки, результат, нарушения и граф на одном экране (docs/04-ui.md, «Навигация»)."
      },
      {
        "id": "app/components/ReviewBatchPrompt.vue",
        "title": "ReviewBatchPrompt",
        "layer": "компоненты",
        "summary": "«Запрос на проверку» (docs/04-ui.md, «Задачи на проверке — запрос на проверку»): собрать текст для основной сессии Claude Code. Сам ничего не запускает — вставляет его человек."
      },
      {
        "id": "app/components/RunPanel.vue",
        "title": "RunPanel",
        "layer": "компоненты",
        "summary": "Причина блокировки обязательна: без неё прогон не записывается (R-0098)."
      },
      {
        "id": "app/components/SettingsDialog.vue",
        "title": "SettingsDialog",
        "layer": "компоненты",
        "summary": "Настройки консоли (docs/04-ui.md, «Настройки»): окно поверх экрана, как поиск. Вкладки — поиск (чем считать эмбеддинги, состояние индекса), модели (провайдеры и маршруты, тот же экран, что /models) и аккаунты с доступом…"
      },
      {
        "id": "app/components/SourcesFinder.vue",
        "title": "SourcesFinder",
        "layer": "компоненты",
        "summary": "Найденные источники (R-0077, docs/04-ui.md, «Автопоиск источников»): приложение находит папки и файлы, человек отмечает и подтверждает — тогда они записываются в `project.yaml`."
      },
      {
        "id": "app/components/StatusTabs.vue",
        "title": "StatusTabs",
        "layer": "компоненты",
        "summary": "Вкладки статусов над списком с числами (docs/04-ui.md, «Списки по статусам»). Показываются только статусы, которые в списке есть: вкладка с нулём ничего не отвечает."
      },
      {
        "id": "app/components/StrategyIntent.vue",
        "title": "StrategyIntent",
        "layer": "компоненты",
        "summary": "Строка намерения на стратегической карте (docs/adr/0037-strategy-intent-input.md):"
      },
      {
        "id": "app/components/TaskAssignee.vue",
        "title": "TaskAssignee",
        "layer": "компоненты",
        "summary": "Исполнитель задачи (T-0016). Без входа это свободное имя; когда появится команда, список подсказок берётся из неё. Смена пишет строку в журнал."
      },
      {
        "id": "app/components/TaskRequirement.vue",
        "title": "TaskRequirement",
        "layer": "компоненты",
        "summary": "«Привести задачу в порядок» (docs/04-ui.md, «Запись»): у задачи нет `implements`, и шаг вперёд заблокирован — выбрать требование или завести новое прямо тут, не уходя в файл."
      },
      {
        "id": "app/components/TaskReuse.vue",
        "title": "TaskReuse",
        "layer": "компоненты",
        "summary": "Справочник в карточке задачи (docs/04-ui.md, «Справочник»): задача `feature` в работе, а справочник не просмотрен — выбрать справку, которую она переиспользует, или записать «подходящего нет». Напоминание, не запрет."
      },
      {
        "id": "app/components/TaskReviewer.vue",
        "title": "TaskReviewer",
        "layer": "компоненты",
        "summary": "Ревьюер в карточке задачи (docs/adr/0030-task-reviewer.md): кто принимает задачу и почему. «По правилу» убирает поле `reviewer` — роль снова выводится из проверок и типа изменения."
      },
      {
        "id": "app/components/TaskWork.vue",
        "title": "TaskWork",
        "layer": "компоненты",
        "summary": "Выполнение задачи через клиент (docs/09-execution.md). Приложение показывает дифф и ничего не сливает само: принимает человек."
      },
      {
        "id": "app/components/TeamCard.vue",
        "title": "TeamCard",
        "layer": "компоненты"
      },
      {
        "id": "app/components/TestChecksPanel.vue",
        "title": "TestChecksPanel",
        "layer": "компоненты",
        "summary": "Проверки из существующих тестов (R-0079, docs/04-ui.md, «Подключение»): какие тестовые файлы нашлись, каким требованиям они подходят (с причиной) и какие требования уже покрыты."
      },
      {
        "id": "app/components/VerificationCard.vue",
        "title": "VerificationCard",
        "layer": "компоненты",
        "summary": "«Как проверить» на странице проверки (docs/04-ui.md, «Карточка проверки — для тестировщика»): каким способом, что проверяет и кто это строит, когда её гоняли."
      },
      {
        "id": "app/components/VerifiedCheck.vue",
        "title": "VerifiedCheck",
        "layer": "компоненты",
        "summary": "Флажок «Проверено» на ручной проверке (docs/04-ui.md, «Отметка „Проверено“»). Фиксируется отчётом в tests/reports и строкой в журнале; снятие — не провал, а возврат в «не проверено»."
      },
      {
        "id": "app/components/VisionCard.vue",
        "title": "VisionCard",
        "layer": "компоненты",
        "summary": "Вектор проекта — карточка над функциональной картой (docs/04-ui.md, «Функциональная карта»; docs/07-maps.md, «Вектор проекта»). Проблема, для кого, что считается успехом, чего продукт не делает — и след:"
      },
      {
        "id": "app/composables/useMe.ts",
        "title": "useMe",
        "layer": "клиентские утилиты",
        "summary": "Роли вошедшего в команде проекта: по ним выбирается роль шапки по умолчанию."
      },
      {
        "id": "app/composables/useModelRequest.ts",
        "title": "useModelRequest",
        "layer": "клиентские утилиты",
        "summary": "Ожидание ответа модели (docs/04-ui.md, раздел «Запрос к модели»). Модель думает минутами, и всё это время экран обязан отвечать на один вопрос: идёт запрос или отвалился."
      },
      {
        "id": "app/composables/useOrderMode.ts",
        "title": "useOrderMode",
        "layer": "клиентские утилиты",
        "summary": "Порядок списков «Работы»: «по важности» по умолчанию, пока у фаз есть `rank`, и «по номеру», если человек так выбрал (`?order=id`) или порядка по важности ещё нет (docs/04-ui.md, «Порядок по важности»)."
      },
      {
        "id": "app/composables/useProjectIndex.ts",
        "title": "useProjectIndex",
        "layer": "клиентские утилиты",
        "summary": "Обращения к API живут здесь: компоненты не ходят в файловую систему и не знают о путях — только эти вызовы (docs/01-architecture.md)."
      },
      {
        "id": "app/composables/useSelection.ts",
        "title": "useSelection",
        "layer": "клиентские утилиты",
        "summary": "Отметки в списке (docs/04-ui.md, «Массовые действия»). Отмеченным считается только то, что сейчас на экране:"
      },
      {
        "id": "app/composables/useStatusFilter.ts",
        "title": "useStatusFilter",
        "layer": "клиентские утилиты",
        "summary": "Вкладка статуса живёт в адресе (`?status=draft`): ссылка на «черновики требований» ведёт на них (docs/04-ui.md, «Списки по статусам»). Пустая строка — «Все»."
      },
      {
        "id": "app/composables/useT.ts",
        "title": "useT",
        "layer": "клиентские утилиты",
        "summary": "i18n интерфейса консоли (docs/16-design-system.md, «i18n»). Языки, основной и запасной берутся из токенов дизайна — тех же, которые консоль выгружает в проекты, поэтому её язык не расходится с правилом, которое она…"
      },
      {
        "id": "app/composables/useTaskReviewers.ts",
        "title": "useTaskReviewers",
        "layer": "клиентские утилиты",
        "summary": "Ревьюер у каждой задачи списка и фильтр по нему (docs/adr/0030-task-reviewer.md): у роли своя очередь приёмки."
      },
      {
        "id": "app/design-tokens.ts",
        "title": "design-tokens",
        "layer": "стили",
        "summary": "Сгенерировано консолью DocDD из токенов дизайна v1.9.0 (docs/16-design-system.md). Не правьте руками: меняются токены. Размеры в rem. Языки — точка подключения словарей (@nuxtjs/i18n и подобные)."
      },
      {
        "id": "app/i18n/en/agents.ts",
        "title": "agents",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «agents» (английский)."
      },
      {
        "id": "app/i18n/en/components.ts",
        "title": "components",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «components» (английский)."
      },
      {
        "id": "app/i18n/en/design.ts",
        "title": "design",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «design» (английский)."
      },
      {
        "id": "app/i18n/en/manager.ts",
        "title": "manager",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «manager» (английский)."
      },
      {
        "id": "app/i18n/en/nav.ts",
        "title": "nav",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «nav» (английский)."
      },
      {
        "id": "app/i18n/en/notifications.ts",
        "title": "notifications",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «notifications» (английский)."
      },
      {
        "id": "app/i18n/en/onboarding.ts",
        "title": "onboarding",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «onboarding» (английский)."
      },
      {
        "id": "app/i18n/en/overview.ts",
        "title": "overview",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «overview» (английский)."
      },
      {
        "id": "app/i18n/en/pages.ts",
        "title": "pages",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «pages» (английский)."
      },
      {
        "id": "app/i18n/en/pages2.ts",
        "title": "pages2",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «pages2» (английский)."
      },
      {
        "id": "app/i18n/en/records.ts",
        "title": "records",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «records» (английский)."
      },
      {
        "id": "app/i18n/en/rest.ts",
        "title": "rest",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «rest» (английский)."
      },
      {
        "id": "app/i18n/en/screens.ts",
        "title": "screens",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «screens» (английский)."
      },
      {
        "id": "app/i18n/en/search.ts",
        "title": "search",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «search» (английский)."
      },
      {
        "id": "app/i18n/en/settings.ts",
        "title": "settings",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «settings» (английский)."
      },
      {
        "id": "app/i18n/en/shell.ts",
        "title": "shell",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «shell» (английский)."
      },
      {
        "id": "app/i18n/en/strategy.ts",
        "title": "strategy",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «strategy» (английский)."
      },
      {
        "id": "app/i18n/en/ui-inbox.ts",
        "title": "ui-inbox",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-inbox» (английский)."
      },
      {
        "id": "app/i18n/en/ui-last.ts",
        "title": "ui-last",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-last» (английский)."
      },
      {
        "id": "app/i18n/en/ui-maps.ts",
        "title": "ui-maps",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-maps» (английский)."
      },
      {
        "id": "app/i18n/en/ui-mermaid.ts",
        "title": "ui-mermaid",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-mermaid» (английский)."
      },
      {
        "id": "app/i18n/en/ui-rest.ts",
        "title": "ui-rest",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-rest» (английский)."
      },
      {
        "id": "app/i18n/en/ui-utils.ts",
        "title": "ui-utils",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-utils» (английский)."
      },
      {
        "id": "app/i18n/en/verify.ts",
        "title": "verify",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «verify» (английский)."
      },
      {
        "id": "app/i18n/index.ts",
        "title": "index",
        "layer": "переводы",
        "summary": "Словари интерфейса по языкам (docs/16-design-system.md, «i18n»). Языки продукта объявлены в токенах дизайна; здесь — тексты. Основной язык — русский, второй — английский."
      },
      {
        "id": "app/i18n/ru/agents.ts",
        "title": "agents",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «agents» (русский)."
      },
      {
        "id": "app/i18n/ru/components.ts",
        "title": "components",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «components» (русский)."
      },
      {
        "id": "app/i18n/ru/design.ts",
        "title": "design",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «design» (русский)."
      },
      {
        "id": "app/i18n/ru/manager.ts",
        "title": "manager",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «manager» (русский)."
      },
      {
        "id": "app/i18n/ru/nav.ts",
        "title": "nav",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «nav» (русский)."
      },
      {
        "id": "app/i18n/ru/notifications.ts",
        "title": "notifications",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «notifications» (русский)."
      },
      {
        "id": "app/i18n/ru/onboarding.ts",
        "title": "onboarding",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «onboarding» (русский)."
      },
      {
        "id": "app/i18n/ru/overview.ts",
        "title": "overview",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «overview» (русский)."
      },
      {
        "id": "app/i18n/ru/pages.ts",
        "title": "pages",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «pages» (русский)."
      },
      {
        "id": "app/i18n/ru/pages2.ts",
        "title": "pages2",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «pages2» (русский)."
      },
      {
        "id": "app/i18n/ru/records.ts",
        "title": "records",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «records» (русский)."
      },
      {
        "id": "app/i18n/ru/rest.ts",
        "title": "rest",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «rest» (русский)."
      },
      {
        "id": "app/i18n/ru/screens.ts",
        "title": "screens",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «screens» (русский)."
      },
      {
        "id": "app/i18n/ru/search.ts",
        "title": "search",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «search» (русский)."
      },
      {
        "id": "app/i18n/ru/settings.ts",
        "title": "settings",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «settings» (русский)."
      },
      {
        "id": "app/i18n/ru/shell.ts",
        "title": "shell",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «shell» (русский)."
      },
      {
        "id": "app/i18n/ru/strategy.ts",
        "title": "strategy",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «strategy» (русский)."
      },
      {
        "id": "app/i18n/ru/ui-inbox.ts",
        "title": "ui-inbox",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-inbox» (русский)."
      },
      {
        "id": "app/i18n/ru/ui-last.ts",
        "title": "ui-last",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-last» (русский)."
      },
      {
        "id": "app/i18n/ru/ui-maps.ts",
        "title": "ui-maps",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-maps» (русский)."
      },
      {
        "id": "app/i18n/ru/ui-mermaid.ts",
        "title": "ui-mermaid",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-mermaid» (русский)."
      },
      {
        "id": "app/i18n/ru/ui-rest.ts",
        "title": "ui-rest",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-rest» (русский)."
      },
      {
        "id": "app/i18n/ru/ui-utils.ts",
        "title": "ui-utils",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «ui-utils» (русский)."
      },
      {
        "id": "app/i18n/ru/verify.ts",
        "title": "verify",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «verify» (русский)."
      },
      {
        "id": "app/i18n/tr.ts",
        "title": "tr",
        "layer": "переводы",
        "summary": "Перевод для чистых функций (`app/utils`, сторы), у которых нет `useT()`. Язык запоминает сам `useT()` при каждом вызове и при смене языка; вне Nuxt — в юнит-тестах — остаётся русский исходник. Хранилище одно на процесс:"
      },
      {
        "id": "app/layouts/default.vue",
        "title": "default",
        "layer": "разметка",
        "summary": "Навигация появляется, только когда выбран проект: без него ей некуда вести."
      },
      {
        "id": "app/middleware/auth.global.ts",
        "title": "auth.global",
        "layer": "каркас",
        "summary": "Включён вход, а человек не вошёл — на экран входа (docs/adr/0020)."
      },
      {
        "id": "app/pages/audit.vue",
        "title": "audit",
        "layer": "экраны",
        "summary": "Экран администратора: журнал доступа сервера (T-0018)."
      },
      {
        "id": "app/pages/design.vue",
        "title": "design",
        "layer": "экраны",
        "summary": "Глобальный экран «Дизайн» (docs/04-ui.md, «Дизайн»): эталон консоли и проекты, которые его подключили. Живёт на уровне консоли, рядом с «Все проекты», а не внутри проекта: токены ведутся один раз и спускаются вниз."
      },
      {
        "id": "app/pages/index.vue",
        "title": "index",
        "layer": "экраны",
        "summary": "Формат заводится только там, где его нет: предложение появляется после отказа."
      },
      {
        "id": "app/pages/login.vue",
        "title": "login",
        "layer": "экраны"
      },
      {
        "id": "app/pages/models.vue",
        "title": "models",
        "layer": "экраны",
        "summary": "«≈» — только когда в сумме есть оценка по символам (R-0093); по токенам провайдера — точно."
      },
      {
        "id": "app/pages/notifications.vue",
        "title": "notifications",
        "layer": "экраны"
      },
      {
        "id": "app/pages/people.vue",
        "title": "people",
        "layer": "экраны",
        "summary": "Аккаунт агента (ADR-0033): без пароля, тип — из набора агентов."
      },
      {
        "id": "app/pages/portfolio.vue",
        "title": "portfolio",
        "layer": "экраны",
        "summary": "Портфель проектов (T-0042): какой проект идёт, какой стоит, где ошибки процесса."
      },
      {
        "id": "app/pages/projects/[id]/analyst.vue",
        "title": "analyst",
        "layer": "экраны",
        "summary": "Помощник аналитика (T-0038): уточнение, противоречия, критерии. Ответ только читается — в документы ничего не пишется."
      },
      {
        "id": "app/pages/projects/[id]/checks.vue",
        "title": "checks",
        "layer": "экраны",
        "summary": "Старый адрес: «Проверки» — вкладка экрана «Сверка» (docs/04-ui.md, «Навигация»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/design.vue",
        "title": "design",
        "layer": "экраны",
        "summary": "«Дизайн» проекта (docs/04-ui.md, «Дизайн»; docs/16-design-system.md): токены после сложения «общее → локальное», реестр компонентов, конструктор тем, выгрузка в стеки, конструкторы форм и таблиц, импорт из Figma и…"
      },
      {
        "id": "app/pages/projects/[id]/file.vue",
        "title": "file",
        "layer": "экраны",
        "summary": "Просмотр файла документации проекта — сюда ведёт смысловой поиск по README и docs/** (docs/adr/0031-semantic-search.md). Только чтение, только внутри корня."
      },
      {
        "id": "app/pages/projects/[id]/glossary.vue",
        "title": "glossary",
        "layer": "экраны",
        "summary": "Термины проекта (T-0041). Файл правят руками; термины из текста запроса сами попадают в пакет контекста."
      },
      {
        "id": "app/pages/projects/[id]/graph.vue",
        "title": "graph",
        "layer": "экраны",
        "summary": "Старый адрес: «Граф» — вкладка экрана «Сверка» (docs/04-ui.md, «Навигация»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/import.vue",
        "title": "import",
        "layer": "экраны",
        "summary": "Старый адрес: «Импорт» — вкладка экрана «Наполнение» (docs/04-ui.md, «Навигация»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/inbox.vue",
        "title": "inbox",
        "layer": "экраны",
        "summary": "Старый адрес: «Входящее» — вкладка экрана «Наполнение» (docs/04-ui.md, «Навигация»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/index.vue",
        "title": "index",
        "layer": "экраны",
        "summary": "«Можно брать»: задачи в ready, отсортированные по фазе (docs/04-ui.md)."
      },
      {
        "id": "app/pages/projects/[id]/issues.vue",
        "title": "issues",
        "layer": "экраны",
        "summary": "Старый адрес: «Нарушения» — вкладка экрана «Сверка» (docs/04-ui.md, «Навигация»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/knowledge.vue",
        "title": "knowledge",
        "layer": "экраны",
        "summary": "Пространство знаний (T-0039): дерево документов как страницы. Пункт меню → документ в дереве → правка на месте: два клика. Текст правит BodyEditor (docs/adr/0011-body-editing.md), подтверждённое он не пускает."
      },
      {
        "id": "app/pages/projects/[id]/manager.vue",
        "title": "manager",
        "layer": "экраны",
        "summary": "Рабочее место менеджера проекта (docs/15-team-platform.md, фаза 29): доска, дорожная карта, сводка для заказчика и помощник. Всё считается из записей."
      },
      {
        "id": "app/pages/projects/[id]/maps.vue",
        "title": "maps",
        "layer": "экраны",
        "summary": "Две категории карт (ADR-0035): `strategic` — стратегическая карта (вид `functional`) на экране «Стратегия», `working` — рабочие карты (шаблоны с движком и свои) на экране «Карты»."
      },
      {
        "id": "app/pages/projects/[id]/records/[recordId].vue",
        "title": "[recordId]",
        "layer": "экраны",
        "summary": "После действия перечитываем и запись, и индекс: статус меняет обе картины."
      },
      {
        "id": "app/pages/projects/[id]/reference.vue",
        "title": "reference",
        "layer": "экраны",
        "summary": "Справочник (docs/04-ui.md, «Справочник»; docs/13-reference.md): справки и индекс, который уходит в запросы модели. Индекс ведёт приложение — здесь его состояние и кнопка пересборки; руками он не правится."
      },
      {
        "id": "app/pages/projects/[id]/releases.vue",
        "title": "releases",
        "layer": "экраны",
        "summary": "Релизы и окружения (T-0128, R-0064; docs/04-ui.md, «Менеджер и Релизы»): что готово к выпуску, что ушло в какую версию и где выложено."
      },
      {
        "id": "app/pages/projects/[id]/requirements.vue",
        "title": "requirements",
        "layer": "экраны",
        "summary": "Старый адрес: «Требования» — вкладка списка документов (docs/04-ui.md, «Требования»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/results.vue",
        "title": "results",
        "layer": "экраны",
        "summary": "Старый адрес: «Результат» — вкладка экрана «Сверка» (docs/04-ui.md, «Навигация»). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/projects/[id]/search.vue",
        "title": "search",
        "layer": "экраны",
        "summary": "Поиск по записям и знаниям проекта (T-0040). Запрос уходит на сервер с задержкой, чтобы не стрелять на каждую букву."
      },
      {
        "id": "app/pages/projects/[id]/shared.vue",
        "title": "shared",
        "layer": "экраны",
        "summary": "Практики: decision/design из других DocDD-проектов, читаемые для справки (docs/11-shared-sources.md). Записи здесь не заводятся и не подтверждаются — источник открывают своим отдельным проектом."
      },
      {
        "id": "app/pages/projects/[id]/strategy.vue",
        "title": "strategy",
        "layer": "экраны",
        "summary": "«Стратегия» (R-0084, R-0085; docs/04-ui.md): контуры проекта — возможности верхнего уровня стратегической карты (в файлах — функциональной) — со здоровьем из четырёх сигналов. Экран — сама карта (ADR-0035):"
      },
      {
        "id": "app/pages/projects/[id]/tasks.vue",
        "title": "tasks",
        "layer": "экраны",
        "summary": "Старый адрес: «Задачи» — вкладка экрана «Работа» (docs/04-ui.md). Закладки и ссылки на него не ломаются, а ведут на вкладку."
      },
      {
        "id": "app/pages/usage.vue",
        "title": "usage",
        "layer": "экраны",
        "summary": "Front matter у этого документа нет — он не запись, а документация инструмента."
      },
      {
        "id": "app/plugins/can.ts",
        "title": "can",
        "layer": "каркас",
        "summary": "`v-can=\"'work'\"` — общая причина неактивной кнопки (T-0017, docs/04-ui.md): без права кнопка не прячется, а блокируется и называет причину в подсказке."
      },
      {
        "id": "app/plugins/i18n.ts",
        "title": "i18n",
        "layer": "каркас",
        "summary": "Язык интерфейса из cookie, одинаково на сервере и на клиенте: иначе первая отрисовка шла бы на основном языке и страница «мигала» бы после гидрации. Атрибут `lang` страницы следует за выбором — читалкам экрана это важно."
      },
      {
        "id": "app/plugins/model-jobs.client.ts",
        "title": "model-jobs.client",
        "layer": "каркас",
        "summary": "После обновления страницы — вернуть задания к модели этой вкладки и подключиться к идущим (ADR-0034). Только в браузере: на сервере `sessionStorage` нет."
      },
      {
        "id": "app/stores/modelJobs.ts",
        "title": "modelJobs",
        "layer": "клиентские утилиты",
        "summary": "Запросы к модели живут здесь, а не в странице (docs/04-ui.md, «Запрос к модели»; docs/adr/0017-model-jobs-store.md): уход со страницы запрос не обрывает, возврат подхватывает идущее и отдаёт готовое один раз."
      },
      {
        "id": "app/utils/batch-describe.ts",
        "title": "batch-describe",
        "layer": "клиентские утилиты",
        "summary": "Ход «Описать пачками» (docs/07-maps.md, «Описать всё пачками»): заходы один за другим, остановка на первом отказе."
      },
      {
        "id": "app/utils/duration.ts",
        "title": "duration",
        "layer": "клиентские утилиты",
        "summary": "«2 мин 22 с» — так, как это произносят вслух."
      },
      {
        "id": "app/utils/event-stream.ts",
        "title": "event-stream",
        "layer": "клиентские утилиты",
        "summary": "Чтение ленты событий сервера (docs/03-server-api.md) и складывание её в строки для экрана. Здесь только разбор — ни запросов, ни состояния."
      },
      {
        "id": "app/utils/facts.ts",
        "title": "facts",
        "layer": "клиентские утилиты",
        "summary": "Факт — результат прогона, а не решение человека (docs/04-ui.md, «Решение и факт»). «Подтверждён» — о статусе записи, «проверено» — только об этом файле."
      },
      {
        "id": "app/utils/functional-view.ts",
        "title": "functional-view",
        "layer": "клиентские утилиты",
        "summary": "Что экран знает о возможности функциональной карты сверх её полей: производное состояние, связи в обе стороны, «ждёт», цикл, приоритет, «освободит», влияние, покрытие процессом и признаки риска (docs/07-maps.md,…"
      },
      {
        "id": "app/utils/graph-layout.ts",
        "title": "graph-layout",
        "layer": "клиентские утилиты",
        "summary": "Укладка графа по слоям (ADR-0006). Чистая функция: одни и те же записи дают одну и ту же картинку, поэтому её видно тестом и она узнаваема при каждом открытии."
      },
      {
        "id": "app/utils/highlight.ts",
        "title": "highlight",
        "layer": "клиентские утилиты",
        "summary": "Подсветка синтаксиса для просмотра кода в карточке узла карты (`MapInspector.vue`). Shiki — те же грамматики и темы, что в VS Code:"
      },
      {
        "id": "app/utils/labels.ts",
        "title": "labels",
        "layer": "клиентские утилиты",
        "summary": "Язык интерфейса — русский (CLAUDE.md). Слова контракта остаются как есть в коде и переводятся только на экране."
      },
      {
        "id": "app/utils/map-mermaid.ts",
        "title": "map-mermaid",
        "layer": "клиентские утилиты",
        "summary": "Карты в текст mermaid. Тот же текст показывается на экране и выгружается, чтобы вставить его в документ проекта и перерисовывать в его сборке (docs/07-maps.md)."
      },
      {
        "id": "app/utils/nav-roles.ts",
        "title": "nav-roles",
        "layer": "клиентские утилиты",
        "summary": "Какие пункты шапки нужны какой роли (docs/04-ui.md, «Переключатель роли»). Это вид, а не право: права проверяет сервер (ADR-0020), а здесь шапка лишь не показывает того, что роли в работе не нужно."
      },
      {
        "id": "cli/add-user.ts",
        "title": "add-user",
        "layer": "командная строка",
        "summary": "Первый администратор для общего сервера (docs/adr/0020): пишет .data/users.json напрямую, потому что до первой учётки войти в API нечем. Использование:"
      },
      {
        "id": "cli/check.ts",
        "title": "check",
        "layer": "командная строка",
        "summary": "`docdd check <путь>` — вторая точка входа в то же ядро (docs/06-phases.md, фаза 6). Ничего не пишет: ни файлов, ни кэша — проверка в чужом конвейере не должна оставлять следов в чужом репозитории."
      },
      {
        "id": "cli/context-size.ts",
        "title": "context-size",
        "layer": "командная строка",
        "summary": "Замер размера запросов «до и после» пакета контекста (T-0031, ADR-0021, «Замер»). Модель не вызывается. Использование: tsx cli/context-size.ts [путь к проекту] [--task T-0031]"
      },
      {
        "id": "cli/embeddings.ts",
        "title": "embeddings",
        "layer": "командная строка",
        "summary": "Досчитать индекс смыслового поиска без консоли — для CI и сервера после обновления (docs/adr/0031-semantic-search.md). Без настроек моделей — локальный хеш-эмбеддинг: сеть и ключи не нужны."
      },
      {
        "id": "cli/perf.ts",
        "title": "perf",
        "layer": "командная строка",
        "summary": "Бюджет скорости страниц (R-0051): обходит страницы запущенной консоли, сравнивает с perf-budget.json и пишет отчёт проверок-метрик. Использование: tsx cli/perf.ts [--out <папка>] [--project <id>] [--base <url>]"
      },
      {
        "id": "cli/report.ts",
        "title": "report",
        "layer": "командная строка",
        "summary": "Вывод проверки. Чистые функции над индексом: в тесте нет ни процесса, ни терминала — только строки, которые человек прочитает в логе сборки."
      },
      {
        "id": "cli/start-built.ts",
        "title": "start-built",
        "layer": "командная строка",
        "summary": "Запуск собранной версии для ежедневной работы (R-0052). Сборку сам не делает: она долгая, и молча её запускать нельзя — честно говорим, что делать. Адрес фиксируем на 127.0.0.1: приложение не должно смотреть наружу."
      },
      {
        "id": "cli/synth.ts",
        "title": "synth",
        "layer": "командная строка",
        "summary": "Синтетический проект и замер (T-0046): tsx cli/synth.ts <папка> [--n 5000] [--keep] Создаёт проект из N записей, замеряет сборку индекса холодную и повторную."
      }
    ],
    "imports": [
      {
        "from": "cli/add-user.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "cli/add-user.ts",
          "line": 8,
          "fragment": "import { hashPassword, type UserAccount } from '../server/li"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/lib/prompt.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 7,
          "fragment": "import { fixPrompt, inboxPrompt, taskPrompt } from '../serve"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 8,
          "fragment": "import { buildProjectMap } from '../server/utils/map-service"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/utils/context-service.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 9,
          "fragment": "import { packExtra } from '../server/utils/context-service'"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 10,
          "fragment": "import { referenceIndexText } from '../server/utils/referenc"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 11,
          "fragment": "import { inboxNotes } from '../server/utils/inbox-service'"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 12,
          "fragment": "import { loadIndex } from '../server/utils/index-service'"
        }
      },
      {
        "from": "cli/context-size.ts",
        "to": "server/utils/work-service.ts",
        "evidence": {
          "path": "cli/context-size.ts",
          "line": 13,
          "fragment": "import { taskContext } from '../server/utils/work-service'"
        }
      },
      {
        "from": "cli/embeddings.ts",
        "to": "server/utils/semantic-service.ts",
        "evidence": {
          "path": "cli/embeddings.ts",
          "line": 1,
          "fragment": "import { ensureIndex } from '../server/utils/semantic-servic"
        }
      },
      {
        "from": "cli/synth.ts",
        "to": "server/lib/indexer.ts",
        "evidence": {
          "path": "cli/synth.ts",
          "line": 7,
          "fragment": "import { buildIndex } from '../server/lib/indexer';"
        }
      },
      {
        "from": "cli/synth.ts",
        "to": "server/lib/scaffold.ts",
        "evidence": {
          "path": "cli/synth.ts",
          "line": 8,
          "fragment": "import { DEFAULT_PATHS, manifestYaml, recordTemplate } from "
        }
      },
      {
        "from": "app/components/AgentsPanel.vue",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "app/components/AgentsPanel.vue",
          "line": 2,
          "fragment": "import type { AgentDef, AgentType } from '~~/server/lib/agen"
        }
      },
      {
        "from": "app/components/ArchitectureAudit.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ArchitectureAudit.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ArchitectureAudit.vue",
        "to": "server/lib/architecture.ts",
        "evidence": {
          "path": "app/components/ArchitectureAudit.vue",
          "line": 3,
          "fragment": "import { AUDIT_KIND_LABEL, type AuditResult } from '../../se"
        }
      },
      {
        "from": "app/components/ArchitectureNote.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ArchitectureNote.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ArchitectureNote.vue",
        "to": "server/lib/architecture.ts",
        "evidence": {
          "path": "app/components/ArchitectureNote.vue",
          "line": 3,
          "fragment": "import { fixTaskOf, selectionState } from '../../server/lib/"
        }
      },
      {
        "from": "app/components/AsIsPanel.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/AsIsPanel.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/AsIsPanel.vue",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "app/components/AsIsPanel.vue",
          "line": 3,
          "fragment": "import type { ProposedRecord } from '~~/server/lib/inbox';"
        }
      },
      {
        "from": "app/components/BehindMarks.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/BehindMarks.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/BehindMarks.vue",
        "to": "server/lib/coverage.ts",
        "evidence": {
          "path": "app/components/BehindMarks.vue",
          "line": 3,
          "fragment": "import type { BehindProposal } from '~~/server/lib/coverage'"
        }
      },
      {
        "from": "app/components/BulkBar.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/BulkBar.vue",
          "line": 2,
          "fragment": "import type { ApiFailure, BulkMoved } from '~/composables/us"
        }
      },
      {
        "from": "app/components/BulkBar.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/BulkBar.vue",
          "line": 3,
          "fragment": "import type { IndexRecord, IssueDto } from '~~/server/lib/ty"
        }
      },
      {
        "from": "app/components/ChecksPanel.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ChecksPanel.vue",
          "line": 2,
          "fragment": "import type { BulkMoved } from '~/composables/useProjectInde"
        }
      },
      {
        "from": "app/components/ChecksPanel.vue",
        "to": "server/lib/verify-desk.ts",
        "evidence": {
          "path": "app/components/ChecksPanel.vue",
          "line": 3,
          "fragment": "import { FACTS, NO_ASSIGNEE, byAssignee, factCounts, factOf,"
        }
      },
      {
        "from": "app/components/ContextPreview.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ContextPreview.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/CourseHistory.vue",
        "to": "server/lib/course.ts",
        "evidence": {
          "path": "app/components/CourseHistory.vue",
          "line": 2,
          "fragment": "import type { CourseEntry } from '~~/server/lib/course';"
        }
      },
      {
        "from": "app/components/CustomMapForm.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/CustomMapForm.vue",
          "line": 4,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/CustomMapForm.vue",
        "to": "server/lib/scaffold.ts",
        "evidence": {
          "path": "app/components/CustomMapForm.vue",
          "line": 5,
          "fragment": "import { slugify } from '~~/server/lib/scaffold';"
        }
      },
      {
        "from": "app/components/CustomMapForm.vue",
        "to": "server/lib/role-maps.ts",
        "evidence": {
          "path": "app/components/CustomMapForm.vue",
          "line": 6,
          "fragment": "import { ROLE_MAP_TEMPLATES, type RoleMapTemplate } from '~~"
        }
      },
      {
        "from": "app/components/CustomMapForm.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/CustomMapForm.vue",
          "line": 7,
          "fragment": "import type { CustomMapDefinition, CustomMapFeature, CustomR"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 23,
          "fragment": "} from '~~/server/lib/functional';"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 24,
          "fragment": "import { ancestors, depthOf } from '~~/server/lib/hierarchy'"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "server/lib/scaffold.ts",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 25,
          "fragment": "import { slugify } from '~~/server/lib/scaffold';"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 26,
          "fragment": "import type { CustomNodeView, CustomRelationView } from '~~/"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 27,
          "fragment": "import type { CustomMapDefinition } from '~~/server/lib/type"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 28,
          "fragment": "import { functionalMermaid, fromNodeId, type FunctionalMode,"
        }
      },
      {
        "from": "app/components/CustomMapView.vue",
        "to": "app/components/FunctionalTreeNode.vue",
        "evidence": {
          "path": "app/components/CustomMapView.vue",
          "line": 29,
          "fragment": "import type { Capability } from './FunctionalTreeNode.vue';"
        }
      },
      {
        "from": "app/components/DefectFromCheck.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/DefectFromCheck.vue",
          "line": 2,
          "fragment": "import type { IndexRecord, VerificationOutcome } from '~~/se"
        }
      },
      {
        "from": "app/components/DesignComponents.vue",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "app/components/DesignComponents.vue",
          "line": 2,
          "fragment": "import { COMPONENT_NAMES, type DesignTokens } from '~~/serve"
        }
      },
      {
        "from": "app/components/DesignComponents.vue",
        "to": "server/lib/design-contract.ts",
        "evidence": {
          "path": "app/components/DesignComponents.vue",
          "line": 3,
          "fragment": "import type { ContractProp } from '~~/server/lib/design-cont"
        }
      },
      {
        "from": "app/components/DesignComponents.vue",
        "to": "server/lib/design-catalog.ts",
        "evidence": {
          "path": "app/components/DesignComponents.vue",
          "line": 4,
          "fragment": "import type { CatalogReport } from '~~/server/lib/design-cat"
        }
      },
      {
        "from": "app/components/DesignConstructors.vue",
        "to": "server/lib/design-constructors.ts",
        "evidence": {
          "path": "app/components/DesignConstructors.vue",
          "line": 8,
          "fragment": "} from '~~/server/lib/design-constructors';"
        }
      },
      {
        "from": "app/components/DesignConstructors.vue",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "app/components/DesignConstructors.vue",
          "line": 9,
          "fragment": "import { STACK_IDS, STACK_LABEL, type StackId } from '~~/ser"
        }
      },
      {
        "from": "app/components/DesignDiff.vue",
        "to": "server/lib/design-diff.ts",
        "evidence": {
          "path": "app/components/DesignDiff.vue",
          "line": 2,
          "fragment": "import type { DesignDiff } from '~~/server/lib/design-diff';"
        }
      },
      {
        "from": "app/components/DesignFigma.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/DesignFigma.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/DesignFigma.vue",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "app/components/DesignFigma.vue",
          "line": 3,
          "fragment": "import { plainTokens, type DesignTokens } from '~~/server/li"
        }
      },
      {
        "from": "app/components/DesignFigma.vue",
        "to": "server/lib/design-figma.ts",
        "evidence": {
          "path": "app/components/DesignFigma.vue",
          "line": 4,
          "fragment": "import { diffAgainst, figmaBlockText, parseFigmaVariables } "
        }
      },
      {
        "from": "app/components/DesignScreens.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/DesignScreens.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/DesignScreens.vue",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "app/components/DesignScreens.vue",
          "line": 3,
          "fragment": "import type { FindingsOutcome, ScreenPass } from '~~/server/"
        }
      },
      {
        "from": "app/components/DesignScreens.vue",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "app/components/DesignScreens.vue",
          "line": 4,
          "fragment": "import type { ScreensReport } from '~~/server/utils/design-s"
        }
      },
      {
        "from": "app/components/DesignStacks.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/DesignStacks.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/DesignStacks.vue",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "app/components/DesignStacks.vue",
          "line": 3,
          "fragment": "import type { StackReport } from '~~/server/utils/design-ser"
        }
      },
      {
        "from": "app/components/DesignThemeBuilder.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/DesignThemeBuilder.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/DesignThemeBuilder.vue",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "app/components/DesignThemeBuilder.vue",
          "line": 3,
          "fragment": "import { MIN_CONTRAST, PALETTE_ROLES, paletteColorPractice, "
        }
      },
      {
        "from": "app/components/DesignThemeBuilder.vue",
        "to": "server/lib/design-theme.ts",
        "evidence": {
          "path": "app/components/DesignThemeBuilder.vue",
          "line": 10,
          "fragment": "} from '~~/server/lib/design-theme';"
        }
      },
      {
        "from": "app/components/DesignTokens.vue",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "app/components/DesignTokens.vue",
          "line": 19,
          "fragment": "} from '~~/server/lib/design';"
        }
      },
      {
        "from": "app/components/DesignTokens.vue",
        "to": "server/lib/design-surface.ts",
        "evidence": {
          "path": "app/components/DesignTokens.vue",
          "line": 20,
          "fragment": "import { backdropValue, elevationValue, parseSurface } from "
        }
      },
      {
        "from": "app/components/ExternalImportPanel.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ExternalImportPanel.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ExternalImportPanel.vue",
        "to": "server/lib/external-import.ts",
        "evidence": {
          "path": "app/components/ExternalImportPanel.vue",
          "line": 3,
          "fragment": "import { confluenceNotes, jiraNotes, parseJira } from '~~/se"
        }
      },
      {
        "from": "app/components/FixWork.vue",
        "to": "server/lib/fix-diff.ts",
        "evidence": {
          "path": "app/components/FixWork.vue",
          "line": 80,
          "fragment": "import { fixDiff } from '~~/server/lib/fix-diff';"
        }
      },
      {
        "from": "app/components/FunctionalCheck.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/FunctionalCheck.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/FunctionalCheck.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalCheck.vue",
          "line": 3,
          "fragment": "import { IMPL_LABEL, type FunctionalCheckResult, type ImplSt"
        }
      },
      {
        "from": "app/components/FunctionalGraphBar.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalGraphBar.vue",
          "line": 11,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/components/FunctionalGraphBar.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/FunctionalGraphBar.vue",
          "line": 12,
          "fragment": "import { FUNCTIONAL_MODE_LABEL, type FunctionalLevel, type F"
        }
      },
      {
        "from": "app/components/FunctionalLegendBar.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/FunctionalLegendBar.vue",
          "line": 2,
          "fragment": "import type { FunctionalLegend } from '~/utils/map-mermaid';"
        }
      },
      {
        "from": "app/components/FunctionalNext.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalNext.vue",
          "line": 8,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/components/FunctionalRelations.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/FunctionalRelations.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/FunctionalRelations.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalRelations.vue",
          "line": 3,
          "fragment": "import { RELATION_LABEL, type RelationItem, type RelationsRe"
        }
      },
      {
        "from": "app/components/FunctionalSummary.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalSummary.vue",
          "line": 2,
          "fragment": "import { IMPL_LABEL, type Progress, type StatusFilter } from"
        }
      },
      {
        "from": "app/components/FunctionalSummary.vue",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/components/FunctionalSummary.vue",
          "line": 3,
          "fragment": "import { STATUS_STYLE } from '~/utils/functional-view';"
        }
      },
      {
        "from": "app/components/FunctionalTree.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/FunctionalTree.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/FunctionalTree.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/FunctionalTree.vue",
          "line": 4,
          "fragment": "import type { MapSelection } from '~/utils/map-mermaid';"
        }
      },
      {
        "from": "app/components/FunctionalTree.vue",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/components/FunctionalTree.vue",
          "line": 5,
          "fragment": "import { capabilityViews } from '~/utils/functional-view';"
        }
      },
      {
        "from": "app/components/FunctionalTree.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalTree.vue",
          "line": 28,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/components/FunctionalTreeNode.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/FunctionalTreeNode.vue",
          "line": 10,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/components/FunctionalTreeNode.vue",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/components/FunctionalTreeNode.vue",
          "line": 11,
          "fragment": "import { RISK_LABEL, STATUS_STYLE, statusText, tasksText, ty"
        }
      },
      {
        "from": "app/components/ManagerAssistant.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/ManagerAssistant.vue",
          "line": 2,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/ManagerAssistant.vue",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "app/components/ManagerAssistant.vue",
          "line": 3,
          "fragment": "import { assistantPrompt, type AssistantQuestion } from '~~/"
        }
      },
      {
        "from": "app/components/ManagerBoard.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ManagerBoard.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ManagerBoard.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/ManagerBoard.vue",
          "line": 3,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/ManagerBoard.vue",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "app/components/ManagerBoard.vue",
          "line": 4,
          "fragment": "import { BOARD_COLUMNS, NO_ASSIGNEE, STATUS_WORD, boardColum"
        }
      },
      {
        "from": "app/components/ManagerBoard.vue",
        "to": "server/lib/reviewer.ts",
        "evidence": {
          "path": "app/components/ManagerBoard.vue",
          "line": 5,
          "fragment": "import { reviewerOf, roleName } from '~~/server/lib/reviewer"
        }
      },
      {
        "from": "app/components/ManagerRoadmap.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ManagerRoadmap.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ManagerRoadmap.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/ManagerRoadmap.vue",
          "line": 3,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/ManagerRoadmap.vue",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "app/components/ManagerRoadmap.vue",
          "line": 4,
          "fragment": "import { roadmap, type RoadmapPhase } from '~~/server/lib/ma"
        }
      },
      {
        "from": "app/components/ManagerSummary.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/ManagerSummary.vue",
          "line": 2,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/ManagerSummary.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/ManagerSummary.vue",
          "line": 3,
          "fragment": "import type { CapabilityLike } from '~~/server/lib/functiona"
        }
      },
      {
        "from": "app/components/ManagerSummary.vue",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "app/components/ManagerSummary.vue",
          "line": 4,
          "fragment": "import { customerSummary, roadmap } from '~~/server/lib/mana"
        }
      },
      {
        "from": "app/components/ManualAcceptModal.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ManualAcceptModal.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ManualAcceptModal.vue",
        "to": "server/lib/reviewer.ts",
        "evidence": {
          "path": "app/components/ManualAcceptModal.vue",
          "line": 3,
          "fragment": "import { reviewerOf } from '~~/server/lib/reviewer';"
        }
      },
      {
        "from": "app/components/ManualAcceptModal.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/ManualAcceptModal.vue",
          "line": 4,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/ManualAcceptModal.vue",
        "to": "server/lib/manual-report.ts",
        "evidence": {
          "path": "app/components/ManualAcceptModal.vue",
          "line": 5,
          "fragment": "import { parseCheckSteps } from '~~/server/lib/manual-report"
        }
      },
      {
        "from": "app/components/MapBatchDescribe.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/MapBatchDescribe.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/MapBatchDescribe.vue",
        "to": "app/stores/modelJobs.ts",
        "evidence": {
          "path": "app/components/MapBatchDescribe.vue",
          "line": 3,
          "fragment": "import { useModelJobs } from '~/stores/modelJobs';"
        }
      },
      {
        "from": "app/components/MapBatchDescribe.vue",
        "to": "app/utils/batch-describe.ts",
        "evidence": {
          "path": "app/components/MapBatchDescribe.vue",
          "line": 4,
          "fragment": "import { describeBatch, type BatchStep } from '~/utils/batch"
        }
      },
      {
        "from": "app/components/MapBatchDescribe.vue",
        "to": "server/lib/inventory.ts",
        "evidence": {
          "path": "app/components/MapBatchDescribe.vue",
          "line": 5,
          "fragment": "import { MAX_REQUEST_FILES, batchPlan } from '../../server/l"
        }
      },
      {
        "from": "app/components/MapDepthBar.vue",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "app/components/MapDepthBar.vue",
          "line": 5,
          "fragment": "import { ancestors, maxDepth, type TreeNode } from '~~/serve"
        }
      },
      {
        "from": "app/components/MapDepthBar.vue",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "app/components/MapDepthBar.vue",
          "line": 6,
          "fragment": "import { groupTree, type DeclaredGroup, type GroupImport, ty"
        }
      },
      {
        "from": "app/components/MapDiff.vue",
        "to": "server/lib/map-diff.ts",
        "evidence": {
          "path": "app/components/MapDiff.vue",
          "line": 2,
          "fragment": "import { atLevel, countsText, diffCounts, onlyChangedIds, ty"
        }
      },
      {
        "from": "app/components/MapDiff.vue",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "app/components/MapDiff.vue",
          "line": 3,
          "fragment": "import { maxDepth, depthOf } from '~~/server/lib/hierarchy';"
        }
      },
      {
        "from": "app/components/MapInspector.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/components/MapInspector.vue",
          "line": 6,
          "fragment": "import { COVERAGE_LABEL, HORIZON_LABEL, PRIORITY_LABEL, cros"
        }
      },
      {
        "from": "app/components/MapInspector.vue",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/components/MapInspector.vue",
          "line": 7,
          "fragment": "import { RISK_LABEL, STATUS_STYLE, statusText, type Capabili"
        }
      },
      {
        "from": "app/components/MapLegendBar.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/MapLegendBar.vue",
          "line": 2,
          "fragment": "import type { MapLegendItem } from '~/utils/map-mermaid';"
        }
      },
      {
        "from": "app/components/MapRecordsCard.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/MapRecordsCard.vue",
          "line": 2,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/MapSplitHints.vue",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "app/components/MapSplitHints.vue",
          "line": 4,
          "fragment": "import { cyclesAt, foldEdges, splitHints, splitHintTexts, vi"
        }
      },
      {
        "from": "app/components/ModelJobsBar.vue",
        "to": "app/stores/modelJobs.ts",
        "evidence": {
          "path": "app/components/ModelJobsBar.vue",
          "line": 2,
          "fragment": "import { useModelJobs } from '~/stores/modelJobs';"
        }
      },
      {
        "from": "app/components/OnboardingChecklist.vue",
        "to": "server/lib/onboarding.ts",
        "evidence": {
          "path": "app/components/OnboardingChecklist.vue",
          "line": 2,
          "fragment": "import type { Readiness, Step, StepResult } from '~~/server/"
        }
      },
      {
        "from": "app/components/OrderDiff.vue",
        "to": "server/lib/order-diff.ts",
        "evidence": {
          "path": "app/components/OrderDiff.vue",
          "line": 2,
          "fragment": "import { orderDiff, type OrderGroup } from '~~/server/lib/or"
        }
      },
      {
        "from": "app/components/OverallProgress.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/OverallProgress.vue",
          "line": 2,
          "fragment": "import type { IndexRecord } from '../../server/lib/types';"
        }
      },
      {
        "from": "app/components/PhasePlan.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/PhasePlan.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/PhasePlanner.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/PhasePlanner.vue",
          "line": 2,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/PhasePlanner.vue",
        "to": "server/lib/phase-plan.ts",
        "evidence": {
          "path": "app/components/PhasePlanner.vue",
          "line": 3,
          "fragment": "import { phaseCandidates } from '~~/server/lib/phase-plan';"
        }
      },
      {
        "from": "app/components/PhasesPanel.vue",
        "to": "server/lib/work-order.ts",
        "evidence": {
          "path": "app/components/PhasesPanel.vue",
          "line": 2,
          "fragment": "import { rankOf, sortPhases } from '~~/server/lib/work-order"
        }
      },
      {
        "from": "app/components/PhasesPanel.vue",
        "to": "app/utils/phases.ts",
        "evidence": {
          "path": "app/components/PhasesPanel.vue",
          "line": 3,
          "fragment": "import { matchesPhaseFilter, parsePhaseFilter, PHASE_FILTERS"
        }
      },
      {
        "from": "app/components/PracticeRules.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/PracticeRules.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/PriorityPreview.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/PriorityPreview.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/ProjectDashboard.vue",
        "to": "server/lib/overview.ts",
        "evidence": {
          "path": "app/components/ProjectDashboard.vue",
          "line": 2,
          "fragment": "import { buildOverview, type PhaseStage } from '~~/server/li"
        }
      },
      {
        "from": "app/components/ProjectDashboard.vue",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "app/components/ProjectDashboard.vue",
          "line": 3,
          "fragment": "import type { ProjectMap } from '~~/server/lib/maps';"
        }
      },
      {
        "from": "app/components/RecordCriteria.vue",
        "to": "server/lib/criteria.ts",
        "evidence": {
          "path": "app/components/RecordCriteria.vue",
          "line": 2,
          "fragment": "import { draftsFromCriteria, parseCriteria } from '~~/server"
        }
      },
      {
        "from": "app/components/RecordCriteria.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/RecordCriteria.vue",
          "line": 3,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/RecordDiff.vue",
        "to": "server/lib/record-diff.ts",
        "evidence": {
          "path": "app/components/RecordDiff.vue",
          "line": 2,
          "fragment": "import type { RecordDiff } from '~~/server/lib/record-diff';"
        }
      },
      {
        "from": "app/components/ReviewBatchPrompt.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/ReviewBatchPrompt.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/RunPanel.vue",
        "to": "server/lib/verify-desk.ts",
        "evidence": {
          "path": "app/components/RunPanel.vue",
          "line": 2,
          "fragment": "import { NO_ASSIGNEE, byAssignee, factOf, kindOf, type Fact "
        }
      },
      {
        "from": "app/components/SettingsDialog.vue",
        "to": "app/components/AutoHeight.vue",
        "evidence": {
          "path": "app/components/SettingsDialog.vue",
          "line": 2,
          "fragment": "import AutoHeight from '~/components/AutoHeight.vue';"
        }
      },
      {
        "from": "app/components/SettingsDialog.vue",
        "to": "app/pages/models.vue",
        "evidence": {
          "path": "app/components/SettingsDialog.vue",
          "line": 3,
          "fragment": "import ModelsPage from '~/pages/models.vue';"
        }
      },
      {
        "from": "app/components/SettingsDialog.vue",
        "to": "app/components/AgentsPanel.vue",
        "evidence": {
          "path": "app/components/SettingsDialog.vue",
          "line": 4,
          "fragment": "import AgentsPanel from '~/components/AgentsPanel.vue';"
        }
      },
      {
        "from": "app/components/SettingsDialog.vue",
        "to": "app/pages/people.vue",
        "evidence": {
          "path": "app/components/SettingsDialog.vue",
          "line": 5,
          "fragment": "import PeoplePage from '~/pages/people.vue';"
        }
      },
      {
        "from": "app/components/SettingsDialog.vue",
        "to": "server/lib/permissions.ts",
        "evidence": {
          "path": "app/components/SettingsDialog.vue",
          "line": 6,
          "fragment": "import { ALL_ACTIONS, ROLE_ACTIONS } from '~~/server/lib/per"
        }
      },
      {
        "from": "app/components/SourcesFinder.vue",
        "to": "server/lib/source-detect.ts",
        "evidence": {
          "path": "app/components/SourcesFinder.vue",
          "line": 2,
          "fragment": "import type { FileFinding, FolderFinding } from '~~/server/l"
        }
      },
      {
        "from": "app/components/StrategyIntent.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/StrategyIntent.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/StrategyIntent.vue",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "app/components/StrategyIntent.vue",
          "line": 3,
          "fragment": "import type { ProposedRecord } from '~~/server/lib/inbox';"
        }
      },
      {
        "from": "app/components/StrategyIntent.vue",
        "to": "server/lib/prompt.ts",
        "evidence": {
          "path": "app/components/StrategyIntent.vue",
          "line": 4,
          "fragment": "import { offVector } from '~~/server/lib/prompt';"
        }
      },
      {
        "from": "app/components/TaskAssignee.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/TaskAssignee.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/TaskAssignee.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/TaskAssignee.vue",
          "line": 3,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/TaskRequirement.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/TaskRequirement.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/TaskRequirement.vue",
        "to": "server/lib/task-order.ts",
        "evidence": {
          "path": "app/components/TaskRequirement.vue",
          "line": 3,
          "fragment": "import { lacksRequirement, requirementChoices, unapprovedReq"
        }
      },
      {
        "from": "app/components/TaskRequirement.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/TaskRequirement.vue",
          "line": 4,
          "fragment": "import type { IndexRecord, RecordAction } from '~~/server/li"
        }
      },
      {
        "from": "app/components/TaskReuse.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/TaskReuse.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/TaskReuse.vue",
        "to": "server/lib/task-order.ts",
        "evidence": {
          "path": "app/components/TaskReuse.vue",
          "line": 3,
          "fragment": "import { referenceChoices, withReuses } from '~~/server/lib/"
        }
      },
      {
        "from": "app/components/TaskReuse.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/TaskReuse.vue",
          "line": 4,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/TaskReviewer.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/TaskReviewer.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/TaskReviewer.vue",
        "to": "server/lib/reviewer.ts",
        "evidence": {
          "path": "app/components/TaskReviewer.vue",
          "line": 3,
          "fragment": "import { reviewerOf, roleName } from '~~/server/lib/reviewer"
        }
      },
      {
        "from": "app/components/TaskReviewer.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/TaskReviewer.vue",
          "line": 4,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/components/TasksPanel.vue",
        "to": "server/lib/work-order.ts",
        "evidence": {
          "path": "app/components/TasksPanel.vue",
          "line": 2,
          "fragment": "import { sortTasks } from '~~/server/lib/work-order';"
        }
      },
      {
        "from": "app/components/TestChecksPanel.vue",
        "to": "server/lib/test-checks.ts",
        "evidence": {
          "path": "app/components/TestChecksPanel.vue",
          "line": 2,
          "fragment": "import type { Coverage, TestMatch } from '~~/server/lib/test"
        }
      },
      {
        "from": "app/components/TestChecksPanel.vue",
        "to": "server/lib/source-detect.ts",
        "evidence": {
          "path": "app/components/TestChecksPanel.vue",
          "line": 3,
          "fragment": "import type { FileFinding } from '~~/server/lib/source-detec"
        }
      },
      {
        "from": "app/components/VerificationCard.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/VerificationCard.vue",
          "line": 2,
          "fragment": "import type { IndexRecord, ProjectIndex } from '~~/server/li"
        }
      },
      {
        "from": "app/components/VerificationCard.vue",
        "to": "server/lib/attachments.ts",
        "evidence": {
          "path": "app/components/VerificationCard.vue",
          "line": 3,
          "fragment": "import { attachmentKind } from '~~/server/lib/attachments';"
        }
      },
      {
        "from": "app/components/VerificationCard.vue",
        "to": "server/lib/verify-desk.ts",
        "evidence": {
          "path": "app/components/VerificationCard.vue",
          "line": 4,
          "fragment": "import { assigneeOf, kindOf, runHistory } from '~~/server/li"
        }
      },
      {
        "from": "app/components/VerifiedCheck.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/VerifiedCheck.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/VerifiedCheck.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/components/VerifiedCheck.vue",
          "line": 3,
          "fragment": "import type { IndexRecord, VerificationOutcome } from '~~/se"
        }
      },
      {
        "from": "app/components/VisionCard.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/components/VisionCard.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/components/VisionCard.vue",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "app/components/VisionCard.vue",
          "line": 3,
          "fragment": "import type { Vision } from '~~/server/lib/maps';"
        }
      },
      {
        "from": "app/composables/useModelRequest.ts",
        "to": "app/stores/modelJobs.ts",
        "evidence": {
          "path": "app/composables/useModelRequest.ts",
          "line": 2,
          "fragment": "import { useModelJobs, type JobMeta } from '~/stores/modelJo"
        }
      },
      {
        "from": "app/composables/useOrderMode.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/composables/useOrderMode.ts",
          "line": 1,
          "fragment": "import type { IndexRecord } from '~~/server/lib/types';"
        }
      },
      {
        "from": "app/composables/useOrderMode.ts",
        "to": "server/lib/work-order.ts",
        "evidence": {
          "path": "app/composables/useOrderMode.ts",
          "line": 2,
          "fragment": "import { hasRanks, type OrderMode } from '~~/server/lib/work"
        }
      },
      {
        "from": "app/composables/useT.ts",
        "to": "app/design-tokens.ts",
        "evidence": {
          "path": "app/composables/useT.ts",
          "line": 1,
          "fragment": "import { designTokens } from '~/design-tokens';"
        }
      },
      {
        "from": "app/composables/useT.ts",
        "to": "app/i18n/index.ts",
        "evidence": {
          "path": "app/composables/useT.ts",
          "line": 2,
          "fragment": "import { messages } from '~/i18n/index';"
        }
      },
      {
        "from": "app/composables/useT.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/composables/useT.ts",
          "line": 3,
          "fragment": "import { setTrLocale } from '~/i18n/tr';"
        }
      },
      {
        "from": "app/composables/useTaskReviewers.ts",
        "to": "server/lib/reviewer.ts",
        "evidence": {
          "path": "app/composables/useTaskReviewers.ts",
          "line": 2,
          "fragment": "import { buildRecordsLookup, reviewerOf, roleName, type Revi"
        }
      },
      {
        "from": "app/composables/useTaskReviewers.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/composables/useTaskReviewers.ts",
          "line": 3,
          "fragment": "import type { IndexRecord, ProjectIndex } from '~~/server/li"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/design.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 1,
          "fragment": "import { design as enDesign } from './en/design';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/shell.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 2,
          "fragment": "import { shell as enShell } from './en/shell';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/design.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 3,
          "fragment": "import { design as ruDesign } from './ru/design';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/shell.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 4,
          "fragment": "import { shell as ruShell } from './ru/shell';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/screens.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 5,
          "fragment": "import { screens as enScreens } from './en/screens';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/screens.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 6,
          "fragment": "import { screens as ruScreens } from './ru/screens';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/pages.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 18,
          "fragment": "import { pages as enPages } from './en/pages';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/pages.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 19,
          "fragment": "import { pages as ruPages } from './ru/pages';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/rest.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 20,
          "fragment": "import { rest as enRest } from './en/rest';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/rest.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 21,
          "fragment": "import { rest as ruRest } from './ru/rest';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/records.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 22,
          "fragment": "import { records as enRecords } from './en/records';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/records.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 23,
          "fragment": "import { records as ruRecords } from './ru/records';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/pages2.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 24,
          "fragment": "import { pages2 as enPages2 } from './en/pages2';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/pages2.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 25,
          "fragment": "import { pages2 as ruPages2 } from './ru/pages2';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/components.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 26,
          "fragment": "import { components as enComponents } from './en/components'"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/components.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 27,
          "fragment": "import { components as ruComponents } from './ru/components'"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/nav.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 28,
          "fragment": "import { nav as enNav } from './en/nav';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/nav.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 29,
          "fragment": "import { nav as ruNav } from './ru/nav';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/overview.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 30,
          "fragment": "import { overview as enOverview } from './en/overview';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/overview.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 31,
          "fragment": "import { overview as ruOverview } from './ru/overview';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/search.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 32,
          "fragment": "import { search as enSearch } from './en/search';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/search.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 33,
          "fragment": "import { search as ruSearch } from './ru/search';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/settings.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 34,
          "fragment": "import { settings as enSettings } from './en/settings';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/settings.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 35,
          "fragment": "import { settings as ruSettings } from './ru/settings';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/notifications.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 36,
          "fragment": "import { notifications as enNotifications } from './en/notif"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/notifications.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 37,
          "fragment": "import { notifications as ruNotifications } from './ru/notif"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/manager.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 38,
          "fragment": "import { manager as enManager } from './en/manager';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/manager.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 39,
          "fragment": "import { manager as ruManager } from './ru/manager';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/verify.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 40,
          "fragment": "import { verify as enVerify } from './en/verify';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/verify.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 41,
          "fragment": "import { verify as ruVerify } from './ru/verify';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/strategy.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 42,
          "fragment": "import { strategy as enStrategy } from './en/strategy';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/strategy.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 43,
          "fragment": "import { strategy as ruStrategy } from './ru/strategy';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/agents.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 44,
          "fragment": "import { agents as enAgents } from './en/agents';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/agents.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 45,
          "fragment": "import { agents as ruAgents } from './ru/agents';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/onboarding.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 46,
          "fragment": "import { onboarding as enOnboarding } from './en/onboarding'"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/onboarding.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 47,
          "fragment": "import { onboarding as ruOnboarding } from './ru/onboarding'"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/ui-maps.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 48,
          "fragment": "import { uiMaps as enUiMaps } from './en/ui-maps';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/ui-maps.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 49,
          "fragment": "import { uiMaps as ruUiMaps } from './ru/ui-maps';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/ui-inbox.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 50,
          "fragment": "import { uiInbox as enUiInbox } from './en/ui-inbox';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/ui-inbox.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 51,
          "fragment": "import { uiInbox as ruUiInbox } from './ru/ui-inbox';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/ui-rest.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 52,
          "fragment": "import { uiRest as enUiRest } from './en/ui-rest';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/ui-rest.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 53,
          "fragment": "import { uiRest as ruUiRest } from './ru/ui-rest';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/ui-utils.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 54,
          "fragment": "import { uiUtils as enUiUtils } from './en/ui-utils';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/ui-utils.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 55,
          "fragment": "import { uiUtils as ruUiUtils } from './ru/ui-utils';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/ui-mermaid.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 56,
          "fragment": "import { uiMermaid as enUiMermaid } from './en/ui-mermaid';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/ui-mermaid.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 57,
          "fragment": "import { uiMermaid as ruUiMermaid } from './ru/ui-mermaid';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/en/ui-last.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 58,
          "fragment": "import { uiLast as enUiLast } from './en/ui-last';"
        }
      },
      {
        "from": "app/i18n/index.ts",
        "to": "app/i18n/ru/ui-last.ts",
        "evidence": {
          "path": "app/i18n/index.ts",
          "line": 59,
          "fragment": "import { uiLast as ruUiLast } from './ru/ui-last';"
        }
      },
      {
        "from": "app/i18n/tr.ts",
        "to": "app/i18n/index.ts",
        "evidence": {
          "path": "app/i18n/tr.ts",
          "line": 1,
          "fragment": "import { messages } from './index';"
        }
      },
      {
        "from": "app/layouts/default.vue",
        "to": "app/design-tokens.ts",
        "evidence": {
          "path": "app/layouts/default.vue",
          "line": 2,
          "fragment": "import { designTokens } from '~/design-tokens';"
        }
      },
      {
        "from": "app/layouts/default.vue",
        "to": "app/components/GlobalSearch.vue",
        "evidence": {
          "path": "app/layouts/default.vue",
          "line": 4,
          "fragment": "import GlobalSearch from '~/components/GlobalSearch.vue';"
        }
      },
      {
        "from": "app/layouts/default.vue",
        "to": "app/components/SettingsDialog.vue",
        "evidence": {
          "path": "app/layouts/default.vue",
          "line": 5,
          "fragment": "import SettingsDialog from '~/components/SettingsDialog.vue'"
        }
      },
      {
        "from": "app/pages/design.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/pages/design.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/pages/design.vue",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "app/pages/design.vue",
          "line": 3,
          "fragment": "import type { ContrastRow, DesignCheck, DesignTokens } from "
        }
      },
      {
        "from": "app/pages/portfolio.vue",
        "to": "server/lib/portfolio.ts",
        "evidence": {
          "path": "app/pages/portfolio.vue",
          "line": 3,
          "fragment": "import type { PortfolioRow } from '~~/server/lib/portfolio';"
        }
      },
      {
        "from": "app/pages/projects/[id]/analyst.vue",
        "to": "server/lib/analyst.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/analyst.vue",
          "line": 2,
          "fragment": "import type { AnalystMode } from '~~/server/lib/analyst';"
        }
      },
      {
        "from": "app/pages/projects/[id]/design.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/design.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/pages/projects/[id]/design.vue",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/design.vue",
          "line": 3,
          "fragment": "import type { ContrastRow, DesignCheck, DesignTokens } from "
        }
      },
      {
        "from": "app/pages/projects/[id]/design.vue",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/design.vue",
          "line": 4,
          "fragment": "import type { StackId } from '~~/server/lib/design-export';"
        }
      },
      {
        "from": "app/pages/projects/[id]/glossary.vue",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/glossary.vue",
          "line": 2,
          "fragment": "import type { GlossaryTerm } from '~~/server/lib/glossary';"
        }
      },
      {
        "from": "app/pages/projects/[id]/knowledge.vue",
        "to": "server/lib/knowledge.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/knowledge.vue",
          "line": 2,
          "fragment": "import type { KnowledgeNode } from '~~/server/lib/knowledge'"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 4,
          "fragment": "import { capabilityViews } from '~/utils/functional-view'; i"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 22,
          "fragment": "} from '~~/server/lib/functional';"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/flow-groups.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 31,
          "fragment": "} from '~~/server/lib/flow-groups';"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 32,
          "fragment": "import { ghostNeighbors, groupCard, groupModules, groupScope"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/layers.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 33,
          "fragment": "import { layerOf } from '~~/server/lib/layers';"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 841,
          "fragment": "import { ancestors, visibleAt, type Edge as HierarchyEdge, t"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 1261,
          "fragment": "import type { CustomMapView as CustomMapContent } from '~~/s"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 1262,
          "fragment": "import type { CustomMapDefinition } from '~~/server/lib/type"
        }
      },
      {
        "from": "app/pages/projects/[id]/reference.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/reference.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/pages/projects/[id]/reference.vue",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/reference.vue",
          "line": 3,
          "fragment": "import type { ReferenceReport } from '~~/server/utils/refere"
        }
      },
      {
        "from": "app/pages/projects/[id]/releases.vue",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/releases.vue",
          "line": 2,
          "fragment": "import { unshippedTasks } from '~~/server/lib/manager';"
        }
      },
      {
        "from": "app/pages/projects/[id]/search.vue",
        "to": "server/lib/search.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/search.vue",
          "line": 2,
          "fragment": "import type { SearchHit } from '~~/server/lib/search';"
        }
      },
      {
        "from": "app/pages/projects/[id]/strategy.vue",
        "to": "app/pages/projects/[id]/maps.vue",
        "evidence": {
          "path": "app/pages/projects/[id]/strategy.vue",
          "line": 2,
          "fragment": "import MapsPage from './maps.vue';"
        }
      },
      {
        "from": "app/pages/projects/[id]/strategy.vue",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/strategy.vue",
          "line": 3,
          "fragment": "import type { ProjectMap } from '~~/server/lib/maps';"
        }
      },
      {
        "from": "app/pages/projects/[id]/strategy.vue",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/strategy.vue",
          "line": 4,
          "fragment": "import { roadmap } from '~~/server/lib/manager';"
        }
      },
      {
        "from": "app/pages/projects/[id]/strategy.vue",
        "to": "server/lib/strategy.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/strategy.vue",
          "line": 5,
          "fragment": "import { strategyContours, type HealthLevel, type StrategyCa"
        }
      },
      {
        "from": "app/plugins/can.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/plugins/can.ts",
          "line": 2,
          "fragment": "import { tr } from '../i18n/tr';"
        }
      },
      {
        "from": "app/plugins/i18n.ts",
        "to": "app/composables/useT.ts",
        "evidence": {
          "path": "app/plugins/i18n.ts",
          "line": 1,
          "fragment": "import { DEFAULT_LOCALE, LOCALES } from '~/composables/useT'"
        }
      },
      {
        "from": "app/plugins/model-jobs.client.ts",
        "to": "app/stores/modelJobs.ts",
        "evidence": {
          "path": "app/plugins/model-jobs.client.ts",
          "line": 1,
          "fragment": "import { useModelJobs } from '~/stores/modelJobs';"
        }
      },
      {
        "from": "app/stores/modelJobs.ts",
        "to": "app/utils/batch-describe.ts",
        "evidence": {
          "path": "app/stores/modelJobs.ts",
          "line": 5,
          "fragment": "import type { BatchRun } from '../utils/batch-describe';"
        }
      },
      {
        "from": "app/stores/modelJobs.ts",
        "to": "app/utils/event-stream.ts",
        "evidence": {
          "path": "app/stores/modelJobs.ts",
          "line": 6,
          "fragment": "import { add, readEvents } from '../utils/event-stream';"
        }
      },
      {
        "from": "app/stores/modelJobs.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/stores/modelJobs.ts",
          "line": 7,
          "fragment": "import { tr } from '../i18n/tr';"
        }
      },
      {
        "from": "app/utils/batch-describe.ts",
        "to": "server/lib/inventory.ts",
        "evidence": {
          "path": "app/utils/batch-describe.ts",
          "line": 1,
          "fragment": "import { batchPlan } from '../../server/lib/inventory'; impo"
        }
      },
      {
        "from": "app/utils/duration.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/utils/duration.ts",
          "line": 1,
          "fragment": "import { tr } from '../i18n/tr';"
        }
      },
      {
        "from": "app/utils/facts.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/utils/facts.ts",
          "line": 1,
          "fragment": "import { tr } from '../i18n/tr';"
        }
      },
      {
        "from": "app/utils/functional-view.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/utils/functional-view.ts",
          "line": 1,
          "fragment": "import { tr } from '../i18n/tr';"
        }
      },
      {
        "from": "app/utils/functional-view.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/utils/functional-view.ts",
          "line": 26,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 18,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/flow-groups.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 25,
          "fragment": "} from '../../server/lib/flow-groups';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 32,
          "fragment": "} from '../../server/lib/groups';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/layers.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 34,
          "fragment": "import { layerOf } from '../../server/lib/layers'; import { "
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 44,
          "fragment": "} from './functional-view';"
        }
      },
      {
        "from": "app/utils/phases.ts",
        "to": "app/i18n/tr.ts",
        "evidence": {
          "path": "app/utils/phases.ts",
          "line": 1,
          "fragment": "import { tr } from '../i18n/tr';"
        }
      }
    ]
  }
}
```

```docdd-dataflow
{}
```

```docdd-userflow
{
  "added": {
    "screens": [
      {
        "id": "/audit",
        "title": "audit",
        "file": "app/pages/audit.vue"
      },
      {
        "id": "/design",
        "title": "design",
        "file": "app/pages/design.vue"
      },
      {
        "id": "/login",
        "title": "login",
        "file": "app/pages/login.vue"
      },
      {
        "id": "/models",
        "title": "models",
        "file": "app/pages/models.vue"
      },
      {
        "id": "/notifications",
        "title": "notifications",
        "file": "app/pages/notifications.vue"
      },
      {
        "id": "/people",
        "title": "people",
        "file": "app/pages/people.vue"
      },
      {
        "id": "/portfolio",
        "title": "portfolio",
        "file": "app/pages/portfolio.vue"
      },
      {
        "id": "/projects/:id/analyst",
        "title": "analyst",
        "file": "app/pages/projects/[id]/analyst.vue"
      },
      {
        "id": "/projects/:id/checks",
        "title": "checks",
        "file": "app/pages/projects/[id]/checks.vue"
      },
      {
        "id": "/projects/:id/design",
        "title": "design",
        "file": "app/pages/projects/[id]/design.vue"
      },
      {
        "id": "/projects/:id/file",
        "title": "file",
        "file": "app/pages/projects/[id]/file.vue"
      },
      {
        "id": "/projects/:id/glossary",
        "title": "glossary",
        "file": "app/pages/projects/[id]/glossary.vue"
      },
      {
        "id": "/projects/:id/graph",
        "title": "graph",
        "file": "app/pages/projects/[id]/graph.vue"
      },
      {
        "id": "/projects/:id/import",
        "title": "import",
        "file": "app/pages/projects/[id]/import.vue"
      },
      {
        "id": "/projects/:id/inbox",
        "title": "inbox",
        "file": "app/pages/projects/[id]/inbox.vue"
      },
      {
        "id": "/projects/:id/issues",
        "title": "issues",
        "file": "app/pages/projects/[id]/issues.vue"
      },
      {
        "id": "/projects/:id/knowledge",
        "title": "knowledge",
        "file": "app/pages/projects/[id]/knowledge.vue"
      },
      {
        "id": "/projects/:id/manager",
        "title": "manager",
        "file": "app/pages/projects/[id]/manager.vue"
      },
      {
        "id": "/projects/:id/reference",
        "title": "reference",
        "file": "app/pages/projects/[id]/reference.vue"
      },
      {
        "id": "/projects/:id/releases",
        "title": "releases",
        "file": "app/pages/projects/[id]/releases.vue"
      },
      {
        "id": "/projects/:id/results",
        "title": "results",
        "file": "app/pages/projects/[id]/results.vue"
      },
      {
        "id": "/projects/:id/search",
        "title": "search",
        "file": "app/pages/projects/[id]/search.vue"
      },
      {
        "id": "/projects/:id/shared",
        "title": "shared",
        "file": "app/pages/projects/[id]/shared.vue"
      },
      {
        "id": "/projects/:id/strategy",
        "title": "strategy",
        "file": "app/pages/projects/[id]/strategy.vue"
      },
      {
        "id": "/projects/:id/tasks",
        "title": "tasks",
        "file": "app/pages/projects/[id]/tasks.vue"
      },
      {
        "id": "/usage",
        "title": "usage",
        "file": "app/pages/usage.vue"
      }
    ],
    "transitions": [
      {
        "from": "/design",
        "to": "/projects/:id/design",
        "trigger": "ссылка",
        "evidence": {
          "path": "app/pages/design.vue",
          "line": 94,
          "fragment": "<NuxtLink :to=\"`/projects/${project.id}/design`\" class=\"hove"
        }
      },
      {
        "from": "/projects/:id/design",
        "to": "/projects/:id/shared",
        "trigger": "ссылка",
        "evidence": {
          "path": "app/pages/projects/[id]/design.vue",
          "line": 122,
          "fragment": "<UButton :to=\"`/projects/${projectId}/shared`\" size=\"sm\" var"
        }
      },
      {
        "from": "/projects/:id/documents",
        "to": "/projects/:id/reference",
        "trigger": "ссылка",
        "evidence": {
          "path": "app/pages/projects/[id]/documents.vue",
          "line": 132,
          "fragment": "{{ t('docs.refHint') }} <NuxtLink :to=\"`/projects/${projectI"
        }
      },
      {
        "from": "/projects/:id/shared",
        "to": "/projects/:id/records/:recordId",
        "trigger": "ссылка",
        "evidence": {
          "path": "app/pages/projects/[id]/shared.vue",
          "line": 236,
          "fragment": ":to=\"`/projects/${source.registeredProjectId}/records/${reco"
        }
      },
      {
        "from": "/projects/:id/strategy",
        "to": "/projects/:id/records/:recordId",
        "trigger": "ссылка",
        "evidence": {
          "path": "app/pages/projects/[id]/strategy.vue",
          "line": 91,
          "fragment": "<NuxtLink v-if=\"reason.recordId\" :to=\"`/projects/${projectId"
        }
      }
    ],
    "calls": [
      {
        "from": "/audit",
        "to": "GET /api/audit",
        "evidence": {
          "path": "app/pages/audit.vue",
          "line": 6,
          "fragment": "const { data, refresh } = await useFetch<{ entries: Entry[] "
        }
      },
      {
        "from": "/design",
        "to": "GET /api/design",
        "evidence": {
          "path": "app/pages/design.vue",
          "line": 33,
          "fragment": "const { data } = useFetch<GlobalDesign | { error: ApiFailure"
        }
      },
      {
        "from": "/",
        "to": "GET /api/projects/init",
        "evidence": {
          "path": "app/pages/index.vue",
          "line": 31,
          "fragment": "const response = await $fetch<ProjectEntry | { error: ApiFai"
        }
      },
      {
        "from": "/",
        "to": "GET /api/projects",
        "evidence": {
          "path": "app/pages/index.vue",
          "line": 54,
          "fragment": "const response = await $fetch<ProjectEntry | { error: ApiFai"
        }
      },
      {
        "from": "/",
        "to": "DELETE /api/projects/:param",
        "evidence": {
          "path": "app/pages/index.vue",
          "line": 78,
          "fragment": "await $fetch(`/api/projects/${id}`, { method: 'DELETE', igno"
        }
      },
      {
        "from": "/login",
        "to": "GET /api/auth/login",
        "evidence": {
          "path": "app/pages/login.vue",
          "line": 12,
          "fragment": "const response = await $fetch<{ error?: { message: string } "
        }
      },
      {
        "from": "/models",
        "to": "GET /api/llm/models",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 7,
          "fragment": "const { data, refresh } = await useFetch<Loaded | { error: {"
        }
      },
      {
        "from": "/models",
        "to": "GET /api/llm/usage",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 24,
          "fragment": "const { data: usage } = await useFetch<{ month: string; tota"
        }
      },
      {
        "from": "/models",
        "to": "GET /api/projects",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 25,
          "fragment": "const { data: projectList } = await useFetch<{ projects?: Ar"
        }
      },
      {
        "from": "/models",
        "to": "GET /api/projects/:id/llm/queue",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 31,
          "fragment": "async function loadQueue() { if (queueProject.value) jobs.va"
        }
      },
      {
        "from": "/models",
        "to": "DELETE /api/projects/:id/llm/queue/:param",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 32,
          "fragment": "async function cancelJob(id: string) { await $fetch(`/api/pr"
        }
      },
      {
        "from": "/models",
        "to": "PUT /api/llm/models",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 39,
          "fragment": "const result = await $fetch<{ ok?: boolean }>('/api/llm/mode"
        }
      },
      {
        "from": "/models",
        "to": "POST /api/llm/models/check",
        "evidence": {
          "path": "app/pages/models.vue",
          "line": 45,
          "fragment": "const result = await $fetch<{ ok: boolean; ms?: number; fail"
        }
      },
      {
        "from": "/notifications",
        "to": "GET /api/notifications/channel",
        "evidence": {
          "path": "app/pages/notifications.vue",
          "line": 4,
          "fragment": "const { data, refresh } = useFetch<{ hasUrl: boolean; fromEn"
        }
      },
      {
        "from": "/people",
        "to": "GET /api/auth/users",
        "evidence": {
          "path": "app/pages/people.vue",
          "line": 6,
          "fragment": "const { data, refresh } = useFetch<Person[]>('/api/auth/user"
        }
      },
      {
        "from": "/portfolio",
        "to": "GET /api/portfolio",
        "evidence": {
          "path": "app/pages/portfolio.vue",
          "line": 6,
          "fragment": "const { data } = await useFetch<{ rows: PortfolioRow[] }>('/"
        }
      },
      {
        "from": "/projects/:id/analyst",
        "to": "POST /api/projects/:id/analyst",
        "evidence": {
          "path": "app/pages/projects/[id]/analyst.vue",
          "line": 19,
          "fragment": "const built = await $fetch<{ prompt: string }>(`/api/project"
        }
      },
      {
        "from": "/projects/:id/file",
        "to": "GET /api/projects/:id/file",
        "evidence": {
          "path": "app/pages/projects/[id]/file.vue",
          "line": 11,
          "fragment": "const { data, error } = useFetch<{ path: string; content: st"
        }
      },
      {
        "from": "/projects/:id/glossary",
        "to": "GET /api/projects/:id/glossary",
        "evidence": {
          "path": "app/pages/projects/[id]/glossary.vue",
          "line": 7,
          "fragment": "const { data } = useFetch<{ terms: GlossaryTerm[] }>(() => `"
        }
      },
      {
        "from": "/projects/:id/knowledge",
        "to": "GET /api/projects/:id/knowledge",
        "evidence": {
          "path": "app/pages/projects/[id]/knowledge.vue",
          "line": 12,
          "fragment": "const { data } = useFetch<{ tree: KnowledgeNode[] }>(() => `"
        }
      },
      {
        "from": "/projects/:id/maps",
        "to": "GET /api/projects/:id/map/draft",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 144,
          "fragment": "const response = await $fetch(`/api/projects/${projectId.val"
        }
      },
      {
        "from": "/projects/:id/maps",
        "to": "GET /api/projects/:id/records",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 174,
          "fragment": "const response = await $fetch(`/api/projects/${projectId.val"
        }
      },
      {
        "from": "/projects/:id/reference",
        "to": "POST /api/projects/:id/reference/rebuild",
        "evidence": {
          "path": "app/pages/projects/[id]/reference.vue",
          "line": 27,
          "fragment": "const response = await $fetch(`/api/projects/${projectId.val"
        }
      },
      {
        "from": "/projects/:id/releases",
        "to": "GET /api/projects/:id/records",
        "evidence": {
          "path": "app/pages/projects/[id]/releases.vue",
          "line": 51,
          "fragment": "await $fetch(`/api/projects/${projectId.value}/records`, {"
        }
      },
      {
        "from": "/projects/:id/search",
        "to": "GET /api/projects/:id/search",
        "evidence": {
          "path": "app/pages/projects/[id]/search.vue",
          "line": 13,
          "fragment": "const answer = await $fetch<{ hits: SearchHit[] }>(`/api/pro"
        }
      },
      {
        "from": "/projects/:id/strategy",
        "to": "GET /api/projects/:id/map",
        "evidence": {
          "path": "app/pages/projects/[id]/strategy.vue",
          "line": 20,
          "fragment": "const { data: mapData, pending } = useFetch<Partial<ProjectM"
        }
      }
    ]
  }
}
```

## Журнал

- 2026-10-24 · заведена черновиком · модель

## Журнал

- 2026-10-24 · заведена черновиком · модель
