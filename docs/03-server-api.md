# Внутренний API

Граница между интерфейсом и файловой системой. Браузер не знает о путях и
файлах — он видит только эти маршруты. Контракт пишется до кода: маршрут
появляется здесь, потом в `server/api`.

Все ответы — JSON. Ошибки — единым видом:

```json
{
  "error": {
    "code": "project_not_found",
    "message": "В указанной папке нет docs/development/project.yaml",
    "detail": "D:/work/fishForecast"
  }
}
```

| Код HTTP | Когда |
|---|---|
| `400` | Неверные параметры запроса |
| `403` | Путь за пределами корня проекта |
| `404` | Проект или запись не найдены |
| `409` | Переход статуса запрещён правилами процесса |
| `422` | Файл не проходит проверку схемы |
| `500` | Сбой чтения или записи |

## Проекты

### `GET /api/projects`

Список проектов, добавленных пользователем.

```json
[{ "id": "fishforecast", "name": "FishForecast", "root": "D:/work/fishForecast", "lastOpenedAt": "2026-08-30T10:00:00Z" }]
```

### `POST /api/projects`

```json
{ "root": "D:/work/fishForecast" }
```

Проверяет, что по пути есть `docs/development/project.yaml`, читает манифест,
запоминает проект. Нет манифеста — `404` с кодом `project_not_found` и
предложением создать формат (см. [06-phases.md](06-phases.md), фаза 5).

### `DELETE /api/projects/:id`

Убирает проект из списка. Файлы не трогает.

## Индекс

### `GET /api/projects/:id/index`

Главный маршрут: всё состояние проекта одним ответом.

```json
{
  "project": { "id": "fishforecast", "name": "FishForecast", "contract": "docdd.workspace/1" },
  "builtAt": "2026-08-30T10:00:00Z",
  "records": [
    {
      "id": "T-0001",
      "type": "task",
      "title": "Вынести веса модели клёва в документ знаний",
      "status": "ready",
      "owner": "dev",
      "created": "2026-08-30",
      "updated": "2026-08-30",
      "tags": ["client"],
      "path": "docs/development/tasks/T-0001-bite-model-document.md",
      "links": { "implements": ["R-0001"], "verified_by": ["V-0001"] },
      "backlinks": { "verifies": ["V-0001"] },
      "extra": {}
    }
  ],
  "verificationResults": { "V-0001": { "state": "passed", "at": "2026-08-30T10:00:00Z" } },
  "issues": [
    { "severity": "error", "code": "task_not_ready_docs", "recordId": "T-0002", "message": "Документ D-0004 не подтверждён" }
  ]
}
```

`extra` несёт незнакомые поля front matter: приложение их не понимает, но обязано
вернуть и сохранить.

Параметр `?refresh=1` пересобирает индекс, игнорируя кэш.

### `GET /api/projects/:id/records/:recordId`

Одна запись целиком: front matter, тело в исходном markdown, разобранные
диаграммы, входящие и исходящие связи, результаты проверок.

## Изменения

### `POST /api/projects/:id/records/:recordId/status`

```json
{ "status": "in_progress", "actor": "architect", "comment": "" }
```

Проверяет переход по правилам процесса. Разрешён — меняет `status`, обновляет
`updated`, добавляет строку в журнал, возвращает обновлённую запись. Запрещён —
`409` с кодом причины и перечнем того, что мешает:

```json
{
  "error": {
    "code": "transition_forbidden",
    "message": "Задача не может уйти в разработку из статуса backlog",
    "blockers": [{ "code": "task_no_requirement", "message": "Нет связи implements" }]
  }
}
```

### `PATCH /api/projects/:id/records/:recordId`

Правка полей front matter: `owner`, `phase`, `tags`, `links`. Тело документа не
принимается вовсе — этого маршрута для него нет намеренно.

### `POST /api/projects/:id/records`

Создание записи из шаблона:

```json
{ "type": "task", "title": "Вынести веса модели клёва", "links": { "implements": ["R-0001"] } }
```

Сервер выдаёт следующий свободный идентификатор, собирает имя файла из слага,
пишет файл и возвращает запись. Занятый идентификатор — `409`.

## Файлы проекта

### `GET /api/projects/:id/file?path=app/src/...`

Отдаёт содержимое файла кода для показа по ссылке из документа. Только чтение,
только внутри корня проекта, только текстовые файлы до заданного размера.

## Чего в API нет

- Записи тела документа.
- Удаления файлов.
- Запуска команд, сборок и агентов.
- Обращений к сети.

Это не пропуски, а граница ответственности инструмента.
