---
id: M-0079
type: map
title: Опись сервера, группы кода деревом, потоки данных деревом
status: approved
created: 2026-10-24
updated: 2026-10-24
---

# Опись сервера, группы кода деревом, потоки данных деревом

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками
то, что модель не поняла, и подтвердите — до этого карта на общую картину
не влияет.

**Группы кода** — по правилу «дерево — по приложениям, фича — срезом» (docs/07-maps.md): сервер, клиент, командная строка → слой → части (до четырёх уровней у маршрутов проекта). Нижние группы ссылаются на контур стратегической карты через `capability`: срез «вся фича» — все группы с одной возможностью. Состав — поимённо, по папкам и по смыслу имени файла; это суждение, поправьте границы, где не согласны.

**Опись сервера** — файлы, которых не было в картах. Описание модуля взято из шапочного комментария файла, у маршрута без комментария — метод и адрес; связи — строки import со свидетельством. Описанные раньше модули без описания объявлены заново с описанием.

**Потоки данных** — источники деревом: проект → служебная папка .docdd; данные сервера (.data) — своей веткой. Добавлены источники, которых не было: учётки, ключ сессий, настройки и учёт моделей, уведомления, просмотренные разницы, векторы поиска. Группы потоков на экране берутся из групп кода.

```docdd-codemap
{
  "added": {
    "modules": [
      {
        "id": "server/api/audit.get.ts",
        "title": "audit.get",
        "layer": "маршруты",
        "summary": "Журнал доступа для администратора (T-0018). Последние строки, новые сверху; `actor` и `project` сужают выборку."
      },
      {
        "id": "server/api/auth/login.post.ts",
        "title": "login.post",
        "layer": "маршруты",
        "summary": "POST /api/auth/login"
      },
      {
        "id": "server/api/auth/logout.post.ts",
        "title": "logout.post",
        "layer": "маршруты",
        "summary": "POST /api/auth/logout"
      },
      {
        "id": "server/api/auth/me.get.ts",
        "title": "me.get",
        "layer": "маршруты",
        "summary": "Экрану нужно знать, включён ли вход, кто вошёл и что ему можно в проекте (`?project=<id>`): кнопка без права неактивна и называет причину. Без входа — `required: false`, права не ограничены."
      },
      {
        "id": "server/api/auth/users.get.ts",
        "title": "users.get",
        "layer": "маршруты",
        "summary": "Список людей для экрана «Люди»; хеши не отдаём. Доступ — только администратору (server/middleware/auth.ts)."
      },
      {
        "id": "server/api/auth/users.post.ts",
        "title": "users.post",
        "layer": "маршруты",
        "summary": "Завести или обновить человека. Первого администратора заводит скрипт развёртывания: пока учёток нет, middleware пускает сюда без сессии."
      },
      {
        "id": "server/api/design.get.ts",
        "title": "design.get",
        "layer": "маршруты",
        "summary": "Глобальный экран «Дизайн» (docs/16-design-system.md): эталон консоли и то, как с ним живут проекты. Один проект, не открывшийся, не роняет весь список — у него своя строка с причиной."
      },
      {
        "id": "server/api/llm/ask.post.ts",
        "title": "ask.post",
        "layer": "маршруты",
        "summary": "Один запрос к модели через Claude Code. Ответ идёт лентой событий: видно, что модель делает, пока она это делает (docs/04-ui.md)."
      },
      {
        "id": "server/api/llm/embeddings.get.ts",
        "title": "embeddings.get",
        "layer": "маршруты",
        "summary": "Чем считаются эмбеддинги смыслового поиска (окно «Настройки» → «Поиск», docs/adr/0031-semantic-search.md): выбранный провайдер и модель и список провайдеров, которые это умеют (OpenAI-совместимые). Ключи наружу не идут."
      },
      {
        "id": "server/api/llm/embeddings.put.ts",
        "title": "embeddings.put",
        "layer": "маршруты",
        "summary": "Выбрать, чем считать эмбеддинги: `{ provider: null }` — локально без сети, `{ provider, model }` — OpenAI-совместимый провайдер и модель эмбеддингов. Только администратор (при включённом входе)."
      },
      {
        "id": "server/api/llm/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Есть ли чем спросить модель. Отсутствие Claude Code — состояние, а не ошибка."
      },
      {
        "id": "server/api/llm/models/check.post.ts",
        "title": "check.post",
        "layer": "маршруты",
        "summary": "Проверка связи: короткий запрос выбранному провайдеру."
      },
      {
        "id": "server/api/llm/models/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Настройки моделей для экрана «Модели»: ключи не отдаются, только факт, что они найдены."
      },
      {
        "id": "server/api/llm/models/index.put.ts",
        "title": "index.put",
        "layer": "маршруты",
        "summary": "Сохранить список провайдеров. Пришедшее без `apiKey` оставляет прежнее значение ключа: браузер его не знает и не должен затирать."
      },
      {
        "id": "server/api/llm/usage.get.ts",
        "title": "usage.get",
        "layer": "маршруты",
        "summary": "Сводка расходов за месяц (`?month=YYYY-MM`, по умолчанию текущий) по людям и моделям; `?projectId=` — один проект. Суммы — оценка по символам."
      },
      {
        "id": "server/api/notifications/channel.get.ts",
        "title": "channel.get",
        "layer": "маршруты",
        "summary": "Внешний канал уведомлений: адрес не отдаётся, только факт, что он задан."
      },
      {
        "id": "server/api/notifications/channel.put.ts",
        "title": "channel.put",
        "layer": "маршруты",
        "summary": "Задать адрес вебхука (пустая строка — отключить)."
      },
      {
        "id": "server/api/portfolio.get.ts",
        "title": "portfolio.get",
        "layer": "маршруты",
        "summary": "Портфель (T-0042): сводка по каждому проекту списка; нечитаемый не рушит остальных."
      },
      {
        "id": "server/api/projects/[id].delete.ts",
        "title": "[id].delete",
        "layer": "маршруты",
        "summary": "DELETE /api/projects/:id"
      },
      {
        "id": "server/api/projects/[id]/agents/[agentId].delete.ts",
        "title": "[agentId].delete",
        "layer": "маршруты",
        "summary": "Удалить агента — файл `docs/agents/<id>.md` (ADR-0033). История остаётся в git."
      },
      {
        "id": "server/api/projects/[id]/agents/defaults.post.ts",
        "title": "defaults.post",
        "layer": "маршруты",
        "summary": "«Создать набор»: восемь агентов по умолчанию файлами; существующие не перезаписываются (ADR-0033)."
      },
      {
        "id": "server/api/projects/[id]/agents/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Агенты проекта и набор типов по умолчанию (ADR-0033)."
      },
      {
        "id": "server/api/projects/[id]/agents/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Завести или изменить агента: `{ id, type, title, model?, access, prompt }` (ADR-0033). Право — `team`."
      },
      {
        "id": "server/api/projects/[id]/analyst.post.ts",
        "title": "analyst.post",
        "layer": "маршруты",
        "summary": "Собирает запрос помощника аналитика; отправляет его клиент через /api/llm/ask, как остальные запросы."
      },
      {
        "id": "server/api/projects/[id]/architecture.get.ts",
        "title": "architecture.get",
        "layer": "маршруты",
        "summary": "Нарушения архитектуры (docs/07-maps.md, «Модули и публичный вход»). Отдельный маршрут, а не часть `GET /map`: ему нужен манифест и список файлов кода, а карте они ни к чему."
      },
      {
        "id": "server/api/projects/[id]/architecture.post.ts",
        "title": "architecture.post",
        "layer": "маршруты",
        "summary": "Разбор ответа на запрос `architecture` (docs/07-maps.md, «Аудит моделью»). Ничего не пишет: достаёт находки из блока `docdd-architecture` и отбрасывает то, чего нет в проекте, называя причину. Находки — мнение:"
      },
      {
        "id": "server/api/projects/[id]/attachment.get.ts",
        "title": "attachment.get",
        "layer": "маршруты",
        "summary": "Отдать вложение (R-0099): только чтение, только из папки `attachments/` внутри корня."
      },
      {
        "id": "server/api/projects/[id]/attachments.post.ts",
        "title": "attachments.post",
        "layer": "маршруты",
        "summary": "Загрузка вложения к прогону или дефекту (R-0099): `{ name, data }`, где `data` — содержимое файла в base64. Файл ложится в `<tests>/attachments/<дата>/` внутри корня проекта; в ответе — путь, который кладут в отчёт."
      },
      {
        "id": "server/api/projects/[id]/backlinks/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Обратные связи отдельно от индекса: в HTML они не нужны, страницы просят их лениво."
      },
      {
        "id": "server/api/projects/[id]/batch-check/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Сверка пачки по возможности (R-0092, docs/03-server-api.md): `?capability=<id>`. Пачка — задачи, чьи `affects` называют карты, объявившие возможность, и всё связанное с ними."
      },
      {
        "id": "server/api/projects/[id]/context/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Грубая оценка: около трёх знаков русского текста на токен. Цена — ориентир, а не счёт."
      },
      {
        "id": "server/api/projects/[id]/design/catalog.get.ts",
        "title": "catalog.get",
        "layer": "маршруты",
        "summary": "Матрица «компонент × состояние × стек» по выгрузкам каталогов историй и найденные пробелы (docs/16-design-system.md). `null` — каталоги не объявлены."
      },
      {
        "id": "server/api/projects/[id]/design/export.get.ts",
        "title": "export.get",
        "layer": "маршруты",
        "summary": "Выгрузка токенов в стеки проекта и сверка файлов темы (docs/16-design-system.md, «Стеки и выгрузка»). Файл проекта не пишется: его меняет задача модели в своей ветке, а сливает человек (ADR-0022)."
      },
      {
        "id": "server/api/projects/[id]/design/findings/apply.post.ts",
        "title": "apply.post",
        "layer": "маршруты",
        "summary": "«Принять» находки (docs/16-design-system.md): записывает отчёт прохода в каталог отчётов проекта. Принимает то, что человек оставил на экране, и заново проверяет его по описи: сервер не верит телу запроса вслепую."
      },
      {
        "id": "server/api/projects/[id]/design/findings/preview.post.ts",
        "title": "preview.post",
        "layer": "маршруты",
        "summary": "Разбор ответа модели в находки проверки экранов (docs/16-design-system.md). Ничего не пишет: находка про экран, ширину или тему, которых нет в описи, отбрасывается и называется в `problems`."
      },
      {
        "id": "server/api/projects/[id]/design/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Токены дизайна проекта после сложения «общее → локальное» с источником у каждой части (docs/16-design-system.md). Производное: нигде не хранится."
      },
      {
        "id": "server/api/projects/[id]/design/port-prompt.post.ts",
        "title": "port-prompt.post",
        "layer": "маршруты",
        "summary": "Запрос «перенести компонент на стек» по контракту (docs/16-design-system.md, «Storybook как контракт»). Тело `{ component, stack, branch? }`. Приложение собирает текст и отдаёт его: отправлять ли модели — решает человек."
      },
      {
        "id": "server/api/projects/[id]/design/record-diff.get.ts",
        "title": "record-diff.get",
        "layer": "маршруты",
        "summary": "Разница токенов дизайна у записи на подтверждении: `?record=D-0007` (R-0073). Ничего не пишет."
      },
      {
        "id": "server/api/projects/[id]/design/screens.get.ts",
        "title": "screens.get",
        "layer": "маршруты",
        "summary": "Опись снимков экранов проекта: экран · ширина · тема · когда снят (docs/16-design-system.md). Экраны — из подтверждённой карты путей; снимки приложение не делает, а читает."
      },
      {
        "id": "server/api/projects/[id]/diff-unviewed.get.ts",
        "title": "diff-unviewed.get",
        "layer": "маршруты",
        "summary": "Записи на подтверждении, чью разницу не открывали: по ним список рисует значок."
      },
      {
        "id": "server/api/projects/[id]/file.get.ts",
        "title": "file.get",
        "layer": "маршруты",
        "summary": "Показ файла кода по ссылке из документа: только чтение, только внутри корня."
      },
      {
        "id": "server/api/projects/[id]/fix/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Починка нарушений по подтверждённому плану (docs/adr/0010-model-fixes-violations.md). Границу — какие файлы можно трогать — приложение берёт из тех же нарушений, из которых собрало план, а не из запроса браузера:"
      },
      {
        "id": "server/api/projects/[id]/fix/work/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Состояние починки: что модель тронула и не вышла ли за границу."
      },
      {
        "id": "server/api/projects/[id]/fix/work/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Три ответа на дифф починки: принять и слить, отклонить. Доработка — это новый план: чинится не задача, а нарушения, и план у неё каждый раз свой (docs/adr/0010-model-fixes-violations.md)."
      },
      {
        "id": "server/api/projects/[id]/glossary.get.ts",
        "title": "glossary.get",
        "layer": "маршруты",
        "summary": "Термины проекта из `docs/development/glossary.md`; файла нет — пустой список, а не ошибка."
      },
      {
        "id": "server/api/projects/[id]/import/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Обзор существующей документации: что нашли в каталогах `sources.docs`."
      },
      {
        "id": "server/api/projects/[id]/import/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Применение плана, который человек уже поправил. Текст документа не меняется: добавляется front matter и файл переезжает в папку своего раздела."
      },
      {
        "id": "server/api/projects/[id]/inbox/accept.post.ts",
        "title": "accept.post",
        "layer": "маршруты",
        "summary": "«Принять без записей» (docs/10-inbox.md): из заметки заводить нечего, и это решение человека, а не модели. Заметка переезжает в «принятое»."
      },
      {
        "id": "server/api/projects/[id]/inbox/alert.post.ts",
        "title": "alert.post",
        "layer": "маршруты",
        "summary": "Вебхук алертов Grafana (R-0065): алерт становится заметкой во входящем. Вход сессией тут невозможен, поэтому дверь закрыта токеном `DOCDD_ALERT_TOKEN` (заголовок Authorization:"
      },
      {
        "id": "server/api/projects/[id]/inbox/external.post.ts",
        "title": "external.post",
        "layer": "маршруты",
        "summary": "Импорт выгрузок Jira (T-0047) и Confluence (T-0048) во входящее. Тело: `{ source: 'jira', text }` или `{ source: 'confluence', pages: [{ title, parent, body }] }`."
      },
      {
        "id": "server/api/projects/[id]/inbox/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Что лежит во входящем (docs/10-inbox.md). Склад не назван в манифесте — отвечаем об этом прямо: экрана входящего у такого проекта нет."
      },
      {
        "id": "server/api/projects/[id]/inbox/notes.post.ts",
        "title": "notes.post",
        "layer": "маршруты",
        "summary": "Заметка от человека без markdown и файловой системы — та же дверь на склад, что и у модели (docs/10-inbox.md, «Что кладёт человек»)."
      },
      {
        "id": "server/api/projects/[id]/inbox/preview.post.ts",
        "title": "preview.post",
        "layer": "маршруты",
        "summary": "Разбор ответа модели в список записей — до того, как что-то заведено (docs/10-inbox.md). Человек правит список, а не текст ответа."
      },
      {
        "id": "server/api/projects/[id]/inbox/records.post.ts",
        "title": "records.post",
        "layer": "маршруты",
        "summary": "Завести записи по подтверждённому человеком списку (docs/10-inbox.md). Приходит либо готовый список (человек его правил на экране), либо ответ модели целиком — тогда он сперва разбирается и проверяется схемой."
      },
      {
        "id": "server/api/projects/[id]/index/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Что рисуют списки кроме задач: вид проверки на «Сверке», версия и окружения на «Релизах»."
      },
      {
        "id": "server/api/projects/[id]/issues.get.ts",
        "title": "issues.get",
        "layer": "маршруты",
        "summary": "GET /api/projects/:id/issues"
      },
      {
        "id": "server/api/projects/[id]/knowledge.get.ts",
        "title": "knowledge.get",
        "layer": "маршруты",
        "summary": "Дерево пространства знаний: проектные документы, решения, контракты и заметки входящего."
      },
      {
        "id": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
        "title": "[feedId].delete",
        "layer": "маршруты",
        "summary": "«Отменить» (ADR-0034): единственный путь снять задание — закрытие соединения его не снимает."
      },
      {
        "id": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
        "title": "[feedId].get",
        "layer": "маршруты",
        "summary": "Подключиться к ленте задания заново (ADR-0034): накопленное с `from`, дальше по мере работы, в конце `done` или `error`. Чужую и неизвестную ленту не отличаем — обе 404."
      },
      {
        "id": "server/api/projects/[id]/llm/queue/[jobId].delete.ts",
        "title": "[jobId].delete",
        "layer": "маршруты",
        "summary": "Отмена задания: ожидающее снимается, идущее получает сигнал отмены. Чужого проекта не касаемся."
      },
      {
        "id": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
        "title": "[jobId].get",
        "layer": "маршруты",
        "summary": "Результат задания по идентификатору: ответ, ошибка, время, итог. Чужого проекта не отдаём."
      },
      {
        "id": "server/api/projects/[id]/llm/queue/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Очередь запросов к модели по проекту: видна всей команде. К живым заданиям добавлены недавно завершённые из журнала `.data/llm-jobs` (с ответом) — так ответ находится после обновления страницы и перезапуска сервера."
      },
      {
        "id": "server/api/projects/[id]/map/behind.get.ts",
        "title": "behind.get",
        "layer": "маршруты",
        "summary": "Отметки возможностей, отставшие от фактов, с предложенной отметкой — для кнопки «Отметить по фактам» (R-0101, docs/07-maps.md). Производное, не хранится; черновик заводит `POST /map/capability` с `action: \"status\"`."
      },
      {
        "id": "server/api/projects/[id]/map/coverage.get.ts",
        "title": "coverage.get",
        "layer": "маршруты",
        "summary": "Что стоит за возможностями в процессе: требования, задачи, проверки и код (docs/07-maps.md, «Покрытие процессом»). Производное от записей, отчётов и общей картины — нигде не хранится."
      },
      {
        "id": "server/api/projects/[id]/map/draft.post.ts",
        "title": "draft.post",
        "layer": "маршруты",
        "summary": "Ответ модели — черновиком записи типа `map`. Приложение проверяет три структуры по схемам и **не подтверждает** запись: подтверждает человек (docs/adr/0008-llm-through-claude-code.md)."
      },
      {
        "id": "server/api/projects/[id]/map/functional-check.post.ts",
        "title": "functional-check.post",
        "layer": "маршруты",
        "summary": "Разбор ответа на запрос `functional-check` (docs/07-maps.md, «Ответ „Проверить по коду“»). Ничего не пишет: достаёт предложения модели и сопоставляет их с картиной — что сейчас, что предлагается."
      },
      {
        "id": "server/api/projects/[id]/map/functional-relations.post.ts",
        "title": "functional-relations.post",
        "layer": "маршруты",
        "summary": "Разбор ответа на запрос `relations` (docs/07-maps.md, «Связи — тоже пачкой, и модель может их предложить»). Ничего не пишет: достаёт предложения и сопоставляет их с картиной — что новое, что пропущено и почему."
      },
      {
        "id": "server/api/projects/[id]/map/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "GET /api/projects/:id/map"
      },
      {
        "id": "server/api/projects/[id]/map/inventory.get.ts",
        "title": "inventory.get",
        "layer": "маршруты",
        "summary": "Состояние описи файлов (docs/07-maps.md): сколько описано, сколько ждёт очереди, что изменилось после описания и чего больше нет. Пустой проект отвечает нулём — это состояние, а не ошибка."
      },
      {
        "id": "server/api/projects/[id]/map/inventory/rebuild.post.ts",
        "title": "rebuild.post",
        "layer": "маршруты",
        "summary": "Пересчитать опись строго по действующим подтверждённым картам (docs/07-maps.md, раздел «Опись теряет силу вместе с картой»). Опись копится добавлением:"
      },
      {
        "id": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "title": "index.delete",
        "layer": "маршруты",
        "summary": "Удаление рабочей карты (docs/adr/0036-delete-working-map.md): только строка определения в `project.yaml`; записи `map` целы, строка возвращается из git. Удаляет создатель или администратор."
      },
      {
        "id": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "title": "node.post",
        "layer": "маршруты",
        "summary": "Правка пользовательской карты (docs/adr/0028-custom-maps.md) — как `POST …/map/capability`:"
      },
      {
        "id": "server/api/projects/[id]/maps/custom/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Пользовательские карты (docs/adr/0028-custom-maps.md): годные определения из манифеста, беды неверных и вид каждой карты из той же сложенной картины, что отдаёт `GET …/map`, — второй свёртки записей нет, расходиться не…"
      },
      {
        "id": "server/api/projects/[id]/maps/custom/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Новое определение пользовательской карты (docs/adr/0028-custom-maps.md). Определение — настройка проекта, а не утверждение о нём, поэтому пишется прямо в `project.yaml`, без черновика записи."
      },
      {
        "id": "server/api/projects/[id]/metrics.get.ts",
        "title": "metrics.get",
        "layer": "маршруты",
        "summary": "Метрики процесса для Prometheus/Grafana (R-0065): текст, а не JSON."
      },
      {
        "id": "server/api/projects/[id]/notifications/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Уведомления читателя, новые сверху: вошедшего — его, без входа — все (консоль одного человека)."
      },
      {
        "id": "server/api/projects/[id]/notifications/read.post.ts",
        "title": "read.post",
        "layer": "маршруты",
        "summary": "Отметить прочитанным: `{ ids? }`; без `ids` — всё читателя."
      },
      {
        "id": "server/api/projects/[id]/observability.get.ts",
        "title": "observability.get",
        "layer": "маршруты",
        "summary": "Метрики продукта для обзора (docs/04-ui.md, «Наблюдаемость»). Сервер сам ходит в Prometheus по запросам из манифеста: браузер туда не ходит, адрес и сеть Prometheus наружу не видны. Каждый запрос — с таймаутом:"
      },
      {
        "id": "server/api/projects/[id]/onboarding/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Чек-лист «Готовность проекта» (R-0075, docs/03-server-api.md): шаги подключения со статусом, вычисленным по состоянию проекта, и готовность одним числом. Читает файлы, ничего не пишет."
      },
      {
        "id": "server/api/projects/[id]/onboarding/run.post.ts",
        "title": "run.post",
        "layer": "маршруты",
        "summary": "«Запустить подключение» (R-0075): `{ step?, force? }`. Автоматические шаги выполняются сразу, остальные приходят в `left` со ссылкой на экран. Записи — черновиками, ничего не перетирается."
      },
      {
        "id": "server/api/projects/[id]/onboarding/tests.get.ts",
        "title": "tests.get",
        "layer": "маршруты",
        "summary": "Проверки из существующих тестов (R-0079): найденные тесты с требованием и причиной, покрытие требований. Ничего не пишет."
      },
      {
        "id": "server/api/projects/[id]/onboarding/tests.post.ts",
        "title": "tests.post",
        "layer": "маршруты",
        "summary": "`{ files?: string[] }` — завести проверки-черновики по найденным тестам (все сопоставленные или названные); `{ report:"
      },
      {
        "id": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "title": "wizard.post",
        "layer": "маршруты",
        "summary": "Мастер нового проекта (R-0076): `{ vision, features, glossary?, phase? }`, где `features` — строки «Название — требование», `glossary` — строки «Термин — определение». Заводит черновики:"
      },
      {
        "id": "server/api/projects/[id]/phases/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Завести фазы по списку, который человек оставил (docs/03-server-api.md). Список правил человек, поэтому проверяется заново. Файлы задач не трогаются: состав задаёт `covers` у новой фазы."
      },
      {
        "id": "server/api/projects/[id]/phases/preview.post.ts",
        "title": "preview.post",
        "layer": "маршруты",
        "summary": "Ответ модели — в список фаз, до того как что-то заведено (docs/03-server-api.md, «Фазы»). Человек правит список, а не текст ответа."
      },
      {
        "id": "server/api/projects/[id]/priority/apply.post.ts",
        "title": "apply.post",
        "layer": "маршруты",
        "summary": "«Применить порядок» (docs/04-ui.md, «Порядок по важности»): записывает то, что человек подтвердил, — `rank` у фаз и порядок `covers`. Модель и приложение сами порядок не записывают."
      },
      {
        "id": "server/api/projects/[id]/priority/preview.post.ts",
        "title": "preview.post",
        "layer": "маршруты",
        "summary": "Разбор ответа модели в порядок — до того, как что-то записано (docs/04-ui.md, «Порядок по важности»). Неизвестное отброшено, пропущенное достроено, зависимости восстановлены; обо всём этом сказано в `problems` и `fixed`."
      },
      {
        "id": "server/api/projects/[id]/progress-question.post.ts",
        "title": "progress-question.post",
        "layer": "маршруты",
        "summary": "Единственный запрос к модели, который доступен наблюдателю (T-0017, docs/15-team-platform.md): вопрос о ходе работы."
      },
      {
        "id": "server/api/projects/[id]/prompt/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Сборка запроса к модели по шаблону из репозитория. Приложение подставляет данные и отдаёт текст: отправлять его или нет — решает человек (docs/prompts/README.md)."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId].get.ts",
        "title": "[recordId].get",
        "layer": "маршруты",
        "summary": "Три структуры карты и результат сверки каждого утверждения. Пока сверять рано — так и написано: `pending` честнее, чем зелёная галочка (docs/07-maps.md)."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId].patch.ts",
        "title": "[recordId].patch",
        "layer": "маршруты",
        "summary": "Правка полей front matter. Тело документа этот маршрут не принимает вовсе — его здесь нет намеренно (docs/03-server-api.md)."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "title": "ask.post",
        "layer": "маршруты",
        "summary": "Вопрос модели из карточки записи (T-0030): запрос строится на пакете контекста записи, а ответ ложится черновиком заметки во входящее — запись он не правит."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/body.post.ts",
        "title": "body.post",
        "layer": "маршруты",
        "summary": "Правка текста документа человеком (docs/adr/0011-body-editing.md). Раздел «Журнал» и front matter сверх `updated` этот маршрут не трогает — сторож `applyBodyEdit` откажет раньше, чем испорченный текст попадёт в файл."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "«Что меняется» по типу записи (docs/03-server-api.md). Чтение: отметку просмотра ставит POST."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
        "title": "viewed.post",
        "layer": "маршруты",
        "summary": "Разницу открыли: подтверждение после этого пишет в журнал «после просмотра разницы»."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
        "title": "discussion.get",
        "layer": "маршруты",
        "summary": "Обсуждение записи; файла нет — пустое."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
        "title": "discussion.post",
        "layer": "маршруты",
        "summary": "`thread` — новое замечание, `reply` — ответ, `close` — закрыть."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "title": "map-diff.get",
        "layer": "маршруты",
        "summary": "Разница карты на схеме (R-0069): «было» — подтверждённые карты до записи, «станет» — вместе с ней. Отдельный от общего `/diff` маршрут: общий несёт текстовую разницу, этот — разметку узлов и связей."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
        "title": "metric-run.post",
        "layer": "маршруты",
        "summary": "Прогон проверки-метрики по запросу Prometheus (R-0066); отчёт passed/failed/skipped."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/status.post.ts",
        "title": "status.post",
        "layer": "маршруты",
        "summary": "Смена статуса. Разрешён переход — меняем `status`, обновляем `updated`, пишем строку в журнал. Запрещён — 409 с перечнем того, что мешает (docs/03-server-api.md). Кнопкой это не обходится."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "title": "target.post",
        "layer": "маршруты",
        "summary": "Целевая дата фазы (T-0034): одно поле front matter, ни оценок задач, ни тела. Пустая дата убирает веху."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
        "title": "verified.post",
        "layer": "маршруты",
        "summary": "Отметка «Проверено» на ручной проверке (docs/03-server-api.md). Ставит или снимает её отчётом в `tests/reports` и строкой в журнале записи."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/work/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Состояние работы по задаче: ветка, дифф, круги (docs/09-execution.md)."
      },
      {
        "id": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Действия над работой: отдать модели, принять дифф, отправить на доработку, отклонить. Приложение не сливает ничего само — принимает человек (docs/adr/0009-work-through-console.md)."
      },
      {
        "id": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "title": "link-map.post",
        "layer": "маршруты",
        "summary": "Общая карта-намерение на пачку `feature`-задач (docs/03-server-api.md). Заводит черновик и ставит `affects` у задач; ничего не подтверждает."
      },
      {
        "id": "server/api/projects/[id]/records/bulk/status.post.ts",
        "title": "status.post",
        "layer": "маршруты",
        "summary": "Массовая смена статуса (docs/03-server-api.md). Целевой статус выбирает сервер для каждой записи сам; ответ — отчёт по каждой, `200` и при отказах."
      },
      {
        "id": "server/api/projects/[id]/records/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Создание записи из шаблона. Идентификатор выдаёт сервер — следующий свободный: номера не переиспользуются, поэтому выбрать его нельзя."
      },
      {
        "id": "server/api/projects/[id]/reference.get.ts",
        "title": "reference.get",
        "layer": "маршруты",
        "summary": "Справки и состояние индекса (docs/13-reference.md). Производное: нигде не хранится."
      },
      {
        "id": "server/api/projects/[id]/reference/rebuild.post.ts",
        "title": "rebuild.post",
        "layer": "маршруты",
        "summary": "«Обновить индекс»: собирает INDEX.md из справок и карты кода и пишет файл (docs/13-reference.md)."
      },
      {
        "id": "server/api/projects/[id]/rules.get.ts",
        "title": "rules.get",
        "layer": "маршруты",
        "summary": "Действующие правила архитектуры после сложения «минимум → общие → локальные» (docs/12-practice-rules.md). Производное: нигде не хранится."
      },
      {
        "id": "server/api/projects/[id]/runs.post.ts",
        "title": "runs.post",
        "layer": "маршруты",
        "summary": "Прогон набора проверок на сборку или релиз (R-0062): тело — `build`, `results` (V-номер → passed/failed/skipped/blocked), `reasons` (причина каждого blocked — обязательна), необязательные `actor`, `by`, `note`."
      },
      {
        "id": "server/api/projects/[id]/search.get.ts",
        "title": "search.get",
        "layer": "маршруты",
        "summary": "Индекс живёт в памяти процесса и привязан к отпечатку файлов: сменился отпечаток — собрали заново."
      },
      {
        "id": "server/api/projects/[id]/search/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "Состояние индекса смыслового поиска и пересборка (окно «Настройки» → «Поиск»). `{ rebuild: true }` выбрасывает кэш и строит заново; иначе — досчитывает изменённое."
      },
      {
        "id": "server/api/projects/[id]/search/semantic.get.ts",
        "title": "semantic.get",
        "layer": "маршруты",
        "summary": "Смысловой поиск (docs/adr/0031-semantic-search.md): пустой запрос — пустой ответ, без работы."
      },
      {
        "id": "server/api/projects/[id]/shared/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "Общие практики проекта (docs/11-shared-sources.md). Источник не назван в манифесте — пустой список, а не ошибка: подключать источники не обязан никто."
      },
      {
        "id": "server/api/projects/[id]/shared/index.patch.ts",
        "title": "index.patch",
        "layer": "маршруты",
        "summary": "Галочка тега на экране «Практики» (docs/11-shared-sources.md): включить или выключить один тег у одного источника."
      },
      {
        "id": "server/api/projects/[id]/sources/apply.post.ts",
        "title": "apply.post",
        "layer": "маршруты",
        "summary": "Записать подтверждённые человеком папки в `sources` манифеста (R-0077): `{ folders: [{ kind, path }] }`. Объединяет с названным, комментарии манифеста не трогает. Путь вне корня — `403`, нет папки — `404`."
      },
      {
        "id": "server/api/projects/[id]/sources/detect.get.ts",
        "title": "detect.get",
        "layer": "маршруты",
        "summary": "Автопоиск источников (R-0077): папки кода, клиента, документации и тестов, файлы контрактов, зависимостей и отчётов CI. Ничего не пишет: находка — предложение, записывает человек (`POST …/sources/apply`)."
      },
      {
        "id": "server/api/projects/[id]/team.get.ts",
        "title": "team.get",
        "layer": "маршруты",
        "summary": "Команда проекта из манифеста; у каждого — известен ли логин среди учёток сервера. Незнакомый логин не ошибка процесса, а предупреждение: человека могут завести позже."
      },
      {
        "id": "server/api/projects/git-init.post.ts",
        "title": "git-init.post",
        "layer": "маршруты",
        "summary": "`git init -b main` в папке проекта — только с согласия человека (R-0094): тело обязано нести `consent: true`, иначе отказ. Репозиторий уже есть — ничего не делаем. Больше git ничего не меняет:"
      },
      {
        "id": "server/api/projects/git-status.get.ts",
        "title": "git-status.get",
        "layer": "маршруты",
        "summary": "Git-репозиторий в папке проекта (R-0094): подключение проверяет его до заведения формата. Ответ — `{ repo, branch }`; папки нет — `404`, путь вне разрешённых корней — `403`."
      },
      {
        "id": "server/api/projects/index.get.ts",
        "title": "index.get",
        "layer": "маршруты",
        "summary": "GET /api/projects"
      },
      {
        "id": "server/api/projects/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "summary": "POST /api/projects"
      },
      {
        "id": "server/api/projects/init.post.ts",
        "title": "init.post",
        "layer": "маршруты",
        "summary": "Заведение формата в пустом проекте: манифест, папки разделов и первая запись. Дальше наполняет человек — приложение записей за него не пишет."
      },
      {
        "id": "server/lib/actions.ts",
        "title": "actions",
        "layer": "ядро",
        "summary": "Действия процесса: что именно меняется в файле и что уходит в журнал. Чистые функции над текстом файла — файловая система остаётся у маршрута."
      },
      {
        "id": "server/lib/agent-run.ts",
        "title": "agent-run",
        "layer": "ядро",
        "summary": "«Запустить в работу» (R-0100, ADR-0033): какой агент берёт задачу, что ему уходит в запрос и какие действия он вернул. Чистые функции:"
      },
      {
        "id": "server/lib/agents.ts",
        "title": "agents",
        "layer": "ядро",
        "summary": "Агенты ролей (R-0091, docs/adr/0033-role-agents.md): определение агента — файл проекта `docs/agents/<id>.md`, ограничения аккаунта агента — здесь, в коде консоли. Чистые функции:"
      },
      {
        "id": "server/lib/analyst.ts",
        "title": "analyst",
        "layer": "ядро",
        "summary": "Помощник аналитика (T-0038): собирает запрос к модели по пакету контекста — само требование, соседние требования и термины глоссария. Приложение ничего не применяет: ответ читает человек (ADR-0008)."
      },
      {
        "id": "server/lib/analyze.ts",
        "title": "analyze",
        "layer": "ядро",
        "summary": "Уже разобранные отчёты: файлы читает фаза 4, схема проверяет их отдельно."
      },
      {
        "id": "server/lib/architecture-capabilities.ts",
        "title": "architecture-capabilities",
        "layer": "ядро",
        "summary": "Сверка модулей с функциональной картой (docs/07-maps.md, «Аудит моделью»): модуль верхнего уровня без возможности и возможность без модуля. Это замечания, а не нарушения:"
      },
      {
        "id": "server/lib/attachments.ts",
        "title": "attachments",
        "layer": "ядро",
        "summary": "Вложения к прогону и дефекту (R-0099, docs/02-workspace-contract.md): скриншоты и логи лежат файлами в репозитории проекта рядом с отчётами — своей базы у консоли нет. Чистые функции:"
      },
      {
        "id": "server/lib/auth.ts",
        "title": "auth",
        "layer": "ядро",
        "summary": "Учётная запись приложения (docs/adr/0020-people-roles-permissions.md): не содержание проекта."
      },
      {
        "id": "server/lib/batch-check.ts",
        "title": "batch-check",
        "layer": "ядро",
        "summary": "Сверка пачки по функции (R-0092, docs/10-inbox.md): требования, задачи и проверки одной функции проверяются вместе, а не по одной. Чистые функции над записями процесса — без файловой системы."
      },
      {
        "id": "server/lib/branch.ts",
        "title": "branch",
        "layer": "ядро",
        "summary": "Имена ветки и рабочего дерева задачи (docs/09-execution.md). Чистые функции: по одной и той же записи всегда получается одно и то же имя, поэтому повторный заход находит ту же ветку, а не заводит вторую."
      },
      {
        "id": "server/lib/builtin.ts",
        "title": "builtin",
        "layer": "ядро",
        "summary": "Встроенный набор практик (docs/11-shared-sources.md, «Встроенный набор»; ADR-0015): каталог `practices/` в репозитории консоли — обычный источник практик, подключённый по зарезервированному пути `builtin`."
      },
      {
        "id": "server/lib/cache.ts",
        "title": "cache",
        "layer": "ядро",
        "summary": "Кэш индекса в `.docdd/index.json` внутри проекта. Он производный: его можно удалить, он не попадает в git, и приложение обязано работать при его отсутствии (docs/01-architecture.md)."
      },
      {
        "id": "server/lib/context-pack.ts",
        "title": "context-pack",
        "layer": "ядро",
        "summary": "Пакет контекста запроса (docs/adr/0021-context-pack.md): чистая функция над графом записей. Одинаковый вход даёт одинаковый пакет — иначе спор о том, что модель «не знала», не решить чтением."
      },
      {
        "id": "server/lib/contract-digest.ts",
        "title": "contract-digest",
        "layer": "ядро",
        "summary": "Факты контракта человеческим языком, прямо в запрос на починку. Проект может держать у себя копию документации DocDD — снимок правил на момент, когда её туда положили."
      },
      {
        "id": "server/lib/contracts-import.ts",
        "title": "contracts-import",
        "layer": "ядро",
        "summary": "Контракты, справки и глоссарий из кода и документации (R-0080, docs/04-ui.md, «Подключение»)."
      },
      {
        "id": "server/lib/course.ts",
        "title": "course",
        "layer": "ядро",
        "summary": "История курса проекта (docs/07-maps.md, «Источник правды и история курса»). Своего хранилища нет: время и автор правки курса уже лежат в записи карты — в строке журнала, которой она получила `approved`."
      },
      {
        "id": "server/lib/coverage.ts",
        "title": "coverage",
        "layer": "ядро",
        "summary": "Покрытие процессом: что стоит за возможностью в проекте — требования, задачи, проверки и код (docs/07-maps.md, «Покрытие процессом»). Полей у возможности для этого нет:"
      },
      {
        "id": "server/lib/criteria.ts",
        "title": "criteria",
        "layer": "ядро",
        "summary": "Критерии приёмки в теле требования (docs/15-team-platform.md, R-0015). Чистые функции над текстом: раздел «Критерии приёмки» → список критериев, из каждого — заготовка записи `verification`."
      },
      {
        "id": "server/lib/custom-maps.ts",
        "title": "custom-maps",
        "layer": "ядро",
        "summary": "Пользовательские карты (docs/adr/0028-custom-maps.md): определения из манифеста, вид одной карты из сложенной картины и текст черновика. Чистые функции — без файловой системы, их зовут маршруты и правила."
      },
      {
        "id": "server/lib/design-catalog.ts",
        "title": "design-catalog",
        "layer": "ядро",
        "summary": "Каталог историй как контракт (docs/16-design-system.md, «Storybook как контракт», R-0054, R-0055, R-0056). Консоль Storybook не запускает:"
      },
      {
        "id": "server/lib/design-constructors.ts",
        "title": "design-constructors",
        "layer": "ядро",
        "summary": "Конструкторы форм и таблиц (docs/16-design-system.md, «Конструкторы»): по описанию полей или колонок отдают заготовку компонента выбранного стека на токенах дизайна и **заготовку словаря на каждый язык проекта** — как у…"
      },
      {
        "id": "server/lib/design-contract.ts",
        "title": "design-contract",
        "layer": "ядро",
        "summary": "Контракт компонента (docs/16-design-system.md, «Контракт компонента», R-0053): уровень, из чего собран, варианты, свойства, слоты, события. Состояния и слои остаются в `DesignComponent` как были."
      },
      {
        "id": "server/lib/design-diff.ts",
        "title": "design-diff",
        "layer": "ядро",
        "summary": "Разница токенов дизайна у записи на подтверждении (R-0073): палитра «было / станет», контраст до и после, файлы выгрузки по стекам, которые поменяются."
      },
      {
        "id": "server/lib/design-export.ts",
        "title": "design-export",
        "layer": "ядро",
        "summary": "Выгрузка токенов дизайна в файлы темы четырёх стеков (docs/16-design-system.md, «Стеки и выгрузка») и сверка файла проекта с тем, что дала бы выгрузка. Чистые функции:"
      },
      {
        "id": "server/lib/design-figma.ts",
        "title": "design-figma",
        "layer": "ядро",
        "summary": "Импорт токенов из Figma Variables (docs/16-design-system.md, «Токены из Figma»): разбор ответа REST API `GET /v1/files/:key/variables/local` (или его части `meta`) в блок `docdd-design` и перечень расхождений с токенами…"
      },
      {
        "id": "server/lib/design-port.ts",
        "title": "design-port",
        "layer": "ядро",
        "summary": "Снимки историй и перенос компонента на стек (docs/16-design-system.md, «Storybook как контракт», R-0056, R-0057)."
      },
      {
        "id": "server/lib/design-screens.ts",
        "title": "design-screens",
        "layer": "ядро",
        "summary": "Проверка экранов проекта моделью (docs/16-design-system.md, «Проверка экранов моделью»): опись снимков по экрану, ширине и теме, разбор ответа модели в находки. Чистые функции — файловая система и запуск модели снаружи."
      },
      {
        "id": "server/lib/design-surface.ts",
        "title": "design-surface",
        "layer": "ядро",
        "summary": "Поверхности и вид (docs/16-design-system.md, «Поверхности и вид»): тени карточек, подложка страницы, мягкая заливка плашек и подписи капсом."
      },
      {
        "id": "server/lib/design-theme.ts",
        "title": "design-theme",
        "layer": "ядро",
        "summary": "Конструктор тем (docs/16-design-system.md, «Цветовые темы»): чистые функции под экран."
      },
      {
        "id": "server/lib/design.ts",
        "title": "design",
        "layer": "ядро",
        "summary": "Токены дизайна (docs/16-design-system.md, ADR-0022, ADR-0023): разбор блоков `docdd-design` из подтверждённых `decision`/`design`, сложение «общее → локальное» с источником у каждой части и проверки — контраст по WCAG,…"
      },
      {
        "id": "server/lib/diagrams.ts",
        "title": "diagrams",
        "layer": "ядро",
        "summary": "Два способа задать диаграмму, оба обязательны к поддержке (docs/02-workspace-contract.md): блок ```mermaid внутри документа и отдельный файл `.mmd`, вставленный ссылкой. Отрисовка — фаза 4, здесь только разбор."
      },
      {
        "id": "server/lib/discussion.ts",
        "title": "discussion",
        "layer": "ядро",
        "summary": "Обсуждение у записи (R-0060): замечания и ответы лежат файлом рядом с записью (`<имя записи>.discussion.json`), а текст самого документа не трогают. Чистые функции над объектом файла; чтение и запись — в слое сервера."
      },
      {
        "id": "server/lib/external-import.ts",
        "title": "external-import",
        "layer": "ядро",
        "summary": "Импорт из внешних систем (T-0047, T-0048): выгрузка Jira (CSV/JSON) и страницы Confluence (HTML/Markdown) превращаются в заметки входящего."
      },
      {
        "id": "server/lib/fix-diff.ts",
        "title": "fix-diff",
        "layer": "ядро",
        "summary": "Предпросмотр починки «было → станет» (R-0072): план модели — таблица «Файл | Что меняем | Во что | Почему» (docs/prompts/fix-plan.md). Чистая функция:"
      },
      {
        "id": "server/lib/flow-groups.ts",
        "title": "flow-groups",
        "layer": "ядро",
        "summary": "Группы на потоках данных (docs/07-maps.md, «Потоки данных», «Группы и здесь»). Своих групп у потоков нет: код берётся из групп кодовой карты, а источники сворачиваются по `kind`. Чистые функции — их считает экран."
      },
      {
        "id": "server/lib/functional.ts",
        "title": "functional",
        "layer": "ядро",
        "summary": "Функциональная карта: состояние реализации, приоритет, связи между возможностями и то, что из них выводится (docs/07-maps.md, «Состояние реализации», «Приоритет и горизонт», «Связи между возможностями», «Что дальше и…"
      },
      {
        "id": "server/lib/glob.ts",
        "title": "glob",
        "layer": "ядро",
        "summary": "Пути правил архитектуры (docs/12-practice-rules.md): `*` — один сегмент, `**` — любая глубина, остальное буквально. Чистые функции."
      },
      {
        "id": "server/lib/glossary.ts",
        "title": "glossary",
        "layer": "ядро",
        "summary": "Глоссарий проекта (T-0041). Формат — файл `docs/development/glossary.md`, строка на термин: `- **Термин** — определение` (тире, двоеточие или дефис). Решение о формате оформляется отдельной записью A- человеком."
      },
      {
        "id": "server/lib/graph.ts",
        "title": "graph",
        "layer": "ядро",
        "summary": "Связи как они записаны в `links`."
      },
      {
        "id": "server/lib/groups.ts",
        "title": "groups",
        "layer": "ядро",
        "summary": "Группы кодовой карты — уровень над модулями (docs/07-maps.md, «Группы: уровень над модулями»). Чистые функции над списками: их считает экран, а не сервер, и считает одним правилом, чтобы обзор и вид группы не разошлись."
      },
      {
        "id": "server/lib/hierarchy.ts",
        "title": "hierarchy",
        "layer": "ядро",
        "summary": "Исходные связи: стрелку всегда можно развернуть до опоры внизу."
      },
      {
        "id": "server/lib/ignore.ts",
        "title": "ignore",
        "layer": "ядро",
        "summary": "`.gitignore`, читаемый ровно настолько, насколько нужно описи кода (docs/07-maps.md):"
      },
      {
        "id": "server/lib/import.ts",
        "title": "import",
        "layer": "ядро",
        "summary": "Импорт существующей документации. Приложение показывает, что нашло, и применяет утверждённый человеком план — предполагать за него оно не берётся (docs/adr/0003-no-llm-in-app.md)."
      },
      {
        "id": "server/lib/inbox.ts",
        "title": "inbox",
        "layer": "ядро",
        "summary": "Разбор входящего: из сырых заметок — список предложенных записей (docs/10-inbox.md). Здесь только счёт над текстом: файлы читает и создаёт вызывающий."
      },
      {
        "id": "server/lib/indexer.ts",
        "title": "indexer",
        "layer": "ядро",
        "summary": "Поля, которые понимает контракт; всё остальное уходит в `extra` нетронутым."
      },
      {
        "id": "server/lib/intent-map.ts",
        "title": "intent-map",
        "layer": "ядро",
        "summary": "Карта-намерение на пачку задач (docs/07-maps.md, «Карта-намерение на пачку задач»): одна общая карта, а не по карте на каждую `feature`-задачу. Чистые функции — файлы пишет вызывающий."
      },
      {
        "id": "server/lib/inventory.ts",
        "title": "inventory",
        "layer": "ядро",
        "summary": "Опись файлов кода (docs/07-maps.md, раздел «Опись файлов»). Карта строится не «за один взгляд на проект», а по описи:"
      },
      {
        "id": "server/lib/issues-diff.ts",
        "title": "issues-diff",
        "layer": "ядро",
        "summary": "Нарушения, которых до действия не было (docs/03-server-api.md, `newIssues`). Ключ — код, запись, файл и текст: то же нарушение узнаётся, а сменившее объяснение считается новым, потому что стало другим."
      },
      {
        "id": "server/lib/job-feed.ts",
        "title": "job-feed",
        "layer": "ядро",
        "summary": "Лента задания к модели (ADR-0034): события копятся на сервере, а не только уходят в соединение."
      },
      {
        "id": "server/lib/knowledge.ts",
        "title": "knowledge",
        "layer": "ядро",
        "summary": "Пространство знаний (R-0016, docs/15-team-platform.md): заметки входящего как дерево страниц. Документы проекта сюда не входят — у них свои пункты меню (docs/04-ui.md, «Навигация»)."
      },
      {
        "id": "server/lib/layers.ts",
        "title": "layers",
        "layer": "ядро",
        "summary": "Слой модуля для экрана кодовой карты (docs/07-maps.md, «`layer` не обязателен»). Чистая функция:"
      },
      {
        "id": "server/lib/llm-provider.ts",
        "title": "llm-provider",
        "layer": "ядро",
        "summary": "Интерфейс провайдера модели (docs/adr/0019-llm-providers.md, T-0019). Живёт в lib/, а не в utils/: это чистые типы и реестр без Nuxt, чтобы маршрутизация, учёт и очередь опирались на контракт, а не на Claude Code."
      },
      {
        "id": "server/lib/llm-queue.ts",
        "title": "llm-queue",
        "layer": "ядро",
        "summary": "Очередь запросов к модели на сервере (ADR-0019, R-0010). Задание живёт в памяти сервера, а не страницы: обновление страницы его не обрывает, а список видит вся команда (права проверяет вызывающий API)."
      },
      {
        "id": "server/lib/llm-routing.ts",
        "title": "llm-routing",
        "layer": "ядро",
        "summary": "Маршрутизация: вид запроса → провайдер и модель (ADR-0019). Чистые функции без обращения к файлам. Типы здесь свои и минимальные:"
      },
      {
        "id": "server/lib/llm-usage.ts",
        "title": "llm-usage",
        "layer": "ядро",
        "summary": "Учёт запросов к модели (ADR-0019): одна строка JSON на запрос. Чистые функции; запись в `.data/llm-usage.jsonl` — в server/utils/llm-usage-store.ts. Это данные приложения, а не проекта, поэтому в docs/development их нет."
      },
      {
        "id": "server/lib/manager.ts",
        "title": "manager",
        "layer": "ядро",
        "summary": "Рабочее место менеджера (docs/15-team-platform.md, фаза 29). Чистые функции над записями индекса: доска, дорожная карта, вехи, сводка и вопросы помощнику. Ничего не хранится — всё считается из файлов проекта."
      },
      {
        "id": "server/lib/manifest-write.ts",
        "title": "manifest-write",
        "layer": "ядро",
        "summary": "Точечная правка манифеста (docs/02-workspace-contract.md). Манифест — файл человека: в нём бывают комментарии и порядок, важный тому, кто его писал."
      },
      {
        "id": "server/lib/manual-report.ts",
        "title": "manual-report",
        "layer": "ядро",
        "summary": "Ручная отметка «Проверено» (docs/02-workspace-contract.md, «Ручная отметка „Проверено“»): человек проверил сам, и приложение фиксирует это тем же отчётом, каким фиксируется любой прогон."
      },
      {
        "id": "server/lib/map-diff.ts",
        "title": "map-diff",
        "layer": "ядро",
        "summary": "Разница карты на самой схеме (R-0069, docs/04-ui.md). «Было» — сложенная картина подтверждённых карт до этой записи, «станет» — она же вместе с ней. Чистые функции:"
      },
      {
        "id": "server/lib/map-schemas.ts",
        "title": "map-schemas",
        "layer": "ядро",
        "summary": "Форма блоков карты для запроса к модели. Считается из тех же схем, по которым идёт проверка: разойтись они не могут, а разошедшись — отказали бы ответу целиком (docs/07-maps.md)."
      },
      {
        "id": "server/lib/maps.ts",
        "title": "maps",
        "layer": "ядро",
        "summary": "Карты проекта (docs/07-maps.md). Разбор трёх структур из тела записи и сверка свидетельств. Чистые функции:"
      },
      {
        "id": "server/lib/metrics.ts",
        "title": "metrics",
        "layer": "ядро",
        "summary": "Метрики процесса в текстовом формате Prometheus (R-0065). Своей базы нет: значения считаются из индекса при каждом запросе, историю хранит Prometheus."
      },
      {
        "id": "server/lib/new-project.ts",
        "title": "new-project",
        "layer": "ядро",
        "summary": "Мастер нового проекта (R-0076, docs/04-ui.md, «Подключение»): из вектора, списка возможностей и глоссария — черновики записей до первой задачи. Чистые функции:"
      },
      {
        "id": "server/lib/notifications.ts",
        "title": "notifications",
        "layer": "ядро",
        "summary": "Уведомления команды (R-0059, docs/15-team-platform.md). Чистые функции над списком: файлов и сети здесь нет, чтобы их можно было тестировать без сервера."
      },
      {
        "id": "server/lib/onboarding.ts",
        "title": "onboarding",
        "layer": "ядро",
        "summary": "Подключение проекта (R-0075, docs/04-ui.md, «Подключение»): чек-лист «Готовность проекта». Каждый шаг — одно, чего не хватает консоли, чтобы вести проект; статус не ставится руками, а вычисляется по состоянию проекта."
      },
      {
        "id": "server/lib/order-diff.ts",
        "title": "order-diff",
        "layer": "ядро",
        "summary": "Общий вид «было → станет» для порядка (R-0072): предпросмотры порядка по важности и разбиения на фазы. Чистая функция — места считает сервер/библиотека, а не экран, чтобы три предпросмотра не разошлись в счёте."
      },
      {
        "id": "server/lib/overview.ts",
        "title": "overview",
        "layer": "ядро",
        "summary": "Обзор проекта (docs/04-ui.md, «Обзор»): готово ли обещанное, что в проде, что делается и проверяется. Чистая функция над индексом — экран только рисует."
      },
      {
        "id": "server/lib/parse.ts",
        "title": "parse",
        "layer": "ядро",
        "summary": "Разбор одной записи. Строка на входе, объект на выходе — файловой системы здесь нет, поэтому разбор тестируется без окружения."
      },
      {
        "id": "server/lib/paths.ts",
        "title": "paths",
        "layer": "ядро",
        "summary": "Единственное место, где решается, можно ли трогать путь. Сервер работает только внутри объявленного корня проекта: любой путь за его пределы — отказ, без исключений (docs/01-architecture.md, раздел «Безопасность»)."
      },
      {
        "id": "server/lib/permissions.ts",
        "title": "permissions",
        "layer": "ядро",
        "summary": "Матрица «роль → действие» (docs/adr/0020-people-roles-permissions.md, п. 4). Чистые функции: проверяются без сервера. Манифест может права только сузить."
      },
      {
        "id": "server/lib/phase-plan.ts",
        "title": "phase-plan",
        "layer": "ядро",
        "summary": "Разбиение задач на фазы (docs/04-ui.md, «Разбить на фазы»). Чистые функции: какие задачи отдавать модели и что из её ответа можно завести. Номера и файлы — дело вызывающего, как и у входящего."
      },
      {
        "id": "server/lib/portfolio.ts",
        "title": "portfolio",
        "layer": "ядро",
        "summary": "Строка портфеля (T-0042): сводка одного проекта из его индекса. Чистая функция — экран и проверка строятся на одном и том же, а файлов не читает."
      },
      {
        "id": "server/lib/practice-rules.ts",
        "title": "practice-rules",
        "layer": "ядро",
        "summary": "Правила проверки в практиках (docs/12-practice-rules.md, ADR-0014): разбор блоков `docdd-rules` из подтверждённых `decision`/`design` и сложение «встроенный минимум → общие → локальные»."
      },
      {
        "id": "server/lib/project-templates.ts",
        "title": "project-templates",
        "layer": "ядро",
        "summary": "Шаблоны проекта (R-0090): данные, а не движок. Шаблон называет контуры — возможности первого уровня функциональной карты, — заготовки своих карт по ролям и роли команды."
      },
      {
        "id": "server/lib/prompt.ts",
        "title": "prompt",
        "layer": "ядро",
        "summary": "Сборка запроса к модели: шаблон из репозитория плюс данные проекта. Чистые функции над строками — сам шаблон приходит снаружи, а запуск модели живёт в `server/utils/llm.ts` (docs/adr/0008-llm-through-claude-code.md)."
      },
      {
        "id": "server/lib/record-diff.ts",
        "title": "record-diff",
        "layer": "ядро",
        "summary": "Разница «было → станет» для записи на подтверждении (R-0068, R-0070, R-0071). Чистые функции над строками: git и файлы живут в utils, чтобы это тестировалось без окружения."
      },
      {
        "id": "server/lib/reference.ts",
        "title": "reference",
        "layer": "ядро",
        "summary": "Индекс справочника (docs/13-reference.md, ADR-0016): один короткий файл «что уже есть» — модули проекта из подтверждённой карты кода и справки о внешних решениях. Чистая функция: файлы читает и пишет вызывающая сторона."
      },
      {
        "id": "server/lib/reports.ts",
        "title": "reports",
        "layer": "ядро",
        "summary": "Отчёты складываются в «последний результат» по времени начала прогона: у проверки нет статуса, есть факт последнего запуска. Файлы читает фаза 4, сюда они приходят уже разобранными."
      },
      {
        "id": "server/lib/reviewer.ts",
        "title": "reviewer",
        "layer": "ядро",
        "summary": "Ревьюер задачи (docs/adr/0030-task-reviewer.md): кто её принимает. Явное поле `reviewer` побеждает; без него — правило по видам проверок и типу изменения. Чистая функция: ей хватает записей индекса и ролей манифеста."
      },
      {
        "id": "server/lib/role-maps.ts",
        "title": "role-maps",
        "layer": "ядро",
        "summary": "Заготовки своих карт под роли (R-0087, docs/adr/0028-custom-maps.md): кнопка «Новая карта» предлагает их как отправную точку, дальше определение правится как любое другое. Чистые данные:"
      },
      {
        "id": "server/lib/rules.ts",
        "title": "rules",
        "layer": "ядро",
        "summary": "Правила архитектуры из манифеста; нет секции — нет проверки (docs/07-maps.md)."
      },
      {
        "id": "server/lib/scaffold.ts",
        "title": "scaffold",
        "layer": "ядро",
        "summary": "Заведение записей и формата: шаблоны, слаги, выдача номеров. Чистые функции над строками — папки создаёт маршрут."
      },
      {
        "id": "server/lib/schema-digest.ts",
        "title": "schema-digest",
        "layer": "ядро",
        "summary": "Выжимка из JSON Schema — человеческим языком, для запроса к модели. Запрос не может сослаться на файл схемы: модель работает в чужом проекте, а схемы лежат здесь."
      },
      {
        "id": "server/lib/schema.ts",
        "title": "schema",
        "layer": "ядро",
        "summary": "Схемы берутся прямо из docs/schemas: копия разошлась бы с контрактом в первую же неделю."
      },
      {
        "id": "server/lib/search.ts",
        "title": "search",
        "layer": "ядро",
        "summary": "Полнотекстовый поиск по записям и знаниям (T-0040). Обратный индекс «слово → документы» строится из текстов в памяти и пересобирается при смене отпечатка файлов: своей базы нет, всё производное (ADR-0001)."
      },
      {
        "id": "server/lib/semantic.ts",
        "title": "semantic",
        "layer": "ядро",
        "summary": "Смысловой поиск (docs/adr/0031-semantic-search.md): блоки записей, локальный хеш-эмбеддинг и отбор лучших по скалярному произведению нормализованных векторов. Чистые функции — без файлов и сети."
      },
      {
        "id": "server/lib/shared.ts",
        "title": "shared",
        "layer": "ядро",
        "summary": "Общие практики между проектами (docs/11-shared-sources.md, docs/06-phases.md, фаза 13)."
      },
      {
        "id": "server/lib/source-detect.ts",
        "title": "source-detect",
        "layer": "ядро",
        "summary": "Автопоиск источников проекта (R-0077, docs/04-ui.md, «Подключение»): по списку путей файлов находит папки кода, клиента, документации и тестов; файлы контрактов, зависимостей и отчётов CI. Чистые функции над строками:"
      },
      {
        "id": "server/lib/strategy.ts",
        "title": "strategy",
        "layer": "ядро",
        "summary": "Стратегический уровень и здоровье узла (R-0084, R-0085; docs/07-maps.md, «Стратегия и здоровье узла»). Стратегия — вид верхнего уровня функциональной карты, а не вторая сущность."
      },
      {
        "id": "server/lib/stream-events.ts",
        "title": "stream-events",
        "layer": "ядро",
        "summary": "Разбор ленты Claude Code (`--output-format stream-json`) в события, которые показывает экран (docs/04-ui.md, раздел «Что модель делает прямо сейчас»). Чистые функции над строками: ни процессов, ни файлов."
      },
      {
        "id": "server/lib/task-order.ts",
        "title": "task-order",
        "layer": "ядро",
        "summary": "Привести задачу в порядок прямо в карточке (docs/04-ui.md, «Запись»): выбор требования для `implements`. Чистые функции — файлы и сеть остаются снаружи."
      },
      {
        "id": "server/lib/test-checks.ts",
        "title": "test-checks",
        "layer": "ядро",
        "summary": "Проверки из существующих тестов (R-0079, docs/04-ui.md, «Подключение»): находит тестовые файлы проекта, сопоставляет их с требованиями и предлагает проверки вида unit/integration с командой запуска; разбирает отчёт…"
      },
      {
        "id": "server/lib/transitions.ts",
        "title": "transitions",
        "layer": "ядро",
        "summary": "Куда запись может двинуться из своего статуса и что этому мешает. Считает сервер теми же правилами, что дают список нарушений: экран не знает процесс."
      },
      {
        "id": "server/lib/types.ts",
        "title": "types",
        "layer": "ядро",
        "summary": "Общие типы ядра. Кода здесь нет намеренно: тип записи и код нарушения — часть контракта из docs/02-workspace-contract.md и docs/05-validation.md, и им нужно одно место, а не копия в каждом модуле."
      },
      {
        "id": "server/lib/verify-desk.ts",
        "title": "verify-desk",
        "layer": "ядро",
        "summary": "Рабочее место тестировщика на «Сверке» (docs/04-ui.md, «Сверка — рабочее место тестировщика»): факт каждой проверки одним словом и пробелы покрытия. Чистые функции над индексом."
      },
      {
        "id": "server/lib/version.ts",
        "title": "version",
        "layer": "ядро",
        "summary": "Версия записи для оптимистической блокировки (R-0018). Хэш содержания, а не `updated`: дата хранится с точностью до дня, и две правки за день были бы неотличимы."
      },
      {
        "id": "server/lib/work-order.ts",
        "title": "work-order",
        "layer": "ядро",
        "summary": "Порядок работы по важности (docs/04-ui.md, «Порядок по важности»; docs/02-workspace-contract.md, «Порядок фаз»). Чистые функции над записями:"
      },
      {
        "id": "server/lib/workspace.ts",
        "title": "workspace",
        "layer": "ядро",
        "summary": "Чтение проекта с диска. Всё, что читается здесь, дальше передаётся ядру строками и объектами: разбор и правила о файловой системе не знают."
      },
      {
        "id": "server/lib/write.ts",
        "title": "write",
        "layer": "ядро",
        "summary": "Запись front matter и журнала. Чистые функции над строками: файл читает и пишет маршрут, а здесь решается, каким он станет. Front matter правится построчно, а не пересобирается из объекта."
      },
      {
        "id": "server/middleware/audit.ts",
        "title": "audit",
        "layer": "серверный каркас",
        "summary": "Файл журнала доступа (T-0018): рядом с прочими данными сервера, не в проекте."
      },
      {
        "id": "server/middleware/auth.ts",
        "title": "auth",
        "layer": "серверный каркас",
        "summary": "Единая точка входа и прав (docs/adr/0020-people-roles-permissions.md): каждый запрос к /api проходит здесь до маршрута, поэтому новый пишущий маршрут не может забыть спросить право."
      },
      {
        "id": "server/utils/abort.ts",
        "title": "abort",
        "layer": "серверные утилиты",
        "summary": "Человек нажал «Отменить» — браузер обрывает запрос. Превращаем этот обрыв в сигнал, по которому снимается запущенная программа: отмена, оставляющая процесс работать, обманывает (docs/04-ui.md, раздел «Запрос к модели»)."
      },
      {
        "id": "server/utils/agent-run-service.ts",
        "title": "agent-run-service",
        "layer": "серверные утилиты",
        "summary": "Запуск агента по задаче (R-0100, docs/09-execution.md, «Запуск агента роли»). Токен агента не покидает сервер:"
      },
      {
        "id": "server/utils/agents-service.ts",
        "title": "agents-service",
        "layer": "серверные утилиты",
        "summary": "Агенты проекта — файлы `docs/agents/<id>.md` (ADR-0033). Всё — внутри корня проекта; незнакомое в папке не трогаем, нечитаемый файл называем, а не роняем список."
      },
      {
        "id": "server/utils/architecture-service.ts",
        "title": "architecture-service",
        "layer": "серверные утилиты",
        "summary": "Нарушения архитектуры по подтверждённой карте кода и правилам `architecture` манифеста (docs/03-server-api.md, `GET /architecture`). Производное: нигде не хранится, считается заново на каждый запрос."
      },
      {
        "id": "server/utils/auth.ts",
        "title": "auth",
        "layer": "серверные утилиты",
        "summary": "Вход выключен по умолчанию: локальный режим одного человека работает как раньше. Включается `DOCDD_AUTH=on` (общий сервер)."
      },
      {
        "id": "server/utils/bulk-service.ts",
        "title": "bulk-service",
        "layer": "серверные утилиты",
        "summary": "Массовая смена статуса (docs/03-server-api.md, `records/bulk/status`). Записи идут по очереди, и каждая читается заново: перед следующей файлы уже такие, какими их оставила предыдущая."
      },
      {
        "id": "server/utils/chosen.ts",
        "title": "chosen",
        "layer": "серверные утилиты",
        "summary": "Нарушения, названные браузером (docs/04-ui.md, раздел «Нарушения»). Читаем строго: сюда приходит выбор человека, и всё, что не похоже на нарушение, просто не попадает в список."
      },
      {
        "id": "server/utils/context-service.ts",
        "title": "context-service",
        "layer": "серверные утилиты",
        "summary": "Пакет контекста для проекта (docs/adr/0021-context-pack.md): читает записи с диска и отдаёт их чистой функции. Список источников расширяется (`SOURCES`):"
      },
      {
        "id": "server/utils/contracts-service.ts",
        "title": "contracts-service",
        "layer": "серверные утилиты",
        "summary": "Контракты, справки и глоссарий из кода и документации (R-0080): шаги подключения. Читают файлы проекта, ничего не перетирают, всё приходит черновиками с указанием источника."
      },
      {
        "id": "server/utils/design-catalog-service.ts",
        "title": "design-catalog-service",
        "layer": "серверные утилиты",
        "summary": "Матрица «компонент × состояние × стек» по выгрузкам каталогов историй (docs/16-design-system.md, «Storybook как контракт»)."
      },
      {
        "id": "server/utils/design-diff-service.ts",
        "title": "design-diff-service",
        "layer": "серверные утилиты",
        "summary": "Разница токенов записи дизайна (R-0073): «было» — подтверждённые записи без неё, «станет» — вместе с ней, в любом статусе. Сборка входа та же, что у `projectDesign`."
      },
      {
        "id": "server/utils/design-screens-service.ts",
        "title": "design-screens-service",
        "layer": "серверные утилиты",
        "summary": "Снимки экранов и находки проверки (docs/16-design-system.md). Читает файлы внутри корня проекта: каталог снимков называет манифест, наружу корня путь не выходит (`resolveInside`)."
      },
      {
        "id": "server/utils/design-service.ts",
        "title": "design-service",
        "layer": "серверные утилиты",
        "summary": "Токены дизайна проекта (docs/16-design-system.md, ADR-0022). Общие записи читаются тем же путём, что и правила из практик: источники `sources.shared` по тегам, только подтверждённое."
      },
      {
        "id": "server/utils/fix-service.ts",
        "title": "fix-service",
        "layer": "серверные утилиты",
        "summary": "Починка нарушений моделью по подтверждённому человеком плану (docs/adr/0010-model-fixes-violations.md). Отличие от работы над задачей одно и важное:"
      },
      {
        "id": "server/utils/git.ts",
        "title": "git",
        "layer": "серверные утилиты",
        "summary": "Работа с git. Приложение делает ровно три вещи: заводит ветку задачи, коммитит принятое и сливает перемоткой (docs/adr/0009-work-through-console.md)."
      },
      {
        "id": "server/utils/http.ts",
        "title": "http",
        "layer": "серверные утилиты",
        "summary": "Единый вид ошибки из docs/03-server-api.md. Своё тело ответа, а не обёртка Nitro: контракт написан до кода, и менять его ради удобства сервера нельзя."
      },
      {
        "id": "server/utils/inbox-service.ts",
        "title": "inbox-service",
        "layer": "серверные утилиты",
        "summary": "Входящее: сырые заметки и заведение записей по ним (docs/10-inbox.md). Записи создаёт приложение, а не модель: номера выдаёт оно, front matter и имена файлов — его работа."
      },
      {
        "id": "server/utils/index-service.ts",
        "title": "index-service",
        "layer": "серверные утилиты",
        "summary": "Индекс пересобирается, когда изменился отпечаток файлов. Кэш производный: при его отсутствии всё работает, просто медленнее."
      },
      {
        "id": "server/utils/intent-map-service.ts",
        "title": "intent-map-service",
        "layer": "серверные утилиты",
        "summary": "Карта-намерение на пачку уже заведённых задач (docs/03-server-api.md, `records/bulk/link-map`). Берутся только `feature`-задачи без единой `affects`; карта — черновик, ничего не подтверждается."
      },
      {
        "id": "server/utils/inventory-service.ts",
        "title": "inventory-service",
        "layer": "серверные утилиты",
        "summary": "Опись файлов проекта: отпечатки и память о том, что уже описано (docs/07-maps.md, раздел «Опись файлов»). Память лежит в `.docdd` и потому расходная: удалили — следующий заход перечитает всё заново."
      },
      {
        "id": "server/utils/job-feeds.ts",
        "title": "job-feeds",
        "layer": "серверные утилиты",
        "summary": "Реестр лент заданий к модели (ADR-0034): в памяти процесса, законченная лента живёт час — достаточно, чтобы переподключиться после обновления страницы; дальше ответ остаётся в журнале заданий (`.data/llm-jobs`)."
      },
      {
        "id": "server/utils/llm-agents.ts",
        "title": "llm-agents",
        "layer": "серверные утилиты",
        "summary": "Агентные провайдеры помимо Claude Code: Codex CLI и Gemini CLI (ADR-0019). Принимают тот же запрос, что и `ask` из llm.ts, и отдают тот же `LlmResult`, поэтому реестр провайдеров держит их наравне. Ключей не храним:"
      },
      {
        "id": "server/utils/llm-anthropic.ts",
        "title": "llm-anthropic",
        "layer": "серверные утилиты",
        "summary": "Чат-провайдер Anthropic Messages API (T-0021). Системная часть помечена для кеширования: она повторяется между запросами, а платить за неё каждый раз незачем."
      },
      {
        "id": "server/utils/llm-claude.ts",
        "title": "llm-claude",
        "layer": "серверные утилиты",
        "summary": "Claude Code как первый адаптер (T-0019). Поведение прежнее: всё делает ask() из llm.ts, адаптер только приводит запрос и ответ к общему виду."
      },
      {
        "id": "server/utils/llm-gateway.ts",
        "title": "llm-gateway",
        "layer": "серверные утилиты",
        "summary": "Единый путь запроса к модели (ADR-0019): маршрут по виду запроса → очередь с пределом параллельности → провайдер → учёт."
      },
      {
        "id": "server/utils/llm-http.ts",
        "title": "llm-http",
        "layer": "серверные утилиты",
        "summary": "Общее для чат-провайдеров: статус HTTP и сбои сети — в общие коды отказов."
      },
      {
        "id": "server/utils/llm-jobs-store.ts",
        "title": "llm-jobs-store",
        "layer": "серверные утилиты",
        "summary": "Журнал заданий к модели: `.data/llm-jobs/<проект>.json` (ADR-0017, R-0010). Очередь живёт в памяти, а результат — здесь: переживает обновление страницы и перезапуск сервера."
      },
      {
        "id": "server/utils/llm-openai.ts",
        "title": "llm-openai",
        "layer": "серверные утилиты",
        "summary": "Чат-провайдер OpenAI-совместимого API: OpenAI, OpenRouter, RouterAI, Ollama, vLLM (T-0020). Ходит только по адресу из настроек; инструментов нет."
      },
      {
        "id": "server/utils/llm-providers.ts",
        "title": "llm-providers",
        "layer": "серверные утилиты",
        "summary": "Собирает реестр из настроек. Вызывается при каждой правке настроек, поэтому провайдер добавляется без перезапуска сервера (T-0022). Claude Code есть всегда."
      },
      {
        "id": "server/utils/llm-settings.ts",
        "title": "llm-settings",
        "layer": "серверные утилиты",
        "summary": "Настройки моделей в `.data/llm.json` (ADR-0019, п. 4; T-0022). Файл вне репозитория. Ключ лучше называть переменной окружения (`apiKeyEnv`); значение `apiKey` допустимо, но читается только сервером."
      },
      {
        "id": "server/utils/llm-usage-store.ts",
        "title": "llm-usage-store",
        "layer": "серверные утилиты",
        "summary": "Рядом с аудитом: данные приложения лежат в `.data` (server/middleware/audit.ts)."
      },
      {
        "id": "server/utils/llm.ts",
        "title": "llm",
        "layer": "серверные утилиты",
        "summary": "Доступ к модели через Claude Code на машине пользователя (docs/adr/0008-llm-through-claude-code.md). Ключей приложение не хранит и в сеть не ходит:"
      },
      {
        "id": "server/utils/map-service.ts",
        "title": "map-service",
        "layer": "серверные утилиты",
        "summary": "Общая картина проекта: подтверждённые карты, сложенные в порядке подтверждения (docs/07-maps.md). Производное — считается заново и нигде не хранится."
      },
      {
        "id": "server/utils/memo.ts",
        "title": "memo",
        "layer": "серверные утилиты",
        "summary": "Память процесса для тяжёлых производных ответов (T-0102, R-0041): карта, правила, справочник и дизайн каждый раз заново читали весь проект. Это кэш производного (ADR-0001):"
      },
      {
        "id": "server/utils/mode.ts",
        "title": "mode",
        "layer": "серверные утилиты",
        "summary": "Режим общего сервера (docs/adr/0018-shared-server.md, docs/15-team-platform.md, аудит). Включается `DOCDD_MODE=shared`; локальный режим не меняется."
      },
      {
        "id": "server/utils/notification-reader.ts",
        "title": "notification-reader",
        "layer": "серверные утилиты",
        "summary": "Кто читает колокольчик (R-0059): при включённом входе — вошедший (его логин), без входа — консоль одного человека, ему видны все уведомления. Не вошёл при включённом входе — `null`."
      },
      {
        "id": "server/utils/notification-service.ts",
        "title": "notification-service",
        "layer": "серверные утилиты",
        "summary": "Хранилище уведомлений: `.data/notifications/<проект>.json`. Это данные приложения, а не проекта, поэтому в репозиторий проекта они не попадают. Запись идёт по очереди: параллельные события иначе затирают друг друга."
      },
      {
        "id": "server/utils/notify-events.ts",
        "title": "notify-events",
        "layer": "серверные утилиты",
        "summary": "Места событий процесса → уведомления (R-0059). Адресат — логин из самой записи (`assignee`, `reviewer`); пустое поле — некого уведомлять. Сбой уведомления не должен отменять правку записи, поэтому ошибки глотаем."
      },
      {
        "id": "server/utils/onboarding-handlers.ts",
        "title": "onboarding-handlers",
        "layer": "серверные утилиты",
        "summary": "Обработчики автоматических шагов подключения (R-0075). Каждая задача подключения регистрирует свой: автопоиск источников, проверки из тестов, контракты и справки."
      },
      {
        "id": "server/utils/onboarding-service.ts",
        "title": "onboarding-service",
        "layer": "серверные утилиты",
        "summary": "Состояние подключения проекта (R-0075): всё считается из файлов проекта, своей базы нет. Проект с беды чтения даёт пустое состояние, а не падение — чек-лист нужен как раз тому, у кого ничего ещё нет."
      },
      {
        "id": "server/utils/onboarding-steps.ts",
        "title": "onboarding-steps",
        "layer": "серверные утилиты",
        "summary": "«Запустить подключение» (R-0075): автоматические шаги выполняются сразу, шаги с моделью и человеком — только называются со ссылкой на экран. Каждый шаг перезапускаемый:"
      },
      {
        "id": "server/utils/priority-service.ts",
        "title": "priority-service",
        "layer": "серверные утилиты",
        "summary": "Порядок по важности (docs/04-ui.md, «Порядок по важности»): данные для запроса и запись подтверждённого порядка в файлы фаз."
      },
      {
        "id": "server/utils/projects.ts",
        "title": "projects",
        "layer": "серверные утилиты",
        "summary": "Список проектов — единственные собственные данные приложения (docs/01-architecture.md)."
      },
      {
        "id": "server/utils/record-diff-service.ts",
        "title": "record-diff-service",
        "layer": "серверные утилиты",
        "summary": "«Что меняется» для записи на подтверждении. «Было» берётся из git, своей базы снимков нет; отметка просмотра — производный файл в `.docdd/`, его потеря только возвращает значок «разница не открывалась»."
      },
      {
        "id": "server/utils/record-write.ts",
        "title": "record-write",
        "layer": "серверные утилиты",
        "summary": "Общая часть действий процесса: прочитать запись, спросить правила, записать под сторожем. Файловая система живёт здесь, решения — в `server/lib`."
      },
      {
        "id": "server/utils/reference-service.ts",
        "title": "reference-service",
        "layer": "серверные утилиты",
        "summary": "Справочник проекта (docs/13-reference.md): справки и индекс. Индекс — производное от подтверждённых справок и карты кода; приложение собирает его и пишет в файл, руками он не правится."
      },
      {
        "id": "server/utils/rules-service.ts",
        "title": "rules-service",
        "layer": "серверные утилиты",
        "summary": "Правила проверки из практик (docs/12-practice-rules.md, ADR-0014). Общие практики читаются из источников `sources.shared` как из своих корней; здесь источник разбирается без `loadIndex`, чтобы цепочка источников не…"
      },
      {
        "id": "server/utils/semantic-service.ts",
        "title": "semantic-service",
        "layer": "серверные утилиты",
        "summary": "Индекс смыслового поиска (docs/adr/0031-semantic-search.md). Файл — `.docdd/embeddings.jsonl`, производный кэш. Актуальность держится сама:"
      },
      {
        "id": "server/utils/sessions.ts",
        "title": "sessions",
        "layer": "серверные утилиты",
        "summary": "Память о разговорах с моделью: у какой задачи какая сессия (docs/09-execution.md). Нужна затем, чтобы повторный заход продолжал прошлый разговор, а не проходил сотню шагов разбора заново."
      },
      {
        "id": "server/utils/shared-service.ts",
        "title": "shared-service",
        "layer": "серверные утилиты",
        "summary": "Чтение общих практик (docs/11-shared-sources.md). Каждый источник — свой, отдельно провалидированный корень:"
      },
      {
        "id": "server/utils/source-root.ts",
        "title": "source-root",
        "layer": "серверные утилиты",
        "summary": "Корень источника практик: путь `builtin` — каталог `practices/` в корне приложения (ADR-0015), остальное — свой отдельный корень, как раньше."
      },
      {
        "id": "server/utils/source-scan.ts",
        "title": "source-scan",
        "layer": "серверные утилиты",
        "summary": "Обход проекта для автопоиска источников (R-0077): неглубокий и ограниченный — проект на сотни тысяч файлов не должен вешать экран. Служебное (`.git`, `node_modules`, сборка) не заходит в обход вовсе."
      },
      {
        "id": "server/utils/sse.ts",
        "title": "sse",
        "layer": "серверные утилиты",
        "summary": "Лента событий для экрана (docs/03-server-api.md). Модель работает минутами, и ответ одним куском в конце оставляет человека наедине с кружком — поэтому события уходят по мере того, как случаются."
      },
      {
        "id": "server/utils/test-checks-service.ts",
        "title": "test-checks-service",
        "layer": "серверные утилиты",
        "summary": "Проверки из существующих тестов (R-0079): находка тестовых файлов, сопоставление с требованиями, заведение проверок-черновиков и подключение отчёта сборки раннера."
      },
      {
        "id": "server/utils/verified-service.ts",
        "title": "verified-service",
        "layer": "серверные утилиты",
        "summary": "Отметка «Проверено» на ручной проверке (docs/03-server-api.md, `records/:recordId/verified`). Факт — отчёт в `tests/reports`, след — строка в журнале записи. Отчёт первичен:"
      },
      {
        "id": "server/utils/work-service.ts",
        "title": "work-service",
        "layer": "серверные утилиты",
        "summary": "Выполнение задачи через клиент (docs/09-execution.md). Приложение заводит ветку, показывает дифф и сливает перемоткой — принимает человек."
      }
    ],
    "imports": [
      {
        "from": "server/api/audit.get.ts",
        "to": "server/middleware/audit.ts",
        "evidence": {
          "path": "server/api/audit.get.ts",
          "line": 5,
          "fragment": "import { AUDIT_FILE } from '../middleware/audit';"
        }
      },
      {
        "from": "server/api/audit.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/audit.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../utils/http';"
        }
      },
      {
        "from": "server/api/auth/login.post.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "server/api/auth/login.post.ts",
          "line": 3,
          "fragment": "import { signSession, verifyPassword } from '../../lib/auth'"
        }
      },
      {
        "from": "server/api/auth/login.post.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/api/auth/login.post.ts",
          "line": 4,
          "fragment": "import { SESSION_COOKIE, SESSION_TTL_MS, loadUsers, sessionS"
        }
      },
      {
        "from": "server/api/auth/login.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/auth/login.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/auth/logout.post.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/api/auth/logout.post.ts",
          "line": 3,
          "fragment": "import { SESSION_COOKIE } from '../../utils/auth';"
        }
      },
      {
        "from": "server/api/auth/me.get.ts",
        "to": "server/lib/permissions.ts",
        "evidence": {
          "path": "server/api/auth/me.get.ts",
          "line": 3,
          "fragment": "import { ALL_ACTIONS, can, type TeamMember, type Verdict } f"
        }
      },
      {
        "from": "server/api/auth/me.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/auth/me.get.ts",
          "line": 4,
          "fragment": "import { readManifest } from '../../lib/workspace';"
        }
      },
      {
        "from": "server/api/auth/me.get.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/api/auth/me.get.ts",
          "line": 5,
          "fragment": "import { authEnabled, currentUser } from '../../utils/auth';"
        }
      },
      {
        "from": "server/api/auth/me.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/auth/me.get.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../utils/projects';"
        }
      },
      {
        "from": "server/api/auth/users.get.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/api/auth/users.get.ts",
          "line": 3,
          "fragment": "import { loadUsers } from '../../utils/auth';"
        }
      },
      {
        "from": "server/api/auth/users.post.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "server/api/auth/users.post.ts",
          "line": 3,
          "fragment": "import { hashPassword } from '../../lib/auth';"
        }
      },
      {
        "from": "server/api/auth/users.post.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/api/auth/users.post.ts",
          "line": 4,
          "fragment": "import { loadUsers, saveUsers } from '../../utils/auth';"
        }
      },
      {
        "from": "server/api/auth/users.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/auth/users.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/design.get.ts",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "server/api/design.get.ts",
          "line": 3,
          "fragment": "import { standardDesign, projectDesign } from '../utils/desi"
        }
      },
      {
        "from": "server/api/design.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/design.get.ts",
          "line": 4,
          "fragment": "import { loadIndex } from '../utils/index-service';"
        }
      },
      {
        "from": "server/api/design.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/design.get.ts",
          "line": 5,
          "fragment": "import { listProjects } from '../utils/projects';"
        }
      },
      {
        "from": "server/api/llm/ask.post.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/llm/ask.post.ts",
          "line": 8,
          "fragment": "import { sharedDenied } from '../../utils/mode';"
        }
      },
      {
        "from": "server/api/llm/embeddings.get.ts",
        "to": "server/lib/semantic.ts",
        "evidence": {
          "path": "server/api/llm/embeddings.get.ts",
          "line": 3,
          "fragment": "import { LOCAL_MODEL } from '../../lib/semantic';"
        }
      },
      {
        "from": "server/api/llm/embeddings.get.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/api/llm/embeddings.get.ts",
          "line": 4,
          "fragment": "import { loadLlmSettings } from '../../utils/llm-settings';"
        }
      },
      {
        "from": "server/api/llm/embeddings.put.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/llm/embeddings.put.ts",
          "line": 3,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/llm/embeddings.put.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/api/llm/embeddings.put.ts",
          "line": 4,
          "fragment": "import { loadLlmSettings, saveLlmSettings } from '../../util"
        }
      },
      {
        "from": "server/api/llm/models/check.post.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/api/llm/models/check.post.ts",
          "line": 3,
          "fragment": "import { getProvider } from '../../../lib/llm-provider';"
        }
      },
      {
        "from": "server/api/llm/models/check.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/llm/models/check.post.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/llm/models/check.post.ts",
        "to": "server/utils/llm-providers.ts",
        "evidence": {
          "path": "server/api/llm/models/check.post.ts",
          "line": 5,
          "fragment": "import { syncProviders } from '../../../utils/llm-providers'"
        }
      },
      {
        "from": "server/api/llm/models/index.get.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/api/llm/models/index.get.ts",
          "line": 3,
          "fragment": "import { listProviders } from '../../../lib/llm-provider';"
        }
      },
      {
        "from": "server/api/llm/models/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/llm/models/index.get.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/llm/models/index.get.ts",
        "to": "server/utils/llm-providers.ts",
        "evidence": {
          "path": "server/api/llm/models/index.get.ts",
          "line": 5,
          "fragment": "import { syncProviders } from '../../../utils/llm-providers'"
        }
      },
      {
        "from": "server/api/llm/models/index.get.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/api/llm/models/index.get.ts",
          "line": 6,
          "fragment": "import { loadLlmSettings, toPublic } from '../../../utils/ll"
        }
      },
      {
        "from": "server/api/llm/models/index.put.ts",
        "to": "server/lib/llm-routing.ts",
        "evidence": {
          "path": "server/api/llm/models/index.put.ts",
          "line": 3,
          "fragment": "import { parseRoutingTable } from '../../../lib/llm-routing'"
        }
      },
      {
        "from": "server/api/llm/models/index.put.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/api/llm/models/index.put.ts",
          "line": 4,
          "fragment": "import { duplicateId } from '../../../lib/llm-provider';"
        }
      },
      {
        "from": "server/api/llm/models/index.put.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/llm/models/index.put.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/llm/models/index.put.ts",
        "to": "server/utils/llm-providers.ts",
        "evidence": {
          "path": "server/api/llm/models/index.put.ts",
          "line": 6,
          "fragment": "import { syncProviders } from '../../../utils/llm-providers'"
        }
      },
      {
        "from": "server/api/llm/models/index.put.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/api/llm/models/index.put.ts",
          "line": 7,
          "fragment": "import { loadLlmSettings, saveLlmSettings, type ProviderSett"
        }
      },
      {
        "from": "server/api/llm/usage.get.ts",
        "to": "server/lib/llm-usage.ts",
        "evidence": {
          "path": "server/api/llm/usage.get.ts",
          "line": 3,
          "fragment": "import { summarize } from '../../lib/llm-usage';"
        }
      },
      {
        "from": "server/api/llm/usage.get.ts",
        "to": "server/lib/permissions.ts",
        "evidence": {
          "path": "server/api/llm/usage.get.ts",
          "line": 4,
          "fragment": "import { can, type TeamMember } from '../../lib/permissions'"
        }
      },
      {
        "from": "server/api/llm/usage.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/llm/usage.get.ts",
          "line": 5,
          "fragment": "import { readManifest } from '../../lib/workspace';"
        }
      },
      {
        "from": "server/api/llm/usage.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/llm/usage.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/llm/usage.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/llm/usage.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../utils/projects';"
        }
      },
      {
        "from": "server/api/llm/usage.get.ts",
        "to": "server/utils/llm-usage-store.ts",
        "evidence": {
          "path": "server/api/llm/usage.get.ts",
          "line": 8,
          "fragment": "import { readUsage } from '../../utils/llm-usage-store';"
        }
      },
      {
        "from": "server/api/notifications/channel.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/notifications/channel.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/notifications/channel.get.ts",
        "to": "server/utils/notification-service.ts",
        "evidence": {
          "path": "server/api/notifications/channel.get.ts",
          "line": 4,
          "fragment": "import { loadChannelUrl } from '../../utils/notification-ser"
        }
      },
      {
        "from": "server/api/notifications/channel.put.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/notifications/channel.put.ts",
          "line": 3,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/notifications/channel.put.ts",
        "to": "server/utils/notification-service.ts",
        "evidence": {
          "path": "server/api/notifications/channel.put.ts",
          "line": 4,
          "fragment": "import { saveChannelUrl } from '../../utils/notification-ser"
        }
      },
      {
        "from": "server/api/portfolio.get.ts",
        "to": "server/lib/portfolio.ts",
        "evidence": {
          "path": "server/api/portfolio.get.ts",
          "line": 3,
          "fragment": "import { failedRow, portfolioRow } from '../lib/portfolio';"
        }
      },
      {
        "from": "server/api/portfolio.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/portfolio.get.ts",
          "line": 4,
          "fragment": "import { loadIndex } from '../utils/index-service';"
        }
      },
      {
        "from": "server/api/portfolio.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/portfolio.get.ts",
          "line": 5,
          "fragment": "import { listProjects } from '../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/[agentId].delete.ts",
        "to": "server/utils/agents-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/[agentId].delete.ts",
          "line": 3,
          "fragment": "import { deleteAgent } from '../../../../utils/agents-servic"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/[agentId].delete.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/[agentId].delete.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/[agentId].delete.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/[agentId].delete.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/defaults.post.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/defaults.post.ts",
          "line": 3,
          "fragment": "import { AGENT_TYPES, agentFromType } from '../../../../lib/"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/defaults.post.ts",
        "to": "server/utils/agents-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/defaults.post.ts",
          "line": 4,
          "fragment": "import { listAgents, saveAgent } from '../../../../utils/age"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/defaults.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/defaults.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/defaults.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/defaults.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.get.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.get.ts",
          "line": 3,
          "fragment": "import { AGENT_ACCESS, AGENT_TYPES } from '../../../../lib/a"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.get.ts",
        "to": "server/utils/agents-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.get.ts",
          "line": 4,
          "fragment": "import { listAgents } from '../../../../utils/agents-service"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.get.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.get.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.post.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.post.ts",
          "line": 3,
          "fragment": "import { agentText, parseAgent } from '../../../../lib/agent"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.post.ts",
        "to": "server/utils/agents-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.post.ts",
          "line": 4,
          "fragment": "import { saveAgent } from '../../../../utils/agents-service'"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/agents/index.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/agents/index.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/lib/analyst.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 6,
          "fragment": "import { analystPrompt, isAnalystMode, type AnalystRecord } "
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 7,
          "fragment": "import { parseGlossary } from '../../../lib/glossary';"
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/lib/parse.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 8,
          "fragment": "import { parseRecord } from '../../../lib/parse';"
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 9,
          "fragment": "import { resolveInside } from '../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 10,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 11,
          "fragment": "import { loadIndex } from '../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/analyst.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/analyst.post.ts",
          "line": 12,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../li"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.get.ts",
        "to": "server/utils/architecture-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.get.ts",
          "line": 5,
          "fragment": "import { buildArchitecture } from '../../../utils/architectu"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.get.ts",
          "line": 6,
          "fragment": "import { fingerprintProject, memoByFingerprint } from '../.."
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.get.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.get.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.post.ts",
        "to": "server/lib/architecture.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.post.ts",
          "line": 3,
          "fragment": "import { parseArchitectureAudit } from '../../../lib/archite"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../li"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError, readWorkspace } from '../../../lib/"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/architecture.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/architecture.post.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/attachment.get.ts",
        "to": "server/lib/attachments.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachment.get.ts",
          "line": 5,
          "fragment": "import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, extOf, isAt"
        }
      },
      {
        "from": "server/api/projects/[id]/attachment.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachment.get.ts",
          "line": 6,
          "fragment": "import { OutsideRootError, resolveInside } from '../../../li"
        }
      },
      {
        "from": "server/api/projects/[id]/attachment.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachment.get.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/attachment.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachment.get.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/attachments.post.ts",
        "to": "server/lib/attachments.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachments.post.ts",
          "line": 6,
          "fragment": "import { attachmentFolder, checkAttachment } from '../../../"
        }
      },
      {
        "from": "server/api/projects/[id]/attachments.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachments.post.ts",
          "line": 7,
          "fragment": "import { OutsideRootError, normalizeRoot, resolveInside } fr"
        }
      },
      {
        "from": "server/api/projects/[id]/attachments.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachments.post.ts",
          "line": 8,
          "fragment": "import { WorkspaceError, readWorkspace } from '../../../lib/"
        }
      },
      {
        "from": "server/api/projects/[id]/attachments.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachments.post.ts",
          "line": 9,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/attachments.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachments.post.ts",
          "line": 10,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/attachments.post.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/attachments.post.ts",
          "line": 11,
          "fragment": "import { today } from '../../../utils/record-write';"
        }
      },
      {
        "from": "server/api/projects/[id]/backlinks/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/backlinks/index.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/backlinks/index.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/backlinks/index.get.ts",
          "line": 4,
          "fragment": "import { loadIndex } from '../../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/backlinks/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/backlinks/index.get.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 3,
          "fragment": "import { analyze } from '../../../../lib/analyze';"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/lib/batch-check.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 4,
          "fragment": "import { batchGaps } from '../../../../lib/batch-check';"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 5,
          "fragment": "import { normalizeRoot } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 6,
          "fragment": "import { WorkspaceError, readWorkspace } from '../../../../l"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 8,
          "fragment": "import { buildProjectMap } from '../../../../utils/map-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/batch-check/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/batch-check/index.get.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/context/index.post.ts",
        "to": "server/lib/context-pack.ts",
        "evidence": {
          "path": "server/api/projects/[id]/context/index.post.ts",
          "line": 3,
          "fragment": "import { renderContextPack } from '../../../../lib/context-p"
        }
      },
      {
        "from": "server/api/projects/[id]/context/index.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/context/index.post.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/context/index.post.ts",
        "to": "server/utils/context-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/context/index.post.ts",
          "line": 5,
          "fragment": "import { packFor } from '../../../../utils/context-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/context/index.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/context/index.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/catalog.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/catalog.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/catalog.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/catalog.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/catalog.get.ts",
        "to": "server/utils/design-catalog-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/catalog.get.ts",
          "line": 5,
          "fragment": "import { projectCatalog } from '../../../../utils/design-cat"
        }
      },
      {
        "from": "server/api/projects/[id]/design/catalog.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/catalog.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/catalog.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/catalog.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/export.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/export.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/export.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/export.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/export.get.ts",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/export.get.ts",
          "line": 5,
          "fragment": "import { projectExports } from '../../../../utils/design-ser"
        }
      },
      {
        "from": "server/api/projects/[id]/design/export.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/export.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/export.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/export.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 3,
          "fragment": "import { dropCache } from '../../../../../lib/cache';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 4,
          "fragment": "import { parseFindings, type ScreenFinding, type ScreenPass "
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 5,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 6,
          "fragment": "import { WorkspaceError } from '../../../../../lib/workspace"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 7,
          "fragment": "import { projectScreens, writeDesignReport } from '../../../"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 8,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/apply.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/apply.post.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/preview.post.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/preview.post.ts",
          "line": 3,
          "fragment": "import { parseFindings } from '../../../../../lib/design-scr"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/preview.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/preview.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/preview.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/preview.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../../lib/workspace"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/preview.post.ts",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/preview.post.ts",
          "line": 6,
          "fragment": "import { projectScreens } from '../../../../../utils/design-"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/preview.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/preview.post.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/findings/preview.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/findings/preview.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/index.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/index.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/index.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/index.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/index.get.ts",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/index.get.ts",
          "line": 5,
          "fragment": "import { projectDesign } from '../../../../utils/design-serv"
        }
      },
      {
        "from": "server/api/projects/[id]/design/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/index.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/index.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/index.get.ts",
          "line": 7,
          "fragment": "import { fingerprintWithSources, memoByFingerprint } from '."
        }
      },
      {
        "from": "server/api/projects/[id]/design/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/index.get.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/port-prompt.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/port-prompt.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/port-prompt.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/port-prompt.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/port-prompt.post.ts",
        "to": "server/utils/design-catalog-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/port-prompt.post.ts",
          "line": 6,
          "fragment": "import { PortError, projectPortPrompt } from '../../../../ut"
        }
      },
      {
        "from": "server/api/projects/[id]/design/port-prompt.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/port-prompt.post.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/port-prompt.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/port-prompt.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/record-diff.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/record-diff.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/record-diff.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/record-diff.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/record-diff.get.ts",
        "to": "server/utils/design-diff-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/record-diff.get.ts",
          "line": 5,
          "fragment": "import { designDiffForRecord } from '../../../../utils/desig"
        }
      },
      {
        "from": "server/api/projects/[id]/design/record-diff.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/record-diff.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/record-diff.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/record-diff.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/screens.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/screens.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/screens.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/screens.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/screens.get.ts",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/screens.get.ts",
          "line": 5,
          "fragment": "import { projectScreens } from '../../../../utils/design-scr"
        }
      },
      {
        "from": "server/api/projects/[id]/design/screens.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/screens.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/design/screens.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/design/screens.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/diff-unviewed.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/diff-unviewed.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/diff-unviewed.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/diff-unviewed.get.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/diff-unviewed.get.ts",
        "to": "server/utils/record-diff-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/diff-unviewed.get.ts",
          "line": 5,
          "fragment": "import { unviewedReview } from '../../../utils/record-diff-s"
        }
      },
      {
        "from": "server/api/projects/[id]/glossary.get.ts",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "server/api/projects/[id]/glossary.get.ts",
          "line": 6,
          "fragment": "import { parseGlossary } from '../../../lib/glossary';"
        }
      },
      {
        "from": "server/api/projects/[id]/glossary.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/glossary.get.ts",
          "line": 7,
          "fragment": "import { resolveInside } from '../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/glossary.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/glossary.get.ts",
          "line": 8,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/glossary.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/glossary.get.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/accept.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/accept.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/accept.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/accept.post.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/accept.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/accept.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/accept.post.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/accept.post.ts",
          "line": 6,
          "fragment": "import { acceptNotes } from '../../../../utils/inbox-service"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/accept.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/accept.post.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/alert.post.ts",
        "to": "server/lib/metrics.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/alert.post.ts",
          "line": 5,
          "fragment": "import { alertNote } from '../../../../lib/metrics';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/alert.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/alert.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/alert.post.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/alert.post.ts",
          "line": 7,
          "fragment": "import { createNote } from '../../../../utils/inbox-service'"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/alert.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/alert.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/external.post.ts",
        "to": "server/lib/external-import.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/external.post.ts",
          "line": 3,
          "fragment": "import { confluenceNotes, jiraNotes, parseJira, type Conflue"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/external.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/external.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/external.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/external.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/external.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/external.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/external.post.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/external.post.ts",
          "line": 7,
          "fragment": "import { createNote } from '../../../../utils/inbox-service'"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/external.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/external.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/index.get.ts",
        "to": "server/lib/batch-check.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/index.get.ts",
          "line": 4,
          "fragment": "import { noteMeta } from '../../../../lib/batch-check';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/preview.post.ts",
        "to": "server/lib/prompt.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/preview.post.ts",
          "line": 4,
          "fragment": "import { evidenceProblems } from '../../../../lib/prompt';"
        }
      },
      {
        "from": "server/api/projects/[id]/inbox/preview.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/inbox/preview.post.ts",
          "line": 5,
          "fragment": "import { sourceReader } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/index/index.get.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/api/projects/[id]/index/index.get.ts",
          "line": 4,
          "fragment": "import type { IndexRecord } from '../../../../lib/types';"
        }
      },
      {
        "from": "server/api/projects/[id]/issues.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/issues.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/issues.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/issues.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/issues.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/issues.get.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/issues.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/issues.get.ts",
          "line": 6,
          "fragment": "import { loadIndex } from '../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/issues.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/issues.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/knowledge.get.ts",
        "to": "server/lib/knowledge.ts",
        "evidence": {
          "path": "server/api/projects/[id]/knowledge.get.ts",
          "line": 3,
          "fragment": "import { knowledgeTree } from '../../../lib/knowledge';"
        }
      },
      {
        "from": "server/api/projects/[id]/knowledge.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/knowledge.get.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/knowledge.get.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/knowledge.get.ts",
          "line": 5,
          "fragment": "import { inboxNotes } from '../../../utils/inbox-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/knowledge.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/knowledge.get.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
        "to": "server/lib/job-feed.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
          "line": 3,
          "fragment": "import { canSee } from '../../../../../lib/job-feed';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
          "line": 5,
          "fragment": "import { getFeed, whoIs } from '../../../../../utils/job-fee"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
        "to": "server/lib/job-feed.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
          "line": 3,
          "fragment": "import { canSee } from '../../../../../lib/job-feed';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
          "line": 5,
          "fragment": "import { getFeed, whoIs } from '../../../../../utils/job-fee"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
        "to": "server/utils/sse.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
          "line": 6,
          "fragment": "import { eventStream } from '../../../../../utils/sse';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/[jobId].delete.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/[jobId].delete.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/[jobId].delete.ts",
        "to": "server/utils/llm-gateway.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/[jobId].delete.ts",
          "line": 4,
          "fragment": "import { llmQueue } from '../../../../../utils/llm-gateway';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
        "to": "server/utils/llm-gateway.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
          "line": 4,
          "fragment": "import { llmQueue } from '../../../../../utils/llm-gateway';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
        "to": "server/utils/llm-jobs-store.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/[jobId].get.ts",
          "line": 5,
          "fragment": "import { loadJobs } from '../../../../../utils/llm-jobs-stor"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/index.get.ts",
        "to": "server/utils/llm-gateway.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/index.get.ts",
          "line": 3,
          "fragment": "import { llmQueue } from '../../../../../utils/llm-gateway';"
        }
      },
      {
        "from": "server/api/projects/[id]/llm/queue/index.get.ts",
        "to": "server/utils/llm-jobs-store.ts",
        "evidence": {
          "path": "server/api/projects/[id]/llm/queue/index.get.ts",
          "line": 4,
          "fragment": "import { loadJobs } from '../../../../../utils/llm-jobs-stor"
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 3,
          "fragment": "import { analyze } from '../../../../lib/analyze';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/lib/coverage.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 4,
          "fragment": "import { behindProposals } from '../../../../lib/coverage';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 5,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 6,
          "fragment": "import { WorkspaceError, readWorkspace } from '../../../../l"
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 8,
          "fragment": "import { fingerprintProject, memoByFingerprint } from '../.."
        }
      },
      {
        "from": "server/api/projects/[id]/map/behind.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/behind.get.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 16,
          "fragment": "} from '../../../../lib/functional';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 25,
          "fragment": "import { buildProjectMap } from '../../../../utils/map-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 1,
          "fragment": "import { fingerprintProject, memoByFingerprint } from '../.."
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 4,
          "fragment": "import { analyze } from '../../../../lib/analyze';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/lib/coverage.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 5,
          "fragment": "import { capabilityCoverage } from '../../../../lib/coverage"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 6,
          "fragment": "import { groupModules } from '../../../../lib/groups';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 7,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 8,
          "fragment": "import { WorkspaceError, readWorkspace } from '../../../../l"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 9,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 10,
          "fragment": "import { buildProjectMap } from '../../../../utils/map-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/map/coverage.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/coverage.get.ts",
          "line": 11,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-check.post.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-check.post.ts",
          "line": 3,
          "fragment": "import { parseFunctionalCheck } from '../../../../lib/functi"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-check.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-check.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-check.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-check.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-check.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-check.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-check.post.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-check.post.ts",
          "line": 7,
          "fragment": "import { buildProjectMap } from '../../../../utils/map-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-check.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-check.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-relations.post.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-relations.post.ts",
          "line": 3,
          "fragment": "import { parseFunctionalRelations } from '../../../../lib/fu"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-relations.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-relations.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-relations.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-relations.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-relations.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-relations.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-relations.post.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-relations.post.ts",
          "line": 7,
          "fragment": "import { buildProjectMap } from '../../../../utils/map-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/map/functional-relations.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/functional-relations.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/index.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/index.get.ts",
          "line": 8,
          "fragment": "import { fingerprintProject, memoByFingerprint } from '../.."
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 7,
          "fragment": "import { dropCache } from '../../../../../../lib/cache';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 8,
          "fragment": "import { canDeleteMap } from '../../../../../../lib/custom-m"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/lib/manifest-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 9,
          "fragment": "import { removeCustomMap } from '../../../../../../lib/manif"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 10,
          "fragment": "import { OutsideRootError, normalizeRoot, resolveInside } fr"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 11,
          "fragment": "import { DEVELOPMENT_DIR, MANIFEST_FILE, WorkspaceError, rea"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 12,
          "fragment": "import { fail } from '../../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 13,
          "fragment": "import { whoIs } from '../../../../../../utils/job-feeds';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "line": 14,
          "fragment": "import { findProject } from '../../../../../../utils/project"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 6,
          "fragment": "import { analyze } from '../../../../../../lib/analyze';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 7,
          "fragment": "import { dropCache } from '../../../../../../lib/cache';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 8,
          "fragment": "import { customDefinitions, customDraftText } from '../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 9,
          "fragment": "import { isImplStatus } from '../../../../../../lib/function"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/import.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 10,
          "fragment": "import { targetPath } from '../../../../../../lib/import';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 11,
          "fragment": "import type { CustomChange, CustomNode, CustomRelation } fro"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 12,
          "fragment": "import { OutsideRootError, normalizeRoot, resolveInside } fr"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/scaffold.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 13,
          "fragment": "import { nextId } from '../../../../../../lib/scaffold';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/schema.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 14,
          "fragment": "import { validateCustom } from '../../../../../../lib/schema"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 15,
          "fragment": "import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } fr"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 16,
          "fragment": "import { fail, failWith } from '../../../../../../utils/http"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 17,
          "fragment": "import { loadIndex } from '../../../../../../utils/index-ser"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 18,
          "fragment": "import { buildProjectMap } from '../../../../../../utils/map"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 19,
          "fragment": "import { findProject } from '../../../../../../utils/project"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "line": 20,
          "fragment": "import { today } from '../../../../../../utils/record-write'"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 3,
          "fragment": "import { customDefinitions, customMapView, engineMaps, type "
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 4,
          "fragment": "import { OutsideRootError, normalizeRoot } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 5,
          "fragment": "import { WorkspaceError, readWorkspace } from '../../../../."
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 7,
          "fragment": "import { buildProjectMap } from '../../../../../utils/map-se"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 8,
          "fragment": "import { fingerprintProject, memoByFingerprint } from '../.."
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.get.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 7,
          "fragment": "import { dropCache } from '../../../../../lib/cache';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 8,
          "fragment": "import { ENGINE_TEMPLATES, customDefinitions, declaredEngine"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/lib/manifest-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 9,
          "fragment": "import { appendCustomMap } from '../../../../../lib/manifest"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 10,
          "fragment": "import { OutsideRootError, normalizeRoot, resolveInside } fr"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 11,
          "fragment": "import { DEVELOPMENT_DIR, MANIFEST_FILE, WorkspaceError, rea"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 12,
          "fragment": "import { fail, failWith } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 13,
          "fragment": "import { whoIs } from '../../../../../utils/job-feeds';"
        }
      },
      {
        "from": "server/api/projects/[id]/maps/custom/index.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/maps/custom/index.post.ts",
          "line": 14,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/metrics.get.ts",
        "to": "server/lib/metrics.ts",
        "evidence": {
          "path": "server/api/projects/[id]/metrics.get.ts",
          "line": 3,
          "fragment": "import { llmMetrics, prometheusMetrics } from '../../../lib/"
        }
      },
      {
        "from": "server/api/projects/[id]/metrics.get.ts",
        "to": "server/lib/llm-usage.ts",
        "evidence": {
          "path": "server/api/projects/[id]/metrics.get.ts",
          "line": 4,
          "fragment": "import { summarize } from '../../../lib/llm-usage';"
        }
      },
      {
        "from": "server/api/projects/[id]/metrics.get.ts",
        "to": "server/utils/llm-usage-store.ts",
        "evidence": {
          "path": "server/api/projects/[id]/metrics.get.ts",
          "line": 5,
          "fragment": "import { readUsage } from '../../../utils/llm-usage-store';"
        }
      },
      {
        "from": "server/api/projects/[id]/metrics.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/metrics.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/metrics.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/metrics.get.ts",
          "line": 7,
          "fragment": "import { loadIndex } from '../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/metrics.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/metrics.get.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/index.get.ts",
        "to": "server/lib/notifications.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/index.get.ts",
          "line": 3,
          "fragment": "import { visibleTo } from '../../../../lib/notifications';"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/index.get.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/index.get.ts",
        "to": "server/utils/notification-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/index.get.ts",
          "line": 5,
          "fragment": "import { listNotifications } from '../../../../utils/notific"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/index.get.ts",
        "to": "server/utils/notification-reader.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/index.get.ts",
          "line": 6,
          "fragment": "import { notificationReader } from '../../../../utils/notifi"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/index.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/read.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/read.post.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/read.post.ts",
        "to": "server/utils/notification-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/read.post.ts",
          "line": 4,
          "fragment": "import { readNotifications } from '../../../../utils/notific"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/read.post.ts",
        "to": "server/utils/notification-reader.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/read.post.ts",
          "line": 5,
          "fragment": "import { notificationReader } from '../../../../utils/notifi"
        }
      },
      {
        "from": "server/api/projects/[id]/notifications/read.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/notifications/read.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/observability.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/observability.get.ts",
          "line": 3,
          "fragment": "import { readManifest } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/observability.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/observability.get.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/observability.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/observability.get.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/index.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/index.get.ts",
        "to": "server/utils/onboarding-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/index.get.ts",
          "line": 4,
          "fragment": "import { onboardingReport } from '../../../../utils/onboardi"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/index.get.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/run.post.ts",
        "to": "server/lib/onboarding.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/run.post.ts",
          "line": 3,
          "fragment": "import type { StepId } from '../../../../lib/onboarding';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/run.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/run.post.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/run.post.ts",
        "to": "server/utils/onboarding-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/run.post.ts",
          "line": 5,
          "fragment": "import { onboardingReport } from '../../../../utils/onboardi"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/run.post.ts",
        "to": "server/utils/onboarding-handlers.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/run.post.ts",
          "line": 6,
          "fragment": "import '../../../../utils/onboarding-handlers';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/run.post.ts",
        "to": "server/utils/onboarding-steps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/run.post.ts",
          "line": 7,
          "fragment": "import { runOnboarding } from '../../../../utils/onboarding-"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/run.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/run.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.get.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.get.ts",
        "to": "server/utils/test-checks-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.get.ts",
          "line": 5,
          "fragment": "import { scanTests } from '../../../../utils/test-checks-ser"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.post.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.post.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/tests.post.ts",
        "to": "server/utils/test-checks-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/tests.post.ts",
          "line": 6,
          "fragment": "import { connectReport, createTestChecks } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/wizard.post.ts",
          "line": 6,
          "fragment": "import { parseGlossary } from '../../../../lib/glossary';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "to": "server/lib/new-project.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/wizard.post.ts",
          "line": 7,
          "fragment": "import { glossaryText, parseFeatures, parseTerms, wizardPlan"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/wizard.post.ts",
          "line": 8,
          "fragment": "import { OutsideRootError, resolveInside } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/wizard.post.ts",
          "line": 9,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/wizard.post.ts",
          "line": 10,
          "fragment": "import { createRecords } from '../../../../utils/inbox-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/onboarding/wizard.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/onboarding/wizard.post.ts",
          "line": 11,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/lib/phase-plan.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 3,
          "fragment": "import { asProposals, planPhases, type PlannedPhase } from '"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 4,
          "fragment": "import { normalizeRoot, OutsideRootError } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 7,
          "fragment": "import { createRecords } from '../../../../utils/inbox-servi"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 8,
          "fragment": "import { loadIndex } from '../../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/index.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/index.post.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/preview.post.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/preview.post.ts",
          "line": 3,
          "fragment": "import { parseProposal } from '../../../../lib/inbox';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/preview.post.ts",
        "to": "server/lib/phase-plan.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/preview.post.ts",
          "line": 4,
          "fragment": "import { planPhases } from '../../../../lib/phase-plan';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/preview.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/preview.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/preview.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/preview.post.ts",
          "line": 6,
          "fragment": "import { loadIndex } from '../../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/phases/preview.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/phases/preview.post.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/lib/work-order.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 4,
          "fragment": "import type { PriorityPlan } from '../../../../lib/work-orde"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/utils/priority-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 8,
          "fragment": "import { applyPriority } from '../../../../utils/priority-se"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/apply.post.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/apply.post.ts",
          "line": 54,
          "fragment": "import { staleVersions } from '../../../../utils/record-writ"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/lib/work-order.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 4,
          "fragment": "import { parsePriority } from '../../../../lib/work-order';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 7,
          "fragment": "import { loadIndex } from '../../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/utils/priority-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 8,
          "fragment": "import { priorityInput } from '../../../../utils/priority-se"
        }
      },
      {
        "from": "server/api/projects/[id]/priority/preview.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/priority/preview.post.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/progress-question.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/progress-question.post.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/progress-question.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/progress-question.post.ts",
          "line": 4,
          "fragment": "import { loadIndex } from '../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/progress-question.post.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/api/projects/[id]/progress-question.post.ts",
          "line": 5,
          "fragment": "import { ask } from '../../../utils/llm';"
        }
      },
      {
        "from": "server/api/projects/[id]/progress-question.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/progress-question.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/progress-question.post.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/progress-question.post.ts",
          "line": 7,
          "fragment": "import { feedStream } from '../../../utils/job-feeds';"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 19,
          "fragment": "import { withBuiltin } from '../../../../lib/builtin';"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/utils/priority-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 20,
          "fragment": "import { priorityInput } from '../../../../utils/priority-se"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 22,
          "fragment": "import { referenceIndexText } from '../../../../utils/refere"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/utils/architecture-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 23,
          "fragment": "import { buildArchitecture } from '../../../../utils/archite"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 24,
          "fragment": "import { resolveProjectRules } from '../../../../utils/rules"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/lib/phase-plan.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 28,
          "fragment": "import { phaseCandidates } from '../../../../lib/phase-plan'"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 38,
          "fragment": "import { plainTokens } from '../../../../lib/design';"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 40,
          "fragment": "import { projectDesign } from '../../../../utils/design-serv"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 41,
          "fragment": "import { projectScreens } from '../../../../utils/design-scr"
        }
      },
      {
        "from": "server/api/projects/[id]/prompt/index.post.ts",
        "to": "server/lib/reviewer.ts",
        "evidence": {
          "path": "server/api/projects/[id]/prompt/index.post.ts",
          "line": 42,
          "fragment": "import { reviewerOf, roleName } from '../../../../lib/review"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId].patch.ts",
        "to": "server/lib/version.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId].patch.ts",
          "line": 116,
          "fragment": "import { versionConflict } from '../../../../lib/version';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId].patch.ts",
        "to": "server/utils/notify-events.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId].patch.ts",
          "line": 117,
          "fragment": "import { notifyPatched } from '../../../../utils/notify-even"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/lib/context-pack.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 7,
          "fragment": "import { renderContextPack } from '../../../../../lib/contex"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 8,
          "fragment": "import { resolveInside, toProjectPath } from '../../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 9,
          "fragment": "import { readWorkspace } from '../../../../../lib/workspace'"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/utils/context-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 10,
          "fragment": "import { packFor, roleNeeds } from '../../../../../utils/con"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 11,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 12,
          "fragment": "import { feedStream } from '../../../../../utils/job-feeds';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 13,
          "fragment": "import { ask } from '../../../../../utils/llm';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 14,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "line": 15,
          "fragment": "import { sharedDenied } from '../../../../../utils/mode';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../../../lib/path"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
          "line": 4,
          "fragment": "import { fail } from '../../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../../../../utils/project"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
        "to": "server/utils/record-diff-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
          "line": 6,
          "fragment": "import { recordDiff } from '../../../../../../utils/record-d"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
          "line": 4,
          "fragment": "import { loadIndex } from '../../../../../../utils/index-ser"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
          "line": 5,
          "fragment": "import { findProject } from '../../../../../../utils/project"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
        "to": "server/utils/record-diff-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
          "line": 6,
          "fragment": "import { markViewed } from '../../../../../../utils/record-d"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
        "to": "server/lib/discussion.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
          "line": 5,
          "fragment": "import { discussionPath, emptyDiscussion, parseDiscussion } "
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
          "line": 6,
          "fragment": "import { OutsideRootError, resolveInside } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
          "line": 8,
          "fragment": "import { loadIndex } from '../../../../../utils/index-servic"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
          "line": 9,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
        "to": "server/lib/discussion.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
          "line": 14,
          "fragment": "} from '../../../../../lib/discussion';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
          "line": 15,
          "fragment": "import { OutsideRootError, resolveInside } from '../../../.."
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
          "line": 16,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
          "line": 17,
          "fragment": "import { loadIndex } from '../../../../../utils/index-servic"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
          "line": 18,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "line": 3,
          "fragment": "import { analyze } from '../../../../../lib/analyze';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "to": "server/lib/map-diff.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "line": 4,
          "fragment": "import { mapDiffForRecord } from '../../../../../lib/map-dif"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "line": 5,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "line": 6,
          "fragment": "import { readWorkspace, WorkspaceError } from '../../../../."
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
        "to": "server/utils/verified-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
          "line": 5,
          "fragment": "import { runMetricCheck } from '../../../../../utils/verifie"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/status.post.ts",
        "to": "server/utils/record-diff-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/status.post.ts",
          "line": 10,
          "fragment": "import { wasViewed } from '../../../../../utils/record-diff-"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/status.post.ts",
        "to": "server/lib/version.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/status.post.ts",
          "line": 89,
          "fragment": "import { versionConflict } from '../../../../../lib/version'"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/status.post.ts",
        "to": "server/utils/notify-events.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/status.post.ts",
          "line": 90,
          "fragment": "import { notifyStatus } from '../../../../../utils/notify-ev"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "to": "server/lib/manager.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "line": 3,
          "fragment": "import { applyTarget } from '../../../../../lib/manager';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "line": 4,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../../lib/workspace"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "line": 6,
          "fragment": "import { fail, failWith } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/target.post.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "line": 8,
          "fragment": "import { openRecord, saveRecord } from '../../../../../utils"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../../lib/workspace"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
        "to": "server/utils/verified-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/verified.post.ts",
          "line": 7,
          "fragment": "import { markVerified } from '../../../../../utils/verified-"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/work/index.get.ts",
        "to": "server/utils/agent-run-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/work/index.get.ts",
          "line": 7,
          "fragment": "import { chooseAgent } from '../../../../../../utils/agent-r"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
        "to": "server/utils/agent-run-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
          "line": 6,
          "fragment": "import { prepareAgent, type PreparedAgent } from '../../../."
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
        "to": "server/utils/job-feeds.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
          "line": 8,
          "fragment": "import { feedStream } from '../../../../../../utils/job-feed"
        }
      },
      {
        "from": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
          "line": 12,
          "fragment": "import { sharedDenied } from '../../../../../../utils/mode';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../../lib/workspace"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "to": "server/utils/bulk-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "line": 5,
          "fragment": "import { BULK_LIMIT } from '../../../../../utils/bulk-servic"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "to": "server/utils/intent-map-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "line": 7,
          "fragment": "import { linkIntentMap } from '../../../../../utils/intent-m"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/link-map.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/lib/transitions.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 4,
          "fragment": "import { BULK_DIRECTIONS, type BulkDirection } from '../../."
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 5,
          "fragment": "import { WorkspaceError } from '../../../../../lib/workspace"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/utils/bulk-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 6,
          "fragment": "import { BULK_LIMIT, bulkStatus } from '../../../../../utils"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 7,
          "fragment": "import { fail } from '../../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 8,
          "fragment": "import { findProject } from '../../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/records/bulk/status.post.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/records/bulk/status.post.ts",
          "line": 52,
          "fragment": "import { staleVersions } from '../../../../../utils/record-w"
        }
      },
      {
        "from": "server/api/projects/[id]/reference.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference.get.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference.get.ts",
          "line": 6,
          "fragment": "import { fingerprintWithSources, memoByFingerprint } from '."
        }
      },
      {
        "from": "server/api/projects/[id]/reference.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference.get.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference.get.ts",
          "line": 8,
          "fragment": "import { referenceReport } from '../../../utils/reference-se"
        }
      },
      {
        "from": "server/api/projects/[id]/reference/rebuild.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference/rebuild.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference/rebuild.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference/rebuild.post.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference/rebuild.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference/rebuild.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference/rebuild.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference/rebuild.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/reference/rebuild.post.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/reference/rebuild.post.ts",
          "line": 7,
          "fragment": "import { rebuildReferenceIndex } from '../../../../utils/ref"
        }
      },
      {
        "from": "server/api/projects/[id]/rules.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/rules.get.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/rules.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/rules.get.ts",
          "line": 4,
          "fragment": "import { WorkspaceError } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/rules.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/rules.get.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/rules.get.ts",
        "to": "server/utils/memo.ts",
        "evidence": {
          "path": "server/api/projects/[id]/rules.get.ts",
          "line": 6,
          "fragment": "import { fingerprintWithSources, memoByFingerprint } from '."
        }
      },
      {
        "from": "server/api/projects/[id]/rules.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/rules.get.ts",
          "line": 7,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/rules.get.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/rules.get.ts",
          "line": 8,
          "fragment": "import { resolveProjectRules } from '../../../utils/rules-se"
        }
      },
      {
        "from": "server/api/projects/[id]/runs.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/runs.post.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/runs.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/runs.post.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/runs.post.ts",
        "to": "server/lib/attachments.ts",
        "evidence": {
          "path": "server/api/projects/[id]/runs.post.ts",
          "line": 5,
          "fragment": "import { isAttachmentPath } from '../../../lib/attachments';"
        }
      },
      {
        "from": "server/api/projects/[id]/runs.post.ts",
        "to": "server/lib/manual-report.ts",
        "evidence": {
          "path": "server/api/projects/[id]/runs.post.ts",
          "line": 6,
          "fragment": "import type { RunState } from '../../../lib/manual-report';"
        }
      },
      {
        "from": "server/api/projects/[id]/runs.post.ts",
        "to": "server/utils/verified-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/runs.post.ts",
          "line": 7,
          "fragment": "import { recordRun } from '../../../utils/verified-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 5,
          "fragment": "import { resolveInside } from '../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/lib/search.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 6,
          "fragment": "import { buildSearchIndex, searchIndex, type SearchDoc, type"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 7,
          "fragment": "import { readWorkspace } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 8,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 9,
          "fragment": "import { inboxNotes } from '../../../utils/inbox-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 10,
          "fragment": "import { loadIndex } from '../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/search.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search.get.ts",
          "line": 11,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/search/index.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search/index.post.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/search/index.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search/index.post.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/search/index.post.ts",
        "to": "server/utils/semantic-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search/index.post.ts",
          "line": 5,
          "fragment": "import { ensureIndex, resetIndex } from '../../../../utils/s"
        }
      },
      {
        "from": "server/api/projects/[id]/search/semantic.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search/semantic.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/search/semantic.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search/semantic.get.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/search/semantic.get.ts",
        "to": "server/utils/semantic-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/search/semantic.get.ts",
          "line": 5,
          "fragment": "import { semanticSearch } from '../../../../utils/semantic-s"
        }
      },
      {
        "from": "server/api/projects/[id]/shared/index.get.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/api/projects/[id]/shared/index.get.ts",
          "line": 3,
          "fragment": "import { withBuiltin } from '../../../../lib/builtin';"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/apply.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/apply.post.ts",
          "line": 3,
          "fragment": "import { OutsideRootError } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/apply.post.ts",
        "to": "server/lib/source-detect.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/apply.post.ts",
          "line": 4,
          "fragment": "import type { SourceKind } from '../../../../lib/source-dete"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/apply.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/apply.post.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/apply.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/apply.post.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/apply.post.ts",
        "to": "server/utils/source-scan.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/apply.post.ts",
          "line": 7,
          "fragment": "import { applySources } from '../../../../utils/source-scan'"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/detect.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/detect.get.ts",
          "line": 3,
          "fragment": "import { fail } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/detect.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/detect.get.ts",
          "line": 4,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/sources/detect.get.ts",
        "to": "server/utils/source-scan.ts",
        "evidence": {
          "path": "server/api/projects/[id]/sources/detect.get.ts",
          "line": 5,
          "fragment": "import { detectProjectSources } from '../../../../utils/sour"
        }
      },
      {
        "from": "server/api/projects/[id]/team.get.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/team.get.ts",
          "line": 3,
          "fragment": "import { readManifest } from '../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/team.get.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/api/projects/[id]/team.get.ts",
          "line": 4,
          "fragment": "import { authEnabled, loadUsers } from '../../../utils/auth'"
        }
      },
      {
        "from": "server/api/projects/[id]/team.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/team.get.ts",
          "line": 5,
          "fragment": "import { fail } from '../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/team.get.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/team.get.ts",
          "line": 6,
          "fragment": "import { findProject } from '../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/git-init.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/git-init.post.ts",
          "line": 5,
          "fragment": "import { normalizeRoot } from '../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/git-init.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/git-init.post.ts",
          "line": 6,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/git-init.post.ts",
        "to": "server/utils/git.ts",
        "evidence": {
          "path": "server/api/projects/git-init.post.ts",
          "line": 7,
          "fragment": "import { initRepository, isRepository } from '../../utils/gi"
        }
      },
      {
        "from": "server/api/projects/git-init.post.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/projects/git-init.post.ts",
          "line": 8,
          "fragment": "import { rootAllowed } from '../../utils/mode';"
        }
      },
      {
        "from": "server/api/projects/git-status.get.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/git-status.get.ts",
          "line": 5,
          "fragment": "import { normalizeRoot } from '../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/git-status.get.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/git-status.get.ts",
          "line": 6,
          "fragment": "import { fail } from '../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/git-status.get.ts",
        "to": "server/utils/git.ts",
        "evidence": {
          "path": "server/api/projects/git-status.get.ts",
          "line": 7,
          "fragment": "import { currentBranch, isRepository } from '../../utils/git"
        }
      },
      {
        "from": "server/api/projects/git-status.get.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/projects/git-status.get.ts",
          "line": 8,
          "fragment": "import { rootAllowed } from '../../utils/mode';"
        }
      },
      {
        "from": "server/api/projects/index.post.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/projects/index.post.ts",
          "line": 7,
          "fragment": "import { rootAllowed } from '../../utils/mode';"
        }
      },
      {
        "from": "server/api/projects/init.post.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/api/projects/init.post.ts",
          "line": 13,
          "fragment": "import { rootAllowed } from '../../utils/mode'; import { con"
        }
      },
      {
        "from": "server/lib/actions.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/lib/actions.ts",
          "line": 12,
          "fragment": "} from './write';"
        }
      },
      {
        "from": "server/lib/agent-run.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/lib/agent-run.ts",
          "line": 1,
          "fragment": "import type { Access } from '../utils/llm';"
        }
      },
      {
        "from": "server/lib/agent-run.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/lib/agent-run.ts",
          "line": 3,
          "fragment": "import type { AgentAccess, AgentDef } from './agents';"
        }
      },
      {
        "from": "server/lib/analyst.ts",
        "to": "server/lib/criteria.ts",
        "evidence": {
          "path": "server/lib/analyst.ts",
          "line": 1,
          "fragment": "import { parseCriteria } from './criteria';"
        }
      },
      {
        "from": "server/lib/analyst.ts",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "server/lib/analyst.ts",
          "line": 2,
          "fragment": "import { glossaryChunk, type GlossaryTerm } from './glossary"
        }
      },
      {
        "from": "server/lib/analyze.ts",
        "to": "server/lib/practice-rules.ts",
        "evidence": {
          "path": "server/lib/analyze.ts",
          "line": 3,
          "fragment": "import { resolveRules, type RuleRecord, type RulesResolution"
        }
      },
      {
        "from": "server/lib/analyze.ts",
        "to": "server/lib/reference.ts",
        "evidence": {
          "path": "server/lib/analyze.ts",
          "line": 4,
          "fragment": "import type { ReferenceEntry } from './reference';"
        }
      },
      {
        "from": "server/lib/analyze.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/analyze.ts",
          "line": 17,
          "fragment": "} from './types';"
        }
      },
      {
        "from": "server/lib/analyze.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/analyze.ts",
          "line": 18,
          "fragment": "import { resolveDesign } from './design';"
        }
      },
      {
        "from": "server/lib/analyze.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/lib/analyze.ts",
          "line": 19,
          "fragment": "import type { DesignReport } from './design-screens';"
        }
      },
      {
        "from": "server/lib/architecture-capabilities.ts",
        "to": "server/lib/architecture.ts",
        "evidence": {
          "path": "server/lib/architecture-capabilities.ts",
          "line": 1,
          "fragment": "import type { ArchModule } from './architecture';"
        }
      },
      {
        "from": "server/lib/architecture-capabilities.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/architecture-capabilities.ts",
          "line": 2,
          "fragment": "import type { CapabilityLike } from './functional';"
        }
      },
      {
        "from": "server/lib/architecture-capabilities.ts",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "server/lib/architecture-capabilities.ts",
          "line": 3,
          "fragment": "import { declaredGroupOf, type DeclaredGroup } from './group"
        }
      },
      {
        "from": "server/lib/architecture.ts",
        "to": "server/lib/glob.ts",
        "evidence": {
          "path": "server/lib/architecture.ts",
          "line": 1,
          "fragment": "import { globCovers, globMatch } from './glob';"
        }
      },
      {
        "from": "server/lib/batch-check.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/batch-check.ts",
          "line": 1,
          "fragment": "import type { WorkRecord } from './types';"
        }
      },
      {
        "from": "server/lib/builtin.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/builtin.ts",
          "line": 1,
          "fragment": "import type { SharedSource } from './types';"
        }
      },
      {
        "from": "server/lib/context-pack.ts",
        "to": "server/lib/graph.ts",
        "evidence": {
          "path": "server/lib/context-pack.ts",
          "line": 1,
          "fragment": "import { buildGraph } from './graph';"
        }
      },
      {
        "from": "server/lib/context-pack.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/lib/context-pack.ts",
          "line": 2,
          "fragment": "import { withoutJournal } from './write';"
        }
      },
      {
        "from": "server/lib/context-pack.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/context-pack.ts",
          "line": 3,
          "fragment": "import type { LinkKind, WorkRecord } from './types';"
        }
      },
      {
        "from": "server/lib/contracts-import.ts",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "server/lib/contracts-import.ts",
          "line": 3,
          "fragment": "import { parseGlossary, type GlossaryTerm } from './glossary"
        }
      },
      {
        "from": "server/lib/contracts-import.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/lib/contracts-import.ts",
          "line": 4,
          "fragment": "import type { ProposedRecord } from './inbox';"
        }
      },
      {
        "from": "server/lib/contracts-import.ts",
        "to": "server/lib/source-detect.ts",
        "evidence": {
          "path": "server/lib/contracts-import.ts",
          "line": 5,
          "fragment": "import type { FileFinding } from './source-detect';"
        }
      },
      {
        "from": "server/lib/course.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/course.ts",
          "line": 1,
          "fragment": "import type { MapChange } from './maps';"
        }
      },
      {
        "from": "server/lib/coverage.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/coverage.ts",
          "line": 12,
          "fragment": "} from './functional';"
        }
      },
      {
        "from": "server/lib/coverage.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/coverage.ts",
          "line": 13,
          "fragment": "import { approvedMaps, foldMaps, parseMapRecord, type MapCha"
        }
      },
      {
        "from": "server/lib/coverage.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/coverage.ts",
          "line": 14,
          "fragment": "import { RETIRED_STATUSES, type VerificationResult, type Wor"
        }
      },
      {
        "from": "server/lib/custom-maps.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/custom-maps.ts",
          "line": 1,
          "fragment": "import { RELATION_LABEL, RELATION_TYPES, isRelationType, typ"
        }
      },
      {
        "from": "server/lib/custom-maps.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/custom-maps.ts",
          "line": 2,
          "fragment": "import { mapDraftText, type CustomChange, type CustomLinks, "
        }
      },
      {
        "from": "server/lib/custom-maps.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/custom-maps.ts",
          "line": 3,
          "fragment": "import type { CustomMapDefinition, CustomMapFeature, Project"
        }
      },
      {
        "from": "server/lib/design-catalog.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/design-catalog.ts",
          "line": 14,
          "fragment": "import type { DesignComponent } from './design';"
        }
      },
      {
        "from": "server/lib/design-constructors.ts",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "server/lib/design-constructors.ts",
          "line": 1,
          "fragment": "import type { StackId } from './design-export';"
        }
      },
      {
        "from": "server/lib/design-diff.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/design-diff.ts",
          "line": 1,
          "fragment": "import { MIN_CONTRAST, paletteContrast, type PlainTokens } f"
        }
      },
      {
        "from": "server/lib/design-diff.ts",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "server/lib/design-diff.ts",
          "line": 2,
          "fragment": "import { exportStack, lineDiff, STACK_LABEL, type StackId } "
        }
      },
      {
        "from": "server/lib/design-export.ts",
        "to": "server/lib/design-surface.ts",
        "evidence": {
          "path": "server/lib/design-export.ts",
          "line": 1,
          "fragment": "import { capsClasses, surfaceVariables } from './design-surf"
        }
      },
      {
        "from": "server/lib/design-export.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/design-export.ts",
          "line": 15,
          "fragment": "} from './design';"
        }
      },
      {
        "from": "server/lib/design-figma.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/design-figma.ts",
          "line": 1,
          "fragment": "import { DEFAULT_ROOT, PALETTE_ROLES, type PlainTokens } fro"
        }
      },
      {
        "from": "server/lib/design-port.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/design-port.ts",
          "line": 8,
          "fragment": "import type { DesignComponent } from './design';"
        }
      },
      {
        "from": "server/lib/design-port.ts",
        "to": "server/lib/design-catalog.ts",
        "evidence": {
          "path": "server/lib/design-port.ts",
          "line": 9,
          "fragment": "import { REFERENCE_STACK, type CatalogReport } from './desig"
        }
      },
      {
        "from": "server/lib/design-theme.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/design-theme.ts",
          "line": 1,
          "fragment": "import { contrastRatio, paletteContrast, type BaseTheme } fr"
        }
      },
      {
        "from": "server/lib/design.ts",
        "to": "server/lib/design-surface.ts",
        "evidence": {
          "path": "server/lib/design.ts",
          "line": 16,
          "fragment": "import { parseSurface, type SurfaceTokens } from './design-s"
        }
      },
      {
        "from": "server/lib/fix-diff.ts",
        "to": "server/lib/order-diff.ts",
        "evidence": {
          "path": "server/lib/fix-diff.ts",
          "line": 1,
          "fragment": "import type { OrderGroup } from './order-diff';"
        }
      },
      {
        "from": "server/lib/flow-groups.ts",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "server/lib/flow-groups.ts",
          "line": 1,
          "fragment": "import { OTHER_GROUP, worstStatus, type Grouping } from './g"
        }
      },
      {
        "from": "server/lib/flow-groups.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/flow-groups.ts",
          "line": 2,
          "fragment": "import type { Evidence, EvidenceVerdict } from './maps';"
        }
      },
      {
        "from": "server/lib/flow-groups.ts",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "server/lib/flow-groups.ts",
          "line": 211,
          "fragment": "import { foldEdges, visibleAt, type TreeNode } from './hiera"
        }
      },
      {
        "from": "server/lib/functional.ts",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "server/lib/functional.ts",
          "line": 1086,
          "fragment": "import { ancestors, cyclesAt, foldEdges, visibleAt, type Tre"
        }
      },
      {
        "from": "server/lib/groups.ts",
        "to": "server/lib/layers.ts",
        "evidence": {
          "path": "server/lib/groups.ts",
          "line": 1,
          "fragment": "import { layerOf } from './layers';"
        }
      },
      {
        "from": "server/lib/groups.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/groups.ts",
          "line": 2,
          "fragment": "import type { Evidence, EvidenceVerdict } from './maps';"
        }
      },
      {
        "from": "server/lib/groups.ts",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "server/lib/groups.ts",
          "line": 387,
          "fragment": "import { ancestors, foldEdges, visibleAt, type Edge, type Fo"
        }
      },
      {
        "from": "server/lib/import.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/lib/import.ts",
          "line": 4,
          "fragment": "import { yamlSafe } from './write';"
        }
      },
      {
        "from": "server/lib/inbox.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/inbox.ts",
          "line": 1,
          "fragment": "import { drawableRelations, type CapabilityLike, type Relati"
        }
      },
      {
        "from": "server/lib/indexer.ts",
        "to": "server/lib/practice-rules.ts",
        "evidence": {
          "path": "server/lib/indexer.ts",
          "line": 2,
          "fragment": "import type { RuleRecord } from './practice-rules';"
        }
      },
      {
        "from": "server/lib/indexer.ts",
        "to": "server/lib/reference.ts",
        "evidence": {
          "path": "server/lib/indexer.ts",
          "line": 3,
          "fragment": "import type { ReferenceEntry } from './reference';"
        }
      },
      {
        "from": "server/lib/indexer.ts",
        "to": "server/lib/branch.ts",
        "evidence": {
          "path": "server/lib/indexer.ts",
          "line": 16,
          "fragment": "import { recordOfBranch } from './branch';"
        }
      },
      {
        "from": "server/lib/indexer.ts",
        "to": "server/utils/git.ts",
        "evidence": {
          "path": "server/lib/indexer.ts",
          "line": 17,
          "fragment": "import { hasChangesSync, workBranchesSync } from '../utils/g"
        }
      },
      {
        "from": "server/lib/indexer.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/lib/indexer.ts",
          "line": 18,
          "fragment": "import type { DesignReport } from './design-screens';"
        }
      },
      {
        "from": "server/lib/indexer.ts",
        "to": "server/lib/version.ts",
        "evidence": {
          "path": "server/lib/indexer.ts",
          "line": 158,
          "fragment": "import { versionOf } from './version';"
        }
      },
      {
        "from": "server/lib/intent-map.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/lib/intent-map.ts",
          "line": 1,
          "fragment": "import type { ProposedRecord } from './inbox';"
        }
      },
      {
        "from": "server/lib/issues-diff.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/issues-diff.ts",
          "line": 1,
          "fragment": "import type { IssueDto } from './types';"
        }
      },
      {
        "from": "server/lib/knowledge.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/lib/knowledge.ts",
          "line": 1,
          "fragment": "import { titleOf } from './inbox';"
        }
      },
      {
        "from": "server/lib/llm-provider.ts",
        "to": "server/lib/stream-events.ts",
        "evidence": {
          "path": "server/lib/llm-provider.ts",
          "line": 1,
          "fragment": "import type { ModelEvent } from './stream-events';"
        }
      },
      {
        "from": "server/lib/manager.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/manager.ts",
          "line": 1,
          "fragment": "import type { CapabilityLike } from './functional';"
        }
      },
      {
        "from": "server/lib/manager.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/manager.ts",
          "line": 2,
          "fragment": "import type { IndexRecord } from './types';"
        }
      },
      {
        "from": "server/lib/manager.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/lib/manager.ts",
          "line": 3,
          "fragment": "import { joinRecord, splitRecord } from './write';"
        }
      },
      {
        "from": "server/lib/map-diff.ts",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "server/lib/map-diff.ts",
          "line": 1,
          "fragment": "import { ancestors, visibleAncestor, type TreeNode } from '."
        }
      },
      {
        "from": "server/lib/map-diff.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/map-diff.ts",
          "line": 2,
          "fragment": "import { approvedMaps, foldMaps, parseMapRecord, type MapCha"
        }
      },
      {
        "from": "server/lib/map-diff.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/map-diff.ts",
          "line": 3,
          "fragment": "import type { WorkRecord } from './types';"
        }
      },
      {
        "from": "server/lib/maps.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/maps.ts",
          "line": 1,
          "fragment": "import type { Horizon, ImplStatus, Priority, RelationType } "
        }
      },
      {
        "from": "server/lib/maps.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/maps.ts",
          "line": 3,
          "fragment": "import type { WorkRecord } from './types';"
        }
      },
      {
        "from": "server/lib/metrics.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/metrics.ts",
          "line": 1,
          "fragment": "import type { ProjectIndex } from './types';"
        }
      },
      {
        "from": "server/lib/new-project.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/lib/new-project.ts",
          "line": 1,
          "fragment": "import type { ProposedRecord } from './inbox';"
        }
      },
      {
        "from": "server/lib/new-project.ts",
        "to": "server/lib/scaffold.ts",
        "evidence": {
          "path": "server/lib/new-project.ts",
          "line": 2,
          "fragment": "import { slugify } from './scaffold';"
        }
      },
      {
        "from": "server/lib/overview.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/overview.ts",
          "line": 1,
          "fragment": "import type { IndexRecord, IssueDto, VerificationOutcome } f"
        }
      },
      {
        "from": "server/lib/parse.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/parse.ts",
          "line": 11,
          "fragment": "} from './types';"
        }
      },
      {
        "from": "server/lib/permissions.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/lib/permissions.ts",
          "line": 5,
          "fragment": "import { AGENT_FORBIDDEN_ACTIONS } from './agents';"
        }
      },
      {
        "from": "server/lib/phase-plan.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/lib/phase-plan.ts",
          "line": 1,
          "fragment": "import type { ProposedRecord } from './inbox';"
        }
      },
      {
        "from": "server/lib/phase-plan.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/phase-plan.ts",
          "line": 2,
          "fragment": "import type { IndexRecord } from './types';"
        }
      },
      {
        "from": "server/lib/portfolio.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/portfolio.ts",
          "line": 1,
          "fragment": "import type { ProjectIndex } from './types';"
        }
      },
      {
        "from": "server/lib/practice-rules.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/practice-rules.ts",
          "line": 1,
          "fragment": "import type { ArchitectureConfig } from './types';"
        }
      },
      {
        "from": "server/lib/project-templates.ts",
        "to": "server/lib/role-maps.ts",
        "evidence": {
          "path": "server/lib/project-templates.ts",
          "line": 1,
          "fragment": "import { ROLE_MAP_TEMPLATES } from './role-maps';"
        }
      },
      {
        "from": "server/lib/project-templates.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/project-templates.ts",
          "line": 2,
          "fragment": "import type { CustomMapDefinition } from './types';"
        }
      },
      {
        "from": "server/lib/project-templates.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/lib/project-templates.ts",
          "line": 3,
          "fragment": "import { yamlSafe } from './write';"
        }
      },
      {
        "from": "server/lib/prompt.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/prompt.ts",
          "line": 2,
          "fragment": "import { capabilityLines, relationLines, type CapabilityLike"
        }
      },
      {
        "from": "server/lib/prompt.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/prompt.ts",
          "line": 4,
          "fragment": "import type { PlainTokens } from './design';"
        }
      },
      {
        "from": "server/lib/prompt.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/lib/prompt.ts",
          "line": 5,
          "fragment": "import type { DesignScreens } from './design-screens';"
        }
      },
      {
        "from": "server/lib/record-diff.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/lib/record-diff.ts",
          "line": 1,
          "fragment": "import { parseMapRecord, type Vision } from './maps';"
        }
      },
      {
        "from": "server/lib/record-diff.ts",
        "to": "server/lib/parse.ts",
        "evidence": {
          "path": "server/lib/record-diff.ts",
          "line": 2,
          "fragment": "import { parseRecord } from './parse';"
        }
      },
      {
        "from": "server/lib/reference.ts",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "server/lib/reference.ts",
          "line": 1,
          "fragment": "import { groupCard, groupModules, type DeclaredGroup, type G"
        }
      },
      {
        "from": "server/lib/reviewer.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/reviewer.ts",
          "line": 1,
          "fragment": "import type { IndexRecord } from './types';"
        }
      },
      {
        "from": "server/lib/role-maps.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/role-maps.ts",
          "line": 1,
          "fragment": "import type { CustomMapDefinition, CustomRelationStyle } fro"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/reference.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 3,
          "fragment": "import { buildReferenceIndex, sameIndex, type ReferenceEntry"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/practice-rules.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 4,
          "fragment": "import type { RulesResolution } from './practice-rules';"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/coverage.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 5,
          "fragment": "import { capabilityFindings } from './coverage';"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/batch-check.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 6,
          "fragment": "import { taskGaps } from './batch-check'; import { brokenMap"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 25,
          "fragment": "} from './types';"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 26,
          "fragment": "import { plainTokens, type DesignResolution } from './design"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 27,
          "fragment": "import { PASS_LABEL, latestReports, type DesignReport } from"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 36,
          "fragment": "} from './design-export';"
        }
      },
      {
        "from": "server/lib/strategy.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "server/lib/strategy.ts",
          "line": 1,
          "fragment": "import { childrenIndex, effectiveOwner, leavesUnder, progres"
        }
      },
      {
        "from": "server/lib/task-order.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/task-order.ts",
          "line": 1,
          "fragment": "import { RETIRED_STATUSES, type LinkKind } from './types';"
        }
      },
      {
        "from": "server/lib/test-checks.ts",
        "to": "server/lib/inbox.ts",
        "evidence": {
          "path": "server/lib/test-checks.ts",
          "line": 1,
          "fragment": "import type { ProposedRecord } from './inbox';"
        }
      },
      {
        "from": "server/lib/verify-desk.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/verify-desk.ts",
          "line": 1,
          "fragment": "import type { IndexRecord } from './types';"
        }
      },
      {
        "from": "server/lib/version.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/version.ts",
          "line": 3,
          "fragment": "import type { WorkRecord } from './types';"
        }
      },
      {
        "from": "server/lib/work-order.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/work-order.ts",
          "line": 1,
          "fragment": "import type { IndexRecord } from './types';"
        }
      },
      {
        "from": "server/lib/workspace.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/lib/workspace.ts",
          "line": 7,
          "fragment": "import { onCacheDropped } from './cache';"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 3,
          "fragment": "import { agentSignature, agentVerdict } from '../lib/agents'"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 4,
          "fragment": "import { signature } from '../lib/auth';"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/lib/permissions.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 5,
          "fragment": "import { actionFor, can, type TeamMember } from '../lib/perm"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 6,
          "fragment": "import { readManifest } from '../lib/workspace';"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 7,
          "fragment": "import { authEnabled, currentUser, loadUsers } from '../util"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 8,
          "fragment": "import { loadIndex } from '../utils/index-service';"
        }
      },
      {
        "from": "server/middleware/auth.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/middleware/auth.ts",
          "line": 9,
          "fragment": "import { findProject } from '../utils/projects';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/lib/agent-run.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 3,
          "fragment": "import { accessFor, agentForAssignee, agentRunPrompt, parseA"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 4,
          "fragment": "import { agentSignature } from '../lib/agents';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 5,
          "fragment": "import { signature } from '../lib/auth';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 6,
          "fragment": "import { resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 7,
          "fragment": "import type { IndexRecord } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 8,
          "fragment": "import { readManifest } from '../lib/workspace';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 9,
          "fragment": "import type { Access } from './llm';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/utils/agents-service.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 10,
          "fragment": "import { listAgents } from './agents-service';"
        }
      },
      {
        "from": "server/utils/agent-run-service.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/utils/agent-run-service.ts",
          "line": 11,
          "fragment": "import { agentToken, authEnabled, loadUsers } from './auth';"
        }
      },
      {
        "from": "server/utils/agents-service.ts",
        "to": "server/lib/agents.ts",
        "evidence": {
          "path": "server/utils/agents-service.ts",
          "line": 4,
          "fragment": "import { AGENTS_DIR, agentText, parseAgent, type AgentDef } "
        }
      },
      {
        "from": "server/utils/agents-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/agents-service.ts",
          "line": 5,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/architecture-service.ts",
        "to": "server/lib/architecture.ts",
        "evidence": {
          "path": "server/utils/architecture-service.ts",
          "line": 1,
          "fragment": "import { checkArchitecture, type ArchCode } from '../lib/arc"
        }
      },
      {
        "from": "server/utils/architecture-service.ts",
        "to": "server/lib/architecture-capabilities.ts",
        "evidence": {
          "path": "server/utils/architecture-service.ts",
          "line": 2,
          "fragment": "import { reconcileCapabilities, type CapabilityReconcile } f"
        }
      },
      {
        "from": "server/utils/architecture-service.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/utils/architecture-service.ts",
          "line": 3,
          "fragment": "import { buildProjectMap } from './map-service';"
        }
      },
      {
        "from": "server/utils/architecture-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/architecture-service.ts",
          "line": 4,
          "fragment": "import { readWorkspace } from '../lib/workspace';"
        }
      },
      {
        "from": "server/utils/architecture-service.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/utils/architecture-service.ts",
          "line": 5,
          "fragment": "import { resolveProjectRules } from './rules-service';"
        }
      },
      {
        "from": "server/utils/architecture-service.ts",
        "to": "server/lib/practice-rules.ts",
        "evidence": {
          "path": "server/utils/architecture-service.ts",
          "line": 6,
          "fragment": "import type { RulesResolution } from '../lib/practice-rules'"
        }
      },
      {
        "from": "server/utils/auth.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "server/utils/auth.ts",
          "line": 7,
          "fragment": "import { isAgentSessionName, readAgentToken, readSession, si"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/lib/actions.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 1,
          "fragment": "import { applyStatusChange } from '../lib/actions';"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/lib/issues-diff.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 2,
          "fragment": "import { newIssues } from '../lib/issues-diff';"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/lib/rules.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 3,
          "fragment": "import { checkTransition } from '../lib/rules';"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 4,
          "fragment": "import type { IssueDto } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/lib/transitions.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 5,
          "fragment": "import { bulkPath, type BulkDirection } from '../lib/transit"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 6,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/utils/inventory-service.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 7,
          "fragment": "import { markDescribed } from './inventory-service';"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 8,
          "fragment": "import { openRecord, today, writeRecord } from './record-wri"
        }
      },
      {
        "from": "server/utils/bulk-service.ts",
        "to": "server/utils/record-diff-service.ts",
        "evidence": {
          "path": "server/utils/bulk-service.ts",
          "line": 9,
          "fragment": "import { wasViewed } from './record-diff-service';"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/lib/context-pack.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 3,
          "fragment": "import { buildContextPack, makeChunk, renderContextPack, typ"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/lib/parse.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 4,
          "fragment": "import { parseRecord } from '../lib/parse';"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 5,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 6,
          "fragment": "import type { WorkRecord } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 7,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 8,
          "fragment": "import { buildProjectMap } from './map-service';"
        }
      },
      {
        "from": "server/utils/context-service.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "server/utils/context-service.ts",
          "line": 9,
          "fragment": "import { referenceIndexText } from './reference-service';"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 4,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/lib/contracts-import.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 5,
          "fragment": "import { contractRecords, mergeGlossary, parseDependencies, "
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 6,
          "fragment": "import { dropCache } from '../lib/cache';"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 7,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/lib/source-detect.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 8,
          "fragment": "import { detectSources, type FileFinding } from '../lib/sour"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 9,
          "fragment": "import { readWorkspace, sourceReader } from '../lib/workspac"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 11,
          "fragment": "import { createRecords } from './inbox-service';"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/utils/source-scan.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 12,
          "fragment": "import { listProjectFiles } from './source-scan';"
        }
      },
      {
        "from": "server/utils/contracts-service.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/utils/contracts-service.ts",
          "line": 13,
          "fragment": "import { today } from './record-write';"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/lib/design-catalog.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 1,
          "fragment": "import { buildCatalogReport, catalogSources, type CatalogRep"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 2,
          "fragment": "import { STACK_LABEL, exportStack, isStackId, projectFilePat"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 3,
          "fragment": "import { plainTokens } from '../lib/design';"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/lib/design-port.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 4,
          "fragment": "import { portPrompt, storyPairs, type StoryPair } from '../l"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 5,
          "fragment": "import { listFiles } from './design-screens-service';"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 6,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 7,
          "fragment": "import { readManifest, sourceReader } from '../lib/workspace"
        }
      },
      {
        "from": "server/utils/design-catalog-service.ts",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "server/utils/design-catalog-service.ts",
          "line": 8,
          "fragment": "import { projectDesign } from './design-service';"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 1,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 2,
          "fragment": "import { withBuiltin } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 3,
          "fragment": "import { plainTokens, resolveDesign, type DesignRecord } fro"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/lib/design-diff.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 4,
          "fragment": "import { designDiff, type DesignDiff } from '../lib/design-d"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 5,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 6,
          "fragment": "import { readManifest, readWorkspace } from '../lib/workspac"
        }
      },
      {
        "from": "server/utils/design-diff-service.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/utils/design-diff-service.ts",
          "line": 7,
          "fragment": "import { generalRuleRecords } from './rules-service';"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 4,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/lib/design-screens.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 18,
          "fragment": "} from '../lib/design-screens';"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 19,
          "fragment": "import { approvedMaps, foldMaps, parseMapRecord } from '../l"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 20,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 21,
          "fragment": "import { readManifest, readWorkspace } from '../lib/workspac"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 22,
          "fragment": "import { themeNames } from '../lib/design';"
        }
      },
      {
        "from": "server/utils/design-screens-service.ts",
        "to": "server/utils/design-service.ts",
        "evidence": {
          "path": "server/utils/design-screens-service.ts",
          "line": 23,
          "fragment": "import { projectDesign } from './design-service';"
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 1,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 2,
          "fragment": "import { BUILTIN_SOURCE, withBuiltin } from '../lib/builtin'"
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/lib/design.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 3,
          "fragment": "import { compareVersions, plainTokens, resolveDesign, type D"
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/lib/design-export.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 15,
          "fragment": "} from '../lib/design-export';"
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 16,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 17,
          "fragment": "import { readManifest, readWorkspace, sourceReader } from '."
        }
      },
      {
        "from": "server/utils/design-service.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/utils/design-service.ts",
          "line": 18,
          "fragment": "import { generalRuleRecords } from './rules-service';"
        }
      },
      {
        "from": "server/utils/fix-service.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/utils/fix-service.ts",
          "line": 19,
          "fragment": "import { ask } from './llm';"
        }
      },
      {
        "from": "server/utils/inbox-service.ts",
        "to": "server/lib/intent-map.ts",
        "evidence": {
          "path": "server/utils/inbox-service.ts",
          "line": 4,
          "fragment": "import { withIntentMap } from '../lib/intent-map';"
        }
      },
      {
        "from": "server/utils/inbox-service.ts",
        "to": "server/lib/parse.ts",
        "evidence": {
          "path": "server/utils/inbox-service.ts",
          "line": 6,
          "fragment": "import { parseRecord } from '../lib/parse';"
        }
      },
      {
        "from": "server/utils/inbox-service.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/utils/inbox-service.ts",
          "line": 15,
          "fragment": "import { buildProjectMap } from './map-service';"
        }
      },
      {
        "from": "server/utils/index-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/index-service.ts",
          "line": 5,
          "fragment": "import { withBuiltin } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/index-service.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/utils/index-service.ts",
          "line": 6,
          "fragment": "import { generalReferenceEntries, generalRuleRecords } from "
        }
      },
      {
        "from": "server/utils/index-service.ts",
        "to": "server/utils/design-screens-service.ts",
        "evidence": {
          "path": "server/utils/index-service.ts",
          "line": 7,
          "fragment": "import { readDesignReports } from './design-screens-service'"
        }
      },
      {
        "from": "server/utils/intent-map-service.ts",
        "to": "server/lib/actions.ts",
        "evidence": {
          "path": "server/utils/intent-map-service.ts",
          "line": 1,
          "fragment": "import { applyFieldPatch } from '../lib/actions';"
        }
      },
      {
        "from": "server/utils/intent-map-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/intent-map-service.ts",
          "line": 2,
          "fragment": "import type { LinkKind } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/intent-map-service.ts",
        "to": "server/lib/intent-map.ts",
        "evidence": {
          "path": "server/utils/intent-map-service.ts",
          "line": 3,
          "fragment": "import { intentMapBody, intentMapTitle } from '../lib/intent"
        }
      },
      {
        "from": "server/utils/intent-map-service.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/utils/intent-map-service.ts",
          "line": 4,
          "fragment": "import { createRecords } from './inbox-service';"
        }
      },
      {
        "from": "server/utils/intent-map-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/intent-map-service.ts",
          "line": 5,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/intent-map-service.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/utils/intent-map-service.ts",
          "line": 6,
          "fragment": "import { openRecord, today, writeRecord } from './record-wri"
        }
      },
      {
        "from": "server/utils/job-feeds.ts",
        "to": "server/lib/job-feed.ts",
        "evidence": {
          "path": "server/utils/job-feeds.ts",
          "line": 3,
          "fragment": "import { JobFeed, expired, peersOf, supersededBy, type FeedO"
        }
      },
      {
        "from": "server/utils/job-feeds.ts",
        "to": "server/utils/llm-gateway.ts",
        "evidence": {
          "path": "server/utils/job-feeds.ts",
          "line": 5,
          "fragment": "import { llmQueue } from './llm-gateway';"
        }
      },
      {
        "from": "server/utils/job-feeds.ts",
        "to": "server/utils/sse.ts",
        "evidence": {
          "path": "server/utils/job-feeds.ts",
          "line": 6,
          "fragment": "import { eventStream, type EventStream } from './sse';"
        }
      },
      {
        "from": "server/utils/llm-agents.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/utils/llm-agents.ts",
          "line": 5,
          "fragment": "import { childEnvironment, looksLikeRefusal, spawnClaude, ty"
        }
      },
      {
        "from": "server/utils/llm-agents.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-agents.ts",
          "line": 6,
          "fragment": "import type { Provider, ProviderRequest, ProviderResult } fr"
        }
      },
      {
        "from": "server/utils/llm-anthropic.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-anthropic.ts",
          "line": 1,
          "fragment": "import type { Provider, ProviderRequest, ProviderResult } fr"
        }
      },
      {
        "from": "server/utils/llm-anthropic.ts",
        "to": "server/utils/llm-http.ts",
        "evidence": {
          "path": "server/utils/llm-anthropic.ts",
          "line": 3,
          "fragment": "import { emptyFailure, failureOf, sseData } from './llm-http"
        }
      },
      {
        "from": "server/utils/llm-anthropic.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/utils/llm-anthropic.ts",
          "line": 4,
          "fragment": "import { resolveKey, type ProviderSetting } from './llm-sett"
        }
      },
      {
        "from": "server/utils/llm-claude.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-claude.ts",
          "line": 1,
          "fragment": "import type { Provider, ProviderRequest, ProviderResult } fr"
        }
      },
      {
        "from": "server/utils/llm-claude.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/utils/llm-claude.ts",
          "line": 3,
          "fragment": "import { ask, availability } from './llm';"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 1,
          "fragment": "import { getProvider, listProviders } from '../lib/llm-provi"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/lib/llm-queue.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 2,
          "fragment": "import { LlmQueue, type JobOutcome } from '../lib/llm-queue'"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/lib/llm-routing.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 3,
          "fragment": "import { defaultRoute, parseLimits, parseRoutingTable, resol"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/lib/llm-usage.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 4,
          "fragment": "import { costOf, tokensOf, type PriceTable } from '../lib/ll"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 6,
          "fragment": "import { ask, type AskOptions, type LlmResult } from './llm'"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/utils/llm-providers.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 7,
          "fragment": "import { syncProviders } from './llm-providers';"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/utils/llm-jobs-store.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 8,
          "fragment": "import { BOOT_ID, saveJob } from './llm-jobs-store';"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 9,
          "fragment": "import { loadLlmSettings } from './llm-settings';"
        }
      },
      {
        "from": "server/utils/llm-gateway.ts",
        "to": "server/utils/llm-usage-store.ts",
        "evidence": {
          "path": "server/utils/llm-gateway.ts",
          "line": 10,
          "fragment": "import { recordUsage } from './llm-usage-store';"
        }
      },
      {
        "from": "server/utils/llm-http.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-http.ts",
          "line": 1,
          "fragment": "import type { ProviderFailure, ProviderResult } from '../lib"
        }
      },
      {
        "from": "server/utils/llm-jobs-store.ts",
        "to": "server/lib/llm-queue.ts",
        "evidence": {
          "path": "server/utils/llm-jobs-store.ts",
          "line": 4,
          "fragment": "import { markInterrupted, trimJobs, type QueueJob } from '.."
        }
      },
      {
        "from": "server/utils/llm-openai.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-openai.ts",
          "line": 1,
          "fragment": "import type { Provider, ProviderRequest, ProviderResult } fr"
        }
      },
      {
        "from": "server/utils/llm-openai.ts",
        "to": "server/utils/llm-http.ts",
        "evidence": {
          "path": "server/utils/llm-openai.ts",
          "line": 3,
          "fragment": "import { emptyFailure, failureOf, sseData } from './llm-http"
        }
      },
      {
        "from": "server/utils/llm-openai.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/utils/llm-openai.ts",
          "line": 4,
          "fragment": "import { resolveKey, type ProviderSetting } from './llm-sett"
        }
      },
      {
        "from": "server/utils/llm-providers.ts",
        "to": "server/lib/llm-provider.ts",
        "evidence": {
          "path": "server/utils/llm-providers.ts",
          "line": 1,
          "fragment": "import { listProviders, registerProvider, unregisterProvider"
        }
      },
      {
        "from": "server/utils/llm-providers.ts",
        "to": "server/utils/llm-anthropic.ts",
        "evidence": {
          "path": "server/utils/llm-providers.ts",
          "line": 3,
          "fragment": "import { anthropicProvider } from './llm-anthropic';"
        }
      },
      {
        "from": "server/utils/llm-providers.ts",
        "to": "server/utils/llm-claude.ts",
        "evidence": {
          "path": "server/utils/llm-providers.ts",
          "line": 4,
          "fragment": "import { claudeCodeProvider } from './llm-claude';"
        }
      },
      {
        "from": "server/utils/llm-providers.ts",
        "to": "server/utils/llm-openai.ts",
        "evidence": {
          "path": "server/utils/llm-providers.ts",
          "line": 5,
          "fragment": "import { openAiProvider } from './llm-openai';"
        }
      },
      {
        "from": "server/utils/llm-providers.ts",
        "to": "server/utils/llm-agents.ts",
        "evidence": {
          "path": "server/utils/llm-providers.ts",
          "line": 6,
          "fragment": "import { codexProvider, geminiProvider } from './llm-agents'"
        }
      },
      {
        "from": "server/utils/llm-providers.ts",
        "to": "server/utils/llm-settings.ts",
        "evidence": {
          "path": "server/utils/llm-providers.ts",
          "line": 7,
          "fragment": "import { loadLlmSettings } from './llm-settings';"
        }
      },
      {
        "from": "server/utils/llm-usage-store.ts",
        "to": "server/lib/llm-usage.ts",
        "evidence": {
          "path": "server/utils/llm-usage-store.ts",
          "line": 4,
          "fragment": "import { parseLines, toLine, type UsageRecord } from '../lib"
        }
      },
      {
        "from": "server/utils/llm.ts",
        "to": "server/utils/mode.ts",
        "evidence": {
          "path": "server/utils/llm.ts",
          "line": 593,
          "fragment": "import { rootAllowed } from './mode';"
        }
      },
      {
        "from": "server/utils/map-service.ts",
        "to": "server/lib/course.ts",
        "evidence": {
          "path": "server/utils/map-service.ts",
          "line": 2,
          "fragment": "import { approvalOf, courseHistory, type CourseEntry } from "
        }
      },
      {
        "from": "server/utils/memo.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/memo.ts",
          "line": 1,
          "fragment": "import { withBuiltin } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/memo.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/memo.ts",
          "line": 2,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/memo.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/memo.ts",
          "line": 3,
          "fragment": "import { fingerprintOnly, readManifest } from '../lib/worksp"
        }
      },
      {
        "from": "server/utils/memo.ts",
        "to": "server/utils/source-root.ts",
        "evidence": {
          "path": "server/utils/memo.ts",
          "line": 4,
          "fragment": "import { sourceRoot } from './source-root';"
        }
      },
      {
        "from": "server/utils/mode.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/utils/mode.ts",
          "line": 6,
          "fragment": "import { fail } from './http';"
        }
      },
      {
        "from": "server/utils/notification-reader.ts",
        "to": "server/lib/notifications.ts",
        "evidence": {
          "path": "server/utils/notification-reader.ts",
          "line": 3,
          "fragment": "import { EVERYONE } from '../lib/notifications';"
        }
      },
      {
        "from": "server/utils/notification-reader.ts",
        "to": "server/utils/auth.ts",
        "evidence": {
          "path": "server/utils/notification-reader.ts",
          "line": 4,
          "fragment": "import { authEnabled, currentUser } from './auth';"
        }
      },
      {
        "from": "server/utils/notification-service.ts",
        "to": "server/lib/notifications.ts",
        "evidence": {
          "path": "server/utils/notification-service.ts",
          "line": 16,
          "fragment": "} from '../lib/notifications';"
        }
      },
      {
        "from": "server/utils/notify-events.ts",
        "to": "server/lib/notifications.ts",
        "evidence": {
          "path": "server/utils/notify-events.ts",
          "line": 1,
          "fragment": "import type { ZoneCapability } from '../lib/notifications';"
        }
      },
      {
        "from": "server/utils/notify-events.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/notify-events.ts",
          "line": 2,
          "fragment": "import type { ProjectIndex } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/notify-events.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/utils/notify-events.ts",
          "line": 3,
          "fragment": "import { buildProjectMap } from './map-service';"
        }
      },
      {
        "from": "server/utils/notify-events.ts",
        "to": "server/utils/notification-service.ts",
        "evidence": {
          "path": "server/utils/notify-events.ts",
          "line": 4,
          "fragment": "import { notify, notifyZoneViolations } from './notification"
        }
      },
      {
        "from": "server/utils/notify-events.ts",
        "to": "server/lib/reviewer.ts",
        "evidence": {
          "path": "server/utils/notify-events.ts",
          "line": 5,
          "fragment": "import { reviewerOf } from '../lib/reviewer';"
        }
      },
      {
        "from": "server/utils/notify-events.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/notify-events.ts",
          "line": 7,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/onboarding-handlers.ts",
        "to": "server/utils/onboarding-steps.ts",
        "evidence": {
          "path": "server/utils/onboarding-handlers.ts",
          "line": 1,
          "fragment": "import { registerStep } from './onboarding-steps';"
        }
      },
      {
        "from": "server/utils/onboarding-handlers.ts",
        "to": "server/utils/contracts-service.ts",
        "evidence": {
          "path": "server/utils/onboarding-handlers.ts",
          "line": 2,
          "fragment": "import { importContracts, importGlossary, importReferences }"
        }
      },
      {
        "from": "server/utils/onboarding-handlers.ts",
        "to": "server/utils/source-scan.ts",
        "evidence": {
          "path": "server/utils/onboarding-handlers.ts",
          "line": 3,
          "fragment": "import { detectProjectSources } from './source-scan';"
        }
      },
      {
        "from": "server/utils/onboarding-handlers.ts",
        "to": "server/utils/test-checks-service.ts",
        "evidence": {
          "path": "server/utils/onboarding-handlers.ts",
          "line": 4,
          "fragment": "import { createTestChecks, scanTests } from './test-checks-s"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 4,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/glossary.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 5,
          "fragment": "import { parseGlossary } from '../lib/glossary';"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 6,
          "fragment": "import { approvedMaps, parseMapRecord } from '../lib/maps';"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/onboarding.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 7,
          "fragment": "import { EMPTY_STATE, checklist, readiness, type OnboardingS"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 8,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 9,
          "fragment": "import type { WorkRecord } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/onboarding-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/onboarding-service.ts",
          "line": 10,
          "fragment": "import { readWorkspace } from '../lib/workspace';"
        }
      },
      {
        "from": "server/utils/onboarding-steps.ts",
        "to": "server/lib/onboarding.ts",
        "evidence": {
          "path": "server/utils/onboarding-steps.ts",
          "line": 1,
          "fragment": "import { AUTO_STEPS, checklist, type StepId } from '../lib/o"
        }
      },
      {
        "from": "server/utils/onboarding-steps.ts",
        "to": "server/utils/onboarding-service.ts",
        "evidence": {
          "path": "server/utils/onboarding-steps.ts",
          "line": 3,
          "fragment": "import { collectOnboarding } from './onboarding-service';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/actions.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 3,
          "fragment": "import { applyFieldPatch, applyJournalNote } from '../lib/ac"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 4,
          "fragment": "import { dropCache } from '../lib/cache';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 5,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/parse.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 6,
          "fragment": "import { parseRecord } from '../lib/parse';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 7,
          "fragment": "import { withoutJournal } from '../lib/write';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/prompt.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 8,
          "fragment": "import type { PriorityPhase } from '../lib/prompt';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 9,
          "fragment": "import type { IndexRecord, LinkKind } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/lib/work-order.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 10,
          "fragment": "import { membersOf, normalizePlan, rankOf, sortPhases, type "
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/utils/map-service.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 11,
          "fragment": "import { buildProjectMap } from './map-service';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 12,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/priority-service.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/utils/priority-service.ts",
          "line": 13,
          "fragment": "import { openRecord, today, writeRecord } from './record-wri"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "server/lib/record-diff.ts",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 5,
          "fragment": "import { diffRecordTexts, type RecordDiff } from '../lib/rec"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 6,
          "fragment": "import { parseMapRecord } from '../lib/maps';"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "server/lib/parse.ts",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 7,
          "fragment": "import { parseRecord } from '../lib/parse';"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 8,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "server/utils/git.ts",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 9,
          "fragment": "import { git, isRepository } from './git';"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 10,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/record-write.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "server/utils/record-write.ts",
          "line": 13,
          "fragment": "import { refreshReferenceIndex } from './reference-service';"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 4,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 5,
          "fragment": "import { approvedMaps, foldMaps, parseMapRecord } from '../l"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 6,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/reference.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 7,
          "fragment": "import { buildReferenceIndex, sameIndex } from '../lib/refer"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/rules.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 8,
          "fragment": "import { referenceEntries } from '../lib/rules';"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 9,
          "fragment": "import { DEVELOPMENT_DIR, RETIRED_STATUSES } from '../lib/ty"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 10,
          "fragment": "import { withBuiltin } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 11,
          "fragment": "import { readWorkspace, sourceReader } from '../lib/workspac"
        }
      },
      {
        "from": "server/utils/reference-service.ts",
        "to": "server/utils/rules-service.ts",
        "evidence": {
          "path": "server/utils/reference-service.ts",
          "line": 12,
          "fragment": "import { generalReferenceEntries } from './rules-service';"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 1,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 2,
          "fragment": "import { withBuiltin } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 3,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/practice-rules.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 4,
          "fragment": "import { resolveRules, type RuleRecord, type RulesResolution"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/reference.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 5,
          "fragment": "import type { ReferenceEntry } from '../lib/reference';"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 6,
          "fragment": "import type { SharedSource } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 7,
          "fragment": "import { readManifest, readWorkspace } from '../lib/workspac"
        }
      },
      {
        "from": "server/utils/rules-service.ts",
        "to": "server/utils/source-root.ts",
        "evidence": {
          "path": "server/utils/rules-service.ts",
          "line": 8,
          "fragment": "import { sourceRoot } from './source-root';"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 5,
          "fragment": "import { onCacheDropped } from '../lib/cache';"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 6,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/lib/semantic.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 7,
          "fragment": "import { hashEmbed, LOCAL_MODEL, normalize, recordBlocks, sn"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 8,
          "fragment": "import { readWorkspace } from '../lib/workspace';"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/lib/discussion.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 9,
          "fragment": "import { discussionPath, parseDiscussion } from '../lib/disc"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 10,
          "fragment": "import { archivedNotes, inboxNotes } from './inbox-service';"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 11,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/shared-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/shared-service.ts",
          "line": 5,
          "fragment": "import { BUILTIN_SOURCE } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/shared-service.ts",
        "to": "server/utils/source-root.ts",
        "evidence": {
          "path": "server/utils/shared-service.ts",
          "line": 7,
          "fragment": "import { sourceRoot } from './source-root';"
        }
      },
      {
        "from": "server/utils/source-root.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/source-root.ts",
          "line": 3,
          "fragment": "import { BUILTIN_SOURCE } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/source-root.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/source-root.ts",
          "line": 4,
          "fragment": "import { normalizeRoot } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/source-scan.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/source-scan.ts",
          "line": 4,
          "fragment": "import { normalizeRoot, resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/source-scan.ts",
        "to": "server/lib/source-detect.ts",
        "evidence": {
          "path": "server/utils/source-scan.ts",
          "line": 5,
          "fragment": "import { detectSources, mergeSourceList, newFolders, type Fo"
        }
      },
      {
        "from": "server/utils/source-scan.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/source-scan.ts",
          "line": 6,
          "fragment": "import { developmentDir, invalidateWorkspace, MANIFEST_FILE,"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 4,
          "fragment": "import { analyze } from '../lib/analyze';"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/lib/test-checks.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 5,
          "fragment": "import { coverageOf, coveredFiles, findTests, matchTests, pa"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 6,
          "fragment": "import { normalizeRoot, OutsideRootError, resolveInside } fr"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 7,
          "fragment": "import { DEVELOPMENT_DIR } from '../lib/types';"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 8,
          "fragment": "import { invalidateWorkspace, readWorkspace } from '../lib/w"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 9,
          "fragment": "import { dropCache } from '../lib/cache';"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/utils/inbox-service.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 11,
          "fragment": "import { createRecords } from './inbox-service';"
        }
      },
      {
        "from": "server/utils/test-checks-service.ts",
        "to": "server/utils/source-scan.ts",
        "evidence": {
          "path": "server/utils/test-checks-service.ts",
          "line": 12,
          "fragment": "import { listProjectFiles } from './source-scan';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/actions.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 4,
          "fragment": "import { applyJournalNote } from '../lib/actions';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 5,
          "fragment": "import { dropCache } from '../lib/cache';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/manual-report.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 18,
          "fragment": "} from '../lib/manual-report';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 19,
          "fragment": "import { resolveInside } from '../lib/paths';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/metrics.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 20,
          "fragment": "import { passesThreshold, prometheusValue } from '../lib/met"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 21,
          "fragment": "import { invalidateWorkspace } from '../lib/workspace';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 22,
          "fragment": "import { DEVELOPMENT_DIR, type VerificationOutcome } from '."
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 23,
          "fragment": "import { loadIndex } from './index-service';"
        }
      },
      {
        "from": "server/utils/verified-service.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/utils/verified-service.ts",
          "line": 24,
          "fragment": "import { openRecord, today, writeRecord } from './record-wri"
        }
      },
      {
        "from": "server/utils/work-service.ts",
        "to": "server/lib/prompt.ts",
        "evidence": {
          "path": "server/utils/work-service.ts",
          "line": 7,
          "fragment": "import { taskPrompt, type TaskContext } from '../lib/prompt'"
        }
      },
      {
        "from": "server/utils/work-service.ts",
        "to": "server/utils/llm-gateway.ts",
        "evidence": {
          "path": "server/utils/work-service.ts",
          "line": 24,
          "fragment": "import { askRouted } from './llm-gateway';"
        }
      },
      {
        "from": "server/utils/work-service.ts",
        "to": "server/utils/llm.ts",
        "evidence": {
          "path": "server/utils/work-service.ts",
          "line": 25,
          "fragment": "import type { Access } from './llm';"
        }
      },
      {
        "from": "server/utils/work-service.ts",
        "to": "server/lib/builtin.ts",
        "evidence": {
          "path": "server/utils/work-service.ts",
          "line": 30,
          "fragment": "import { withBuiltin } from '../lib/builtin';"
        }
      },
      {
        "from": "server/utils/work-service.ts",
        "to": "server/utils/reference-service.ts",
        "evidence": {
          "path": "server/utils/work-service.ts",
          "line": 31,
          "fragment": "import { referenceIndexText } from './reference-service';"
        }
      },
      {
        "from": "server/utils/work-service.ts",
        "to": "server/lib/auth.ts",
        "evidence": {
          "path": "server/utils/work-service.ts",
          "line": 33,
          "fragment": "import { authorFromSignature } from '../lib/auth';"
        }
      }
    ],
    "groups": [
      {
        "id": "server",
        "title": "Сервер",
        "summary": "Nitro-сервер: API, чистая логика разбора и проверки, служебные утилиты."
      },
      {
        "id": "app",
        "title": "Клиент",
        "summary": "Интерфейс консоли на Nuxt и Vue: экраны, компоненты, переводы, состояние."
      },
      {
        "id": "cli",
        "title": "Командная строка",
        "summary": "Скрипты для проверки проекта, отчётов, замеров и обслуживания сервера."
      },
      {
        "id": "server/api",
        "title": "API",
        "summary": "Маршруты HTTP: тонкий слой над утилитами и чистой логикой.",
        "parent": "server"
      },
      {
        "id": "server/lib",
        "title": "Ядро",
        "summary": "Чистые функции над строками и объектами: разбор, правила, карты, без Nuxt и файловой системы.",
        "parent": "server"
      },
      {
        "id": "server/utils",
        "title": "Серверные утилиты",
        "summary": "Сервисы с файловой системой, git, хранилищем и вызовом моделей.",
        "parent": "server"
      },
      {
        "id": "server~frame",
        "title": "Серверный каркас",
        "summary": "Промежуточные обработчики запросов: вход и права.",
        "parent": "server",
        "capability": "access",
        "modules": [
          "server/middleware/audit.ts",
          "server/middleware/auth.ts"
        ]
      },
      {
        "id": "app/components",
        "title": "Компоненты",
        "summary": "Строительные блоки экранов.",
        "parent": "app"
      },
      {
        "id": "app/pages",
        "title": "Экраны",
        "summary": "Страницы консоли по адресам.",
        "parent": "app"
      },
      {
        "id": "app/i18n",
        "title": "Переводы",
        "summary": "Строки интерфейса на русском и английском.",
        "parent": "app"
      },
      {
        "id": "app~frame",
        "title": "Каркас клиента",
        "summary": "Разметка, плагины, состояние и общие утилиты клиента.",
        "parent": "app"
      },
      {
        "id": "server/api~global",
        "title": "Общие маршруты",
        "summary": "Вход, модели, уведомления, портфель и аудит — не привязаны к проекту.",
        "parent": "server/api",
        "capability": "access",
        "modules": [
          "server/api/audit.get.ts",
          "server/api/auth/login.post.ts",
          "server/api/auth/logout.post.ts",
          "server/api/auth/me.get.ts",
          "server/api/auth/users.get.ts",
          "server/api/auth/users.post.ts",
          "server/api/design.get.ts",
          "server/api/llm/ask.post.ts",
          "server/api/llm/embeddings.get.ts",
          "server/api/llm/embeddings.put.ts",
          "server/api/llm/index.get.ts",
          "server/api/llm/models/check.post.ts",
          "server/api/llm/models/index.get.ts",
          "server/api/llm/models/index.put.ts",
          "server/api/llm/usage.get.ts",
          "server/api/notifications/channel.get.ts",
          "server/api/notifications/channel.put.ts",
          "server/api/portfolio.get.ts"
        ]
      },
      {
        "id": "server/api/projects",
        "title": "Маршруты проекта",
        "summary": "Всё, что делается внутри выбранного проекта.",
        "parent": "server/api"
      },
      {
        "id": "server/api/projects~list",
        "title": "Список проектов",
        "summary": "Добавить, завести формат, убрать проект, git init с согласием.",
        "parent": "server/api/projects",
        "capability": "projects",
        "modules": [
          "server/api/projects/[id].delete.ts",
          "server/api/projects/git-init.post.ts",
          "server/api/projects/git-status.get.ts",
          "server/api/projects/index.get.ts",
          "server/api/projects/index.post.ts",
          "server/api/projects/init.post.ts"
        ]
      },
      {
        "id": "server/api/projects~access",
        "title": "Люди, права и агенты",
        "summary": "Вход, учётки, роли и права, агенты ролей, режим общего сервера.",
        "parent": "server/api/projects",
        "capability": "access",
        "modules": [
          "server/api/projects/[id]/agents/[agentId].delete.ts",
          "server/api/projects/[id]/agents/defaults.post.ts",
          "server/api/projects/[id]/agents/index.get.ts",
          "server/api/projects/[id]/agents/index.post.ts",
          "server/api/projects/[id]/team.get.ts"
        ]
      },
      {
        "id": "server/api/projects~llm",
        "title": "Языковые модели",
        "summary": "Провайдеры, маршруты, очередь и учёт запросов, шаблоны запросов.",
        "parent": "server/api/projects",
        "capability": "llm",
        "modules": [
          "server/api/projects/[id]/analyst.post.ts",
          "server/api/projects/[id]/llm/feeds/[feedId].delete.ts",
          "server/api/projects/[id]/llm/feeds/[feedId].get.ts",
          "server/api/projects/[id]/llm/queue/[jobId].delete.ts",
          "server/api/projects/[id]/llm/queue/[jobId].get.ts",
          "server/api/projects/[id]/llm/queue/index.get.ts",
          "server/api/projects/[id]/progress-question.post.ts",
          "server/api/projects/[id]/prompt/index.post.ts"
        ]
      },
      {
        "id": "server/api/projects~maps",
        "title": "Карты и стратегия",
        "summary": "Стратегическая и рабочие карты: опись, группы, покрытие, вектор, экран стратегии.",
        "parent": "server/api/projects",
        "capability": "maps",
        "modules": [
          "server/api/projects/[id]/architecture.get.ts",
          "server/api/projects/[id]/architecture.post.ts",
          "server/api/projects/[id]/knowledge.get.ts",
          "server/api/projects/[id]/map/behind.get.ts",
          "server/api/projects/[id]/map/capability.post.ts",
          "server/api/projects/[id]/map/coverage.get.ts",
          "server/api/projects/[id]/map/draft.post.ts",
          "server/api/projects/[id]/map/functional-check.post.ts",
          "server/api/projects/[id]/map/functional-relations.post.ts",
          "server/api/projects/[id]/map/index.get.ts",
          "server/api/projects/[id]/map/inventory.get.ts",
          "server/api/projects/[id]/map/inventory/rebuild.post.ts",
          "server/api/projects/[id]/maps/custom/[mapId]/index.delete.ts",
          "server/api/projects/[id]/maps/custom/[mapId]/node.post.ts",
          "server/api/projects/[id]/maps/custom/index.get.ts",
          "server/api/projects/[id]/maps/custom/index.post.ts"
        ]
      },
      {
        "id": "server/api/projects~work",
        "title": "Работа и проверки",
        "summary": "Работа над задачей в ветке, починка, прогоны проверок и ручная приёмка.",
        "parent": "server/api/projects",
        "capability": "work",
        "modules": [
          "server/api/projects/[id]/attachment.get.ts",
          "server/api/projects/[id]/attachments.post.ts",
          "server/api/projects/[id]/batch-check/index.get.ts",
          "server/api/projects/[id]/fix/index.post.ts",
          "server/api/projects/[id]/fix/work/index.get.ts",
          "server/api/projects/[id]/fix/work/index.post.ts",
          "server/api/projects/[id]/runs.post.ts"
        ]
      },
      {
        "id": "server/api/projects~records",
        "title": "Записи",
        "summary": "Чтение и правка записей, статусы, обсуждения, работа над задачей.",
        "parent": "server/api/projects",
        "capability": "records",
        "modules": [
          "server/api/projects/[id]/backlinks/index.get.ts",
          "server/api/projects/[id]/diff-unviewed.get.ts",
          "server/api/projects/[id]/file.get.ts",
          "server/api/projects/[id]/index/index.get.ts",
          "server/api/projects/[id]/issues.get.ts",
          "server/api/projects/[id]/records/[recordId].get.ts",
          "server/api/projects/[id]/records/[recordId].patch.ts",
          "server/api/projects/[id]/records/[recordId]/ask.post.ts",
          "server/api/projects/[id]/records/[recordId]/body.post.ts",
          "server/api/projects/[id]/records/[recordId]/diff/index.get.ts",
          "server/api/projects/[id]/records/[recordId]/diff/viewed.post.ts",
          "server/api/projects/[id]/records/[recordId]/discussion.get.ts",
          "server/api/projects/[id]/records/[recordId]/discussion.post.ts",
          "server/api/projects/[id]/records/[recordId]/map-diff.get.ts",
          "server/api/projects/[id]/records/[recordId]/metric-run.post.ts",
          "server/api/projects/[id]/records/[recordId]/status.post.ts",
          "server/api/projects/[id]/records/[recordId]/target.post.ts",
          "server/api/projects/[id]/records/[recordId]/verified.post.ts",
          "server/api/projects/[id]/records/[recordId]/work/index.get.ts",
          "server/api/projects/[id]/records/[recordId]/work/index.post.ts",
          "server/api/projects/[id]/records/bulk/link-map.post.ts",
          "server/api/projects/[id]/records/bulk/status.post.ts",
          "server/api/projects/[id]/records/index.post.ts",
          "server/api/projects/[id]/rules.get.ts"
        ]
      },
      {
        "id": "server/api/projects~context",
        "title": "Контекст и ленты запросов",
        "summary": "Пакет контекста, поиск, ленты хода работы и разговоры с моделью.",
        "parent": "server/api/projects",
        "capability": "context",
        "modules": [
          "server/api/projects/[id]/context/index.post.ts",
          "server/api/projects/[id]/search.get.ts",
          "server/api/projects/[id]/search/index.post.ts",
          "server/api/projects/[id]/search/semantic.get.ts"
        ]
      },
      {
        "id": "server/api/projects~design",
        "title": "Дизайн-система",
        "summary": "Токены дизайна, выгрузка в стеки, сверка темы и экранов.",
        "parent": "server/api/projects",
        "capability": "design",
        "modules": [
          "server/api/projects/[id]/design/catalog.get.ts",
          "server/api/projects/[id]/design/export.get.ts",
          "server/api/projects/[id]/design/findings/apply.post.ts",
          "server/api/projects/[id]/design/findings/preview.post.ts",
          "server/api/projects/[id]/design/index.get.ts",
          "server/api/projects/[id]/design/port-prompt.post.ts",
          "server/api/projects/[id]/design/record-diff.get.ts",
          "server/api/projects/[id]/design/screens.get.ts"
        ]
      },
      {
        "id": "server/api/projects~inbox",
        "title": "Наполнение и знания",
        "summary": "Входящее, подключение и импорт, источники, справочник, глоссарий, уведомления и обсуждения.",
        "parent": "server/api/projects",
        "capability": "inbox",
        "modules": [
          "server/api/projects/[id]/glossary.get.ts",
          "server/api/projects/[id]/import/index.get.ts",
          "server/api/projects/[id]/import/index.post.ts",
          "server/api/projects/[id]/inbox/accept.post.ts",
          "server/api/projects/[id]/inbox/alert.post.ts",
          "server/api/projects/[id]/inbox/external.post.ts",
          "server/api/projects/[id]/inbox/index.get.ts",
          "server/api/projects/[id]/inbox/notes.post.ts",
          "server/api/projects/[id]/inbox/preview.post.ts",
          "server/api/projects/[id]/inbox/records.post.ts",
          "server/api/projects/[id]/notifications/index.get.ts",
          "server/api/projects/[id]/notifications/read.post.ts",
          "server/api/projects/[id]/onboarding/index.get.ts",
          "server/api/projects/[id]/onboarding/run.post.ts",
          "server/api/projects/[id]/onboarding/tests.get.ts",
          "server/api/projects/[id]/onboarding/tests.post.ts",
          "server/api/projects/[id]/onboarding/wizard.post.ts",
          "server/api/projects/[id]/reference.get.ts",
          "server/api/projects/[id]/reference/rebuild.post.ts",
          "server/api/projects/[id]/shared/index.get.ts",
          "server/api/projects/[id]/shared/index.patch.ts",
          "server/api/projects/[id]/sources/apply.post.ts",
          "server/api/projects/[id]/sources/detect.get.ts"
        ]
      },
      {
        "id": "server/api/projects~pm",
        "title": "Фазы, порядок и сводки",
        "summary": "Фазы, порядок задач, приоритет, доска, дорожная карта и сводки.",
        "parent": "server/api/projects",
        "capability": "pm",
        "modules": [
          "server/api/projects/[id]/metrics.get.ts",
          "server/api/projects/[id]/observability.get.ts",
          "server/api/projects/[id]/phases/index.post.ts",
          "server/api/projects/[id]/phases/preview.post.ts",
          "server/api/projects/[id]/priority/apply.post.ts",
          "server/api/projects/[id]/priority/preview.post.ts"
        ]
      },
      {
        "id": "server/lib~records",
        "title": "Записи, разбор и правила",
        "summary": "Записи процесса: разбор, индекс, переходы статусов, проверки правил и запись файлов.",
        "parent": "server/lib",
        "capability": "records",
        "modules": [
          "server/lib/actions.ts",
          "server/lib/analyze.ts",
          "server/lib/builtin.ts",
          "server/lib/cache.ts",
          "server/lib/criteria.ts",
          "server/lib/glob.ts",
          "server/lib/ignore.ts",
          "server/lib/indexer.ts",
          "server/lib/issues-diff.ts",
          "server/lib/manifest-write.ts",
          "server/lib/parse.ts",
          "server/lib/paths.ts",
          "server/lib/record-diff.ts",
          "server/lib/reports.ts",
          "server/lib/reviewer.ts",
          "server/lib/rules.ts",
          "server/lib/schema-digest.ts",
          "server/lib/schema.ts",
          "server/lib/transitions.ts",
          "server/lib/types.ts",
          "server/lib/version.ts",
          "server/lib/write.ts"
        ]
      },
      {
        "id": "server/lib~access",
        "title": "Люди, права и агенты",
        "summary": "Вход, учётки, роли и права, агенты ролей, режим общего сервера.",
        "parent": "server/lib",
        "capability": "access",
        "modules": [
          "server/lib/agent-run.ts",
          "server/lib/agents.ts",
          "server/lib/auth.ts",
          "server/lib/permissions.ts"
        ]
      },
      {
        "id": "server/lib~llm",
        "title": "Языковые модели",
        "summary": "Провайдеры, маршруты, очередь и учёт запросов, шаблоны запросов.",
        "parent": "server/lib",
        "capability": "llm",
        "modules": [
          "server/lib/analyst.ts",
          "server/lib/llm-provider.ts",
          "server/lib/llm-queue.ts",
          "server/lib/llm-routing.ts",
          "server/lib/llm-usage.ts",
          "server/lib/prompt.ts",
          "server/lib/semantic.ts"
        ]
      },
      {
        "id": "server/lib~maps",
        "title": "Карты и стратегия",
        "summary": "Стратегическая и рабочие карты: опись, группы, покрытие, вектор, экран стратегии.",
        "parent": "server/lib",
        "capability": "maps",
        "modules": [
          "server/lib/architecture-capabilities.ts",
          "server/lib/architecture.ts",
          "server/lib/course.ts",
          "server/lib/coverage.ts",
          "server/lib/custom-maps.ts",
          "server/lib/diagrams.ts",
          "server/lib/flow-groups.ts",
          "server/lib/functional.ts",
          "server/lib/graph.ts",
          "server/lib/groups.ts",
          "server/lib/hierarchy.ts",
          "server/lib/intent-map.ts",
          "server/lib/inventory.ts",
          "server/lib/knowledge.ts",
          "server/lib/layers.ts",
          "server/lib/map-diff.ts",
          "server/lib/map-schemas.ts",
          "server/lib/maps.ts",
          "server/lib/role-maps.ts",
          "server/lib/strategy.ts"
        ]
      },
      {
        "id": "server/lib~work",
        "title": "Работа и проверки",
        "summary": "Работа над задачей в ветке, починка, прогоны проверок и ручная приёмка.",
        "parent": "server/lib",
        "capability": "work",
        "modules": [
          "server/lib/attachments.ts",
          "server/lib/batch-check.ts",
          "server/lib/branch.ts",
          "server/lib/fix-diff.ts",
          "server/lib/manual-report.ts",
          "server/lib/test-checks.ts",
          "server/lib/verify-desk.ts",
          "server/lib/work-order.ts",
          "server/lib/workspace.ts"
        ]
      },
      {
        "id": "server/lib~context",
        "title": "Контекст и ленты запросов",
        "summary": "Пакет контекста, поиск, ленты хода работы и разговоры с моделью.",
        "parent": "server/lib",
        "capability": "context",
        "modules": [
          "server/lib/context-pack.ts",
          "server/lib/job-feed.ts",
          "server/lib/search.ts",
          "server/lib/stream-events.ts"
        ]
      },
      {
        "id": "server/lib~inbox",
        "title": "Наполнение и знания",
        "summary": "Входящее, подключение и импорт, источники, справочник, глоссарий, уведомления и обсуждения.",
        "parent": "server/lib",
        "capability": "inbox",
        "modules": [
          "server/lib/contract-digest.ts",
          "server/lib/contracts-import.ts",
          "server/lib/discussion.ts",
          "server/lib/external-import.ts",
          "server/lib/glossary.ts",
          "server/lib/import.ts",
          "server/lib/inbox.ts",
          "server/lib/new-project.ts",
          "server/lib/notifications.ts",
          "server/lib/onboarding.ts",
          "server/lib/practice-rules.ts",
          "server/lib/project-templates.ts",
          "server/lib/reference.ts",
          "server/lib/scaffold.ts",
          "server/lib/shared.ts",
          "server/lib/source-detect.ts"
        ]
      },
      {
        "id": "server/lib~design",
        "title": "Дизайн-система",
        "summary": "Токены дизайна, выгрузка в стеки, сверка темы и экранов.",
        "parent": "server/lib",
        "capability": "design",
        "modules": [
          "server/lib/design-catalog.ts",
          "server/lib/design-constructors.ts",
          "server/lib/design-contract.ts",
          "server/lib/design-diff.ts",
          "server/lib/design-export.ts",
          "server/lib/design-figma.ts",
          "server/lib/design-port.ts",
          "server/lib/design-screens.ts",
          "server/lib/design-surface.ts",
          "server/lib/design-theme.ts",
          "server/lib/design.ts"
        ]
      },
      {
        "id": "server/lib~pm",
        "title": "Фазы, порядок и сводки",
        "summary": "Фазы, порядок задач, приоритет, доска, дорожная карта и сводки.",
        "parent": "server/lib",
        "capability": "pm",
        "modules": [
          "server/lib/manager.ts",
          "server/lib/metrics.ts",
          "server/lib/order-diff.ts",
          "server/lib/overview.ts",
          "server/lib/phase-plan.ts",
          "server/lib/portfolio.ts",
          "server/lib/task-order.ts"
        ]
      },
      {
        "id": "server/utils~context",
        "title": "Контекст и ленты запросов",
        "summary": "Пакет контекста, поиск, ленты хода работы и разговоры с моделью.",
        "parent": "server/utils",
        "capability": "context",
        "modules": [
          "server/utils/abort.ts",
          "server/utils/context-service.ts",
          "server/utils/job-feeds.ts",
          "server/utils/sessions.ts",
          "server/utils/sse.ts"
        ]
      },
      {
        "id": "server/utils~access",
        "title": "Люди, права и агенты",
        "summary": "Вход, учётки, роли и права, агенты ролей, режим общего сервера.",
        "parent": "server/utils",
        "capability": "access",
        "modules": [
          "server/utils/agent-run-service.ts",
          "server/utils/agents-service.ts",
          "server/utils/auth.ts",
          "server/utils/llm-agents.ts",
          "server/utils/mode.ts"
        ]
      },
      {
        "id": "server/utils~maps",
        "title": "Карты и стратегия",
        "summary": "Стратегическая и рабочие карты: опись, группы, покрытие, вектор, экран стратегии.",
        "parent": "server/utils",
        "capability": "maps",
        "modules": [
          "server/utils/architecture-service.ts",
          "server/utils/intent-map-service.ts",
          "server/utils/inventory-service.ts",
          "server/utils/map-service.ts"
        ]
      },
      {
        "id": "server/utils~records",
        "title": "Записи, разбор и правила",
        "summary": "Записи процесса: разбор, индекс, переходы статусов, проверки правил и запись файлов.",
        "parent": "server/utils",
        "capability": "records",
        "modules": [
          "server/utils/bulk-service.ts",
          "server/utils/chosen.ts",
          "server/utils/http.ts",
          "server/utils/index-service.ts",
          "server/utils/memo.ts",
          "server/utils/projects.ts",
          "server/utils/record-diff-service.ts",
          "server/utils/record-write.ts",
          "server/utils/rules-service.ts"
        ]
      },
      {
        "id": "server/utils~inbox",
        "title": "Наполнение и знания",
        "summary": "Входящее, подключение и импорт, источники, справочник, глоссарий, уведомления и обсуждения.",
        "parent": "server/utils",
        "capability": "inbox",
        "modules": [
          "server/utils/contracts-service.ts",
          "server/utils/inbox-service.ts",
          "server/utils/notification-reader.ts",
          "server/utils/notification-service.ts",
          "server/utils/notify-events.ts",
          "server/utils/onboarding-handlers.ts",
          "server/utils/onboarding-service.ts",
          "server/utils/onboarding-steps.ts",
          "server/utils/reference-service.ts",
          "server/utils/shared-service.ts",
          "server/utils/source-root.ts",
          "server/utils/source-scan.ts"
        ]
      },
      {
        "id": "server/utils~design",
        "title": "Дизайн-система",
        "summary": "Токены дизайна, выгрузка в стеки, сверка темы и экранов.",
        "parent": "server/utils",
        "capability": "design",
        "modules": [
          "server/utils/design-catalog-service.ts",
          "server/utils/design-diff-service.ts",
          "server/utils/design-screens-service.ts",
          "server/utils/design-service.ts"
        ]
      },
      {
        "id": "server/utils~work",
        "title": "Работа и проверки",
        "summary": "Работа над задачей в ветке, починка, прогоны проверок и ручная приёмка.",
        "parent": "server/utils",
        "capability": "work",
        "modules": [
          "server/utils/fix-service.ts",
          "server/utils/git.ts",
          "server/utils/test-checks-service.ts",
          "server/utils/verified-service.ts",
          "server/utils/work-service.ts"
        ]
      },
      {
        "id": "server/utils~llm",
        "title": "Языковые модели",
        "summary": "Провайдеры, маршруты, очередь и учёт запросов, шаблоны запросов.",
        "parent": "server/utils",
        "capability": "llm",
        "modules": [
          "server/utils/llm-anthropic.ts",
          "server/utils/llm-claude.ts",
          "server/utils/llm-gateway.ts",
          "server/utils/llm-http.ts",
          "server/utils/llm-jobs-store.ts",
          "server/utils/llm-openai.ts",
          "server/utils/llm-providers.ts",
          "server/utils/llm-settings.ts",
          "server/utils/llm-usage-store.ts",
          "server/utils/llm.ts",
          "server/utils/semantic-service.ts"
        ]
      },
      {
        "id": "server/utils~pm",
        "title": "Фазы, порядок и сводки",
        "summary": "Фазы, порядок задач, приоритет, доска, дорожная карта и сводки.",
        "parent": "server/utils",
        "capability": "pm",
        "modules": [
          "server/utils/priority-service.ts"
        ]
      },
      {
        "id": "cli~ops",
        "title": "Обслуживание",
        "summary": "Учётки, запуск собранного приложения, служебные расчёты.",
        "parent": "cli",
        "modules": [
          "cli/add-user.ts",
          "cli/embeddings.ts",
          "cli/start-built.ts",
          "cli/synth.ts"
        ]
      },
      {
        "id": "cli~process",
        "title": "Проверка и отчёты",
        "summary": "Проверка проекта, отчёты, замеры размера контекста и скорости.",
        "parent": "cli",
        "modules": [
          "cli/check.ts",
          "cli/context-size.ts",
          "cli/perf.ts",
          "cli/report.ts"
        ]
      },
      {
        "id": "app~frame~style",
        "title": "Вид",
        "summary": "Стили, токены дизайна и темы компонентов.",
        "parent": "app~frame",
        "capability": "design",
        "modules": [
          "app/app.config.ts",
          "app/assets/css/main.css",
          "app/design-tokens.ts"
        ]
      },
      {
        "id": "app~frame~shell",
        "title": "Оболочка",
        "summary": "Корень приложения, разметка, плагины и промежуточные обработчики.",
        "parent": "app~frame",
        "modules": [
          "app/app.vue",
          "app/layouts/default.vue",
          "app/middleware/auth.global.ts",
          "app/plugins/can.ts",
          "app/plugins/i18n.ts",
          "app/plugins/model-jobs.client.ts"
        ]
      },
      {
        "id": "app/components~access",
        "title": "Люди, права и агенты",
        "summary": "Вход, учётки, роли и права, агенты ролей, режим общего сервера.",
        "parent": "app/components",
        "capability": "access",
        "modules": [
          "app/components/AgentsPanel.vue",
          "app/components/ArchitectureAudit.vue",
          "app/components/ModelJobsBar.vue",
          "app/components/ModelLog.vue",
          "app/components/ModelProgress.vue",
          "app/components/TeamCard.vue"
        ]
      },
      {
        "id": "app/components~maps",
        "title": "Карты и стратегия",
        "summary": "Стратегическая и рабочие карты: опись, группы, покрытие, вектор, экран стратегии.",
        "parent": "app/components",
        "capability": "maps",
        "modules": [
          "app/components/ArchitectureNote.vue",
          "app/components/BehindMarks.vue",
          "app/components/CourseHistory.vue",
          "app/components/CustomMapForm.vue",
          "app/components/CustomMapView.vue",
          "app/components/FunctionalCheck.vue",
          "app/components/FunctionalGraphBar.vue",
          "app/components/FunctionalLegendBar.vue",
          "app/components/FunctionalNext.vue",
          "app/components/FunctionalRelations.vue",
          "app/components/FunctionalSummary.vue",
          "app/components/FunctionalTree.vue",
          "app/components/FunctionalTreeNode.vue",
          "app/components/GraphPanel.vue",
          "app/components/ManagerRoadmap.vue",
          "app/components/MapBatchDescribe.vue",
          "app/components/MapDepthBar.vue",
          "app/components/MapDiff.vue",
          "app/components/MapInspector.vue",
          "app/components/MapInventory.vue",
          "app/components/MapLegendBar.vue",
          "app/components/MapRecordsCard.vue",
          "app/components/MapSplitHints.vue",
          "app/components/MermaidDiagram.vue",
          "app/components/MermaidDiagram3D.vue",
          "app/components/StrategyIntent.vue",
          "app/components/VisionCard.vue"
        ]
      },
      {
        "id": "app/components~inbox",
        "title": "Наполнение и знания",
        "summary": "Входящее, подключение и импорт, источники, справочник, глоссарий, уведомления и обсуждения.",
        "parent": "app/components",
        "capability": "inbox",
        "modules": [
          "app/components/AsIsPanel.vue",
          "app/components/ExternalImportPanel.vue",
          "app/components/ImportPanel.vue",
          "app/components/InboxPanel.vue",
          "app/components/NewProjectWizard.vue",
          "app/components/NotificationsBell.vue",
          "app/components/OnboardingChecklist.vue",
          "app/components/OnboardingTour.vue",
          "app/components/PracticeRules.vue",
          "app/components/RecordDiscussion.vue",
          "app/components/SourcesFinder.vue"
        ]
      },
      {
        "id": "app/components~records",
        "title": "Записи, разбор и правила",
        "summary": "Записи процесса: разбор, индекс, переходы статусов, проверки правил и запись файлов.",
        "parent": "app/components",
        "capability": "records",
        "modules": [
          "app/components/AutoHeight.vue",
          "app/components/BodyEditor.vue",
          "app/components/BulkBar.vue",
          "app/components/DiffUnviewed.vue",
          "app/components/DocumentText.vue",
          "app/components/IssueList.vue",
          "app/components/IssuesPanel.vue",
          "app/components/LightBadge.vue",
          "app/components/NewRecord.vue",
          "app/components/ProjectFailure.vue",
          "app/components/RecordActions.vue",
          "app/components/RecordCriteria.vue",
          "app/components/RecordDiff.vue",
          "app/components/RecordLink.vue",
          "app/components/SettingsDialog.vue",
          "app/components/StatusBadge.vue",
          "app/components/StatusTabs.vue",
          "app/components/TaskAssignee.vue",
          "app/components/TaskRequirement.vue",
          "app/components/TaskReuse.vue",
          "app/components/TaskReviewer.vue",
          "app/components/TasksPanel.vue"
        ]
      },
      {
        "id": "app/components~work",
        "title": "Работа и проверки",
        "summary": "Работа над задачей в ветке, починка, прогоны проверок и ручная приёмка.",
        "parent": "app/components",
        "capability": "work",
        "modules": [
          "app/components/ChecksPanel.vue",
          "app/components/DefectFromCheck.vue",
          "app/components/FixWork.vue",
          "app/components/GitGate.vue",
          "app/components/ManualAcceptModal.vue",
          "app/components/ResultsPanel.vue",
          "app/components/RunPanel.vue",
          "app/components/TaskWork.vue",
          "app/components/TestChecksPanel.vue",
          "app/components/VerificationCard.vue",
          "app/components/VerifiedCheck.vue"
        ]
      },
      {
        "id": "app/components~context",
        "title": "Контекст и ленты запросов",
        "summary": "Пакет контекста, поиск, ленты хода работы и разговоры с моделью.",
        "parent": "app/components",
        "capability": "context",
        "modules": [
          "app/components/ContextPreview.vue",
          "app/components/GlobalSearch.vue"
        ]
      },
      {
        "id": "app/components~design",
        "title": "Дизайн-система",
        "summary": "Токены дизайна, выгрузка в стеки, сверка темы и экранов.",
        "parent": "app/components",
        "capability": "design",
        "modules": [
          "app/components/DesignComponents.vue",
          "app/components/DesignConstructors.vue",
          "app/components/DesignDiff.vue",
          "app/components/DesignFigma.vue",
          "app/components/DesignScreens.vue",
          "app/components/DesignStacks.vue",
          "app/components/DesignThemeBuilder.vue",
          "app/components/DesignTokens.vue"
        ]
      },
      {
        "id": "app/components~pm",
        "title": "Фазы, порядок и сводки",
        "summary": "Фазы, порядок задач, приоритет, доска, дорожная карта и сводки.",
        "parent": "app/components",
        "capability": "pm",
        "modules": [
          "app/components/ManagerAssistant.vue",
          "app/components/ManagerBoard.vue",
          "app/components/ManagerSummary.vue",
          "app/components/OrderDiff.vue",
          "app/components/OverallProgress.vue",
          "app/components/PhasePlan.vue",
          "app/components/PhasePlanner.vue",
          "app/components/PhasesPanel.vue",
          "app/components/PriorityPreview.vue",
          "app/components/ProjectDashboard.vue"
        ]
      },
      {
        "id": "app/components~llm",
        "title": "Языковые модели",
        "summary": "Провайдеры, маршруты, очередь и учёт запросов, шаблоны запросов.",
        "parent": "app/components",
        "capability": "llm",
        "modules": [
          "app/components/PromptPanel.vue",
          "app/components/RecordAsk.vue",
          "app/components/ReviewBatchPrompt.vue"
        ]
      },
      {
        "id": "app~frame~state",
        "title": "Состояние и запросы",
        "summary": "Композиции и хранилища: данные проекта, задания модели, права.",
        "parent": "app~frame",
        "modules": [
          "app/composables/useMe.ts",
          "app/composables/useModelRequest.ts",
          "app/composables/useOrderMode.ts",
          "app/composables/useProjectIndex.ts",
          "app/composables/useSelection.ts",
          "app/composables/useStatusFilter.ts",
          "app/composables/useT.ts",
          "app/composables/useTaskReviewers.ts",
          "app/stores/modelJobs.ts"
        ]
      },
      {
        "id": "app/i18n~en",
        "title": "Английский",
        "summary": "Строки интерфейса: английский.",
        "parent": "app/i18n",
        "modules": [
          "app/i18n/en/agents.ts",
          "app/i18n/en/components.ts",
          "app/i18n/en/design.ts",
          "app/i18n/en/manager.ts",
          "app/i18n/en/nav.ts",
          "app/i18n/en/notifications.ts",
          "app/i18n/en/onboarding.ts",
          "app/i18n/en/overview.ts",
          "app/i18n/en/pages.ts",
          "app/i18n/en/pages2.ts",
          "app/i18n/en/records.ts",
          "app/i18n/en/rest.ts",
          "app/i18n/en/screens.ts",
          "app/i18n/en/search.ts",
          "app/i18n/en/settings.ts",
          "app/i18n/en/shell.ts",
          "app/i18n/en/strategy.ts",
          "app/i18n/en/ui-inbox.ts",
          "app/i18n/en/ui-last.ts",
          "app/i18n/en/ui-maps.ts",
          "app/i18n/en/ui-mermaid.ts",
          "app/i18n/en/ui-rest.ts",
          "app/i18n/en/ui-utils.ts",
          "app/i18n/en/verify.ts"
        ]
      },
      {
        "id": "app/i18n~core",
        "title": "Механика переводов",
        "summary": "Выбор языка и подстановка строк.",
        "parent": "app/i18n",
        "modules": [
          "app/i18n/index.ts",
          "app/i18n/tr.ts"
        ]
      },
      {
        "id": "app/i18n~ru",
        "title": "Русский",
        "summary": "Строки интерфейса: русский.",
        "parent": "app/i18n",
        "modules": [
          "app/i18n/ru/agents.ts",
          "app/i18n/ru/components.ts",
          "app/i18n/ru/design.ts",
          "app/i18n/ru/manager.ts",
          "app/i18n/ru/nav.ts",
          "app/i18n/ru/notifications.ts",
          "app/i18n/ru/onboarding.ts",
          "app/i18n/ru/overview.ts",
          "app/i18n/ru/pages.ts",
          "app/i18n/ru/pages2.ts",
          "app/i18n/ru/records.ts",
          "app/i18n/ru/rest.ts",
          "app/i18n/ru/screens.ts",
          "app/i18n/ru/search.ts",
          "app/i18n/ru/settings.ts",
          "app/i18n/ru/shell.ts",
          "app/i18n/ru/strategy.ts",
          "app/i18n/ru/ui-inbox.ts",
          "app/i18n/ru/ui-last.ts",
          "app/i18n/ru/ui-maps.ts",
          "app/i18n/ru/ui-mermaid.ts",
          "app/i18n/ru/ui-rest.ts",
          "app/i18n/ru/ui-utils.ts",
          "app/i18n/ru/verify.ts"
        ]
      },
      {
        "id": "app/pages~global",
        "title": "Общие экраны",
        "summary": "Список проектов, вход, люди, дизайн между проектами.",
        "parent": "app/pages",
        "capability": "projects",
        "modules": [
          "app/pages/audit.vue",
          "app/pages/design.vue",
          "app/pages/index.vue",
          "app/pages/login.vue",
          "app/pages/models.vue",
          "app/pages/notifications.vue",
          "app/pages/people.vue",
          "app/pages/portfolio.vue",
          "app/pages/usage.vue"
        ]
      },
      {
        "id": "app/pages~project",
        "title": "Экраны проекта",
        "summary": "Обзор, стратегия, карты, документы, работа, сверка и наполнение проекта.",
        "parent": "app/pages",
        "capability": "projects",
        "modules": [
          "app/pages/projects/[id]/analyst.vue",
          "app/pages/projects/[id]/checks.vue",
          "app/pages/projects/[id]/design.vue",
          "app/pages/projects/[id]/documents.vue",
          "app/pages/projects/[id]/file.vue",
          "app/pages/projects/[id]/fill.vue",
          "app/pages/projects/[id]/glossary.vue",
          "app/pages/projects/[id]/graph.vue",
          "app/pages/projects/[id]/import.vue",
          "app/pages/projects/[id]/inbox.vue",
          "app/pages/projects/[id]/index.vue",
          "app/pages/projects/[id]/issues.vue",
          "app/pages/projects/[id]/knowledge.vue",
          "app/pages/projects/[id]/manager.vue",
          "app/pages/projects/[id]/maps.vue",
          "app/pages/projects/[id]/phases.vue",
          "app/pages/projects/[id]/records/[recordId].vue",
          "app/pages/projects/[id]/reference.vue",
          "app/pages/projects/[id]/releases.vue",
          "app/pages/projects/[id]/requirements.vue",
          "app/pages/projects/[id]/results.vue",
          "app/pages/projects/[id]/search.vue",
          "app/pages/projects/[id]/shared.vue",
          "app/pages/projects/[id]/strategy.vue",
          "app/pages/projects/[id]/tasks.vue",
          "app/pages/projects/[id]/verify.vue",
          "app/pages/projects/[id]/work.vue"
        ]
      },
      {
        "id": "app~frame~utils",
        "title": "Утилиты клиента",
        "summary": "Чистые помощники экранов: подписи, роли, диаграммы.",
        "parent": "app~frame",
        "modules": [
          "app/utils/batch-describe.ts",
          "app/utils/duration.ts",
          "app/utils/event-stream.ts",
          "app/utils/facts.ts",
          "app/utils/functional-view.ts",
          "app/utils/graph-layout.ts",
          "app/utils/highlight.ts",
          "app/utils/labels.ts",
          "app/utils/map-mermaid.ts",
          "app/utils/nav-roles.ts",
          "app/utils/phases.ts"
        ]
      }
    ]
  }
}
```

```docdd-dataflow
{
  "added": {
    "sources": [
      {
        "id": "project",
        "kind": "file",
        "where": "корень выбранного проекта",
        "title": "Проект"
      },
      {
        "id": "docdd-dir",
        "kind": "file",
        "where": ".docdd/ в корне проекта",
        "title": "Служебная папка консоли в проекте",
        "parent": "project"
      },
      {
        "id": "server-data",
        "kind": "file",
        "where": ".data/ рядом с сервером",
        "title": "Данные сервера консоли"
      },
      {
        "id": "project-files",
        "kind": "file",
        "where": "docs/development выбранного проекта",
        "title": "Файлы проекта",
        "parent": "project"
      },
      {
        "id": "git-repo",
        "kind": "file",
        "where": "ветки и рабочие деревья проекта",
        "title": "Репозиторий проекта",
        "parent": "project"
      },
      {
        "id": "index-cache",
        "kind": "file",
        "where": ".docdd/index.json",
        "title": "Кэш индекса",
        "parent": "docdd-dir"
      },
      {
        "id": "maps-index",
        "kind": "file",
        "where": ".docdd/maps-index.json",
        "title": "Опись описанных файлов",
        "parent": "docdd-dir"
      },
      {
        "id": "session-memory",
        "kind": "file",
        "where": ".docdd/sessions.json",
        "title": "Память о разговорах",
        "parent": "docdd-dir"
      },
      {
        "id": "embeddings",
        "kind": "file",
        "where": ".docdd/embeddings.jsonl",
        "title": "Векторы для поиска по смыслу",
        "parent": "docdd-dir"
      },
      {
        "id": "projects-list",
        "kind": "file",
        "where": ".data/projects.json",
        "title": "Список проектов",
        "parent": "server-data"
      },
      {
        "id": "accounts",
        "kind": "file",
        "where": ".data/users.json",
        "title": "Учётки людей и агентов",
        "parent": "server-data"
      },
      {
        "id": "session-secret",
        "kind": "file",
        "where": ".data/session-secret.json",
        "title": "Ключ подписи сессий и токенов агентов",
        "parent": "server-data"
      },
      {
        "id": "llm-settings",
        "kind": "file",
        "where": ".data/llm.json",
        "title": "Настройки моделей: провайдеры, маршруты, цены, лимиты",
        "parent": "server-data"
      },
      {
        "id": "llm-usage",
        "kind": "file",
        "where": ".data/llm-usage.jsonl",
        "title": "Учёт запросов к моделям",
        "parent": "server-data"
      },
      {
        "id": "notifications",
        "kind": "file",
        "where": ".data/ (уведомления по проектам)",
        "title": "Уведомления",
        "parent": "server-data"
      },
      {
        "id": "diff-viewed",
        "kind": "file",
        "where": ".data/diff-viewed.json",
        "title": "Просмотренные разницы записей",
        "parent": "server-data"
      }
    ],
    "flows": [
      {
        "from": "server/utils/auth.ts",
        "to": "accounts",
        "direction": "both",
        "evidence": {
          "path": "server/utils/auth.ts",
          "line": 28,
          "fragment": "await storage().setItem('users.json', users);"
        }
      },
      {
        "from": "server/utils/auth.ts",
        "to": "session-secret",
        "direction": "both",
        "evidence": {
          "path": "server/utils/auth.ts",
          "line": 36,
          "fragment": "await storage().setItem('session-secret.json', created);"
        }
      },
      {
        "from": "server/utils/llm-settings.ts",
        "to": "llm-settings",
        "direction": "both",
        "evidence": {
          "path": "server/utils/llm-settings.ts",
          "line": 33,
          "fragment": "const FILE = 'llm.json';"
        }
      },
      {
        "from": "server/utils/llm-usage-store.ts",
        "to": "llm-usage",
        "direction": "both",
        "evidence": {
          "path": "server/utils/llm-usage-store.ts",
          "line": 7,
          "fragment": "export const USAGE_FILE = resolve(process.cwd(), '.data', 'l"
        }
      },
      {
        "from": "server/utils/notification-service.ts",
        "to": "notifications",
        "direction": "both",
        "evidence": {
          "path": "server/utils/notification-service.ts",
          "line": 36,
          "fragment": "const CONFIG_KEY = 'notifications.json';"
        }
      },
      {
        "from": "server/utils/record-diff-service.ts",
        "to": "diff-viewed",
        "direction": "both",
        "evidence": {
          "path": "server/utils/record-diff-service.ts",
          "line": 18,
          "fragment": "const VIEWED_FILE = 'diff-viewed.json';"
        }
      },
      {
        "from": "server/utils/semantic-service.ts",
        "to": "embeddings",
        "direction": "both",
        "evidence": {
          "path": "server/utils/semantic-service.ts",
          "line": 24,
          "fragment": "const fileOf = (root: string) => join(normalizeRoot(root), '"
        }
      }
    ]
  }
}
```

```docdd-userflow
{}
```

## Журнал

- 2026-10-24 · заведена черновиком · модель
- 2026-10-24 · на подтверждение · architect
- 2026-10-24 · подтверждён · architect

## Журнал

- 2026-10-24 · заведена черновиком · модель
