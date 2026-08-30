# Контракт файлов проекта · `docdd.workspace/1`

Формат, ради которого написано приложение. Здесь он изложен целиком: репозиторий
инструмента обязан быть самодостаточным, а не отсылать к проекту, который
случайно оказался первым.

Проверяющие схемы лежат рядом: [schemas/](schemas/).

## Корень проекта

Пользователь указывает путь к проекту. Приложение ищет
`docs/development/project.yaml`:

```yaml
contract: docdd.workspace/1
project:
  id: fishforecast
  name: FishForecast
  description: Офлайн-первый помощник рыболова
paths:
  requirements: requirements
  design: design
  decisions: decisions
  contracts: contracts
  tasks: tasks
  phases: phases
  tests: tests
  diagrams: diagrams
sources:
  code: [app/src]
  docs: [app/docs]
roles:
  - id: architect
    name: Архитектор
policy:
  require_approved_docs_before_dev: true
  require_verification_before_done: true
  stale_in_progress_days: 14
```

Пути — относительно `docs/development`. Имена папок не зашиваются в код:
приложение читает манифест. Отсутствующий ключ в `paths` означает, что такого
раздела в проекте нет, а не ошибку.

Поколение контракта проверяется до всего остального. `docdd.workspace/2` —
отказ с понятной причиной, а не попытка прочитать половину.

Схема: [schemas/project.schema.json](schemas/project.schema.json).

## Запись

Каждая запись — markdown-файл с YAML front matter:

```markdown
---
id: T-0007
type: task
title: Вынести веса модели клёва в документ знаний
status: ready
owner: dev
created: 2026-08-30
updated: 2026-08-30
phase: P-0007
links:
  implements: [R-0004]
  documents: [D-0003]
  verified_by: [V-0004]
tags: [client, bite-model]
---

# Вынести веса модели клёва в документ знаний

Текст: зачем, что делаем, чего не делаем, как понять, что готово.

## Журнал

- 2026-08-30 · в разработку · architect
```

Правила, которые приложение обязано соблюдать при записи:

1. Front matter — первый блок файла между двумя строками `---`.
2. Тело файла принадлежит человеку. Приложение меняет только front matter и
   добавляет строки в раздел «Журнал».
3. Порядок ключей front matter сохраняется, незнакомые поля остаются на месте.
4. Перевод строки в файле остаётся таким, каким был: смена CRLF на LF даёт
   бессмысленный дифф на весь файл.
5. Кодировка UTF-8.
6. **Даты** (`created`, `updated`) пишутся без кавычек: `2026-08-30`. И `js-yaml`,
   и питоновский `yaml` разбирают такой скаляр в объект даты, а не в строку,
   поэтому перед проверкой по схеме его надо привести к строке ISO-8601. Мелочь,
   которая ломает валидатор на первом же файле, если про неё не знать.

Схема: [schemas/frontmatter.schema.json](schemas/frontmatter.schema.json).

## Типы записей

| Тип | Префикс | Что это | Папка |
|---|---|---|---|
| `requirement` | `R-` | Чего система обязана достичь | `requirements/` |
| `design` | `D-` | Проектный документ | `design/` |
| `decision` | `A-` | Решение с причинами и отвергнутым | `decisions/` |
| `contract` | `C-` | Контракт обмена: OpenAPI, формат файла | `contracts/` |
| `task` | `T-` | Единица работы | `tasks/` |
| `phase` | `P-` | Группа задач | `phases/` |
| `verification` | `V-` | Способ проверки | `tests/` |

Идентификатор: префикс, дефис, четыре цифры. Номера не переиспользуются —
удалённая запись оставляет дыру, и ссылка на неё не должна вдруг указать на
другое.

Имя файла: `<id>-<слаг>.md`. Слаг для человека, идентификатор для машины;
переименование слага ничего не ломает.

## Связи

Задаются только в `links`, только идентификаторами и только в одну сторону.
Обратные строит приложение.

| Связь | От | К | Смысл |
|---|---|---|---|
| `implements` | task | requirement | Задача выполняет требование |
| `refines` | design, task | design, requirement | Уточняет, не отменяя |
| `decided_by` | design, task | decision | Опирается на решение |
| `supersedes` | любой | тот же тип | Заменяет прежнюю запись |
| `depends_on` | task | task | Не начинать раньше той |
| `verified_by` | requirement, task | verification | Чем проверяется |
| `verifies` | verification | requirement, task | Что проверяет |
| `documents` | task | design, contract | Какой документ правится задачей |
| `covers` | phase | task | Состав фазы |

Ссылка на несуществующий идентификатор — ошибка. Цикл в `depends_on` — ошибка.

## Статусы

Документы (`requirement`, `design`, `contract`) и решения:

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> review
    review --> draft
    review --> approved
    approved --> superseded
    draft --> dropped
    review --> dropped
```

У решений вместо `dropped` — `rejected`: смысл тот же, слово принятое в ADR.

Задачи:

```mermaid
stateDiagram-v2
    [*] --> backlog
    backlog --> ready
    ready --> in_progress
    in_progress --> in_review
    in_review --> in_progress
    in_review --> done
    backlog --> dropped
    ready --> dropped
    in_progress --> dropped
```

| Переход | Условие |
|---|---|
| `backlog → ready` | Все записи из `documents` и `refines` в статусе `approved`; есть хотя бы одна `implements` |
| `ready → in_progress` | Ручное действие человека — это и есть «запустить в разработку» |
| `in_review → done` | Все `verified_by` имеют `passed` в последнем отчёте, если включена политика |

Фазы: `planned → active → done`, считаются приложением по задачам из `covers`,
вручную не ставятся.

У проверок статуса нет — есть последний результат из отчётов: `passed`, `failed`
или `unknown`. Это факт, его нельзя поставить.

## Запуск в разработку

Действие меняет статус `ready → in_progress`, обновляет `updated` и добавляет
строку в журнал:

```markdown
## Журнал

- 2026-08-30 · в разработку · architect
```

Больше ничего не происходит: ни веток, ни коммитов, ни запуска агентов. Если
задача не в `ready`, переход запрещён, и причина называется прямо — какой
документ не подтверждён или какого требования не хватает.

## Диаграммы

Два способа, оба обязательны к поддержке:

- блок ` ```mermaid ` внутри документа;
- отдельный файл `diagrams/<имя>.mmd`, вставленный ссылкой вида
  `![Подпись](../diagrams/dataflow.mmd)`.

Ошибка разбора диаграммы — предупреждение у документа, а не отказ его показать.

## Отчёты прогонов

`tests/reports/<дата>-<runner>.json`:

```json
{
  "contract": "docdd.workspace/1",
  "runner": "gradle",
  "started_at": "2026-08-30T10:00:00Z",
  "total": 161,
  "failed": 0,
  "verifications": { "V-0004": "passed", "V-0007": "failed" }
}
```

Схема: [schemas/report.schema.json](schemas/report.schema.json). Отчёты кладёт
сборка проекта или человек; приложение их только читает.

## Совместимость

- Незнакомые поля front matter сохраняются при записи и игнорируются при чтении.
- Незнакомый тип записи — предупреждение, файл показывается как есть.
- Смена поколения контракта требует явной миграции.
