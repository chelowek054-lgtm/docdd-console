---
id: M-0005
type: map
title: Функциональная карта DocDD Console — вектор и возможности
status: draft
created: 2026-10-01
updated: 2026-10-02
---

# Функциональная карта DocDD Console — вектор и возможности

Черновик: составлен моделью по `docs/`, не подтверждён. Функциональная карта —
основной источник правды о продукте ([docs/08-usage.md](../../08-usage.md),
«Правила реализации»): на верхнем уровне — вектор, ниже — большие возможности с
подпунктами и честным состоянием реализации. Состояния поставлены по тому, что
описано в документах и есть в приложении; сверьте их кнопкой «Проверить по
коду» и поправьте, чем модель ошиблась, до подтверждения.

```docdd-functional
{
  "added": {
    "vision": {
      "problem": "Правило «документ ведёт код» легко объявить и трудно соблюдать: связь между требованием, документом, задачей и проверкой держится на внимательности того, кто её помнит, и рвётся незаметно.",
      "audience": "Архитектор и разработчик, ведущие проект на своей машине; доменный специалист, который приносит знания через входящее, не зная markdown и git.",
      "outcome": "Любая работа прослеживается от требования до факта сборки, а нарушение процесса видно сразу и не даёт взять задачу в работу.",
      "not": "Не обращается к языковым моделям сам, не заводит своей базы, не подтверждает документы за человека, не считает метрики кода и не правит чужой текст за его автора."
    },
    "capabilities": [
      { "id": "records", "title": "Записи процесса", "summary": "Требования, документы, задачи, проверки, фазы и карты — файлами с front matter, со статусами и журналом." },
      { "id": "records.types", "title": "Типы записей и связи", "parent": "records", "status": "implemented" },
      { "id": "records.status", "title": "Переходы по статусам, в том числе пачкой", "parent": "records", "status": "implemented", "note": "Массовое движение по статусам с защитой от случайного шага вперёд." },
      { "id": "records.edit", "title": "Правка записи человеком", "parent": "records", "status": "implemented", "note": "Текст — только до подтверждения; подтверждённое заменяется преемником." },

      { "id": "validation", "title": "Контроль процесса", "summary": "Приложение показывает, где связь между требованием, задачей и проверкой рвётся, и не пускает задачу вперёд." },
      { "id": "validation.rules", "title": "Правила и нарушения", "parent": "validation", "status": "implemented" },
      { "id": "validation.gates", "title": "Переходы под защитой документов", "parent": "validation", "status": "implemented", "note": "Задача не уходит в ready без подтверждённых документов, требования, change и карты." },
      { "id": "validation.verified", "title": "Факт: отчёты сборки и ручная отметка «Проверено»", "parent": "validation", "status": "implemented" },
      { "id": "validation.cli", "title": "Проверка из командной строки", "parent": "validation", "status": "implemented" },

      { "id": "maps", "title": "Карты устройства", "summary": "Что система умеет, из чего состоит, как текут данные и как по ней ходит пользователь — с проверкой по настоящему коду." },
      { "id": "maps.functional", "title": "Функциональная карта: ядро системы", "parent": "maps", "summary": "Что система должна уметь, как далеко это зашло, что на чём стоит и что за чем идёт: по ней читают состояние будущей системы." },
      { "id": "maps.functional.vision", "title": "Вектор проекта и история курса", "parent": "maps.functional", "status": "implemented", "priority": "must" },
      { "id": "maps.functional.status", "title": "Состояние реализации и «Проверить по коду»", "parent": "maps.functional", "status": "implemented", "priority": "must" },
      { "id": "maps.functional.graph", "title": "Граф состояния с легендой в схеме", "parent": "maps.functional", "status": "implemented", "note": "Три вида стрелок, «ждёт» и цикл; без уровней на десятке групп это стена узлов." },
      { "id": "maps.functional.fill", "title": "Наполнение: связи пачкой, предложение связей, разбор входящего со связями", "parent": "maps.functional", "status": "not_implemented", "priority": "must", "horizon": "now", "note": "Связи заводятся по одной, а разбор входящего теряет связи и состояния." },
      { "id": "maps.functional.kinds", "title": "Пять видов связей, приоритет и горизонт", "parent": "maps.functional", "status": "not_implemented", "priority": "must", "horizon": "now", "note": "Сейчас три вида связей; приоритета и горизонта нет." },
      { "id": "maps.functional.coverage", "title": "Покрытие процессом: требования, задачи и проверки за отметкой", "parent": "maps.functional", "status": "not_implemented", "priority": "must", "horizon": "next" },
      { "id": "maps.functional.consistency", "title": "Предупреждения о расхождении отметки с задачами и проверками", "parent": "maps.functional", "status": "not_implemented", "priority": "should", "horizon": "next" },
      { "id": "maps.functional.levels", "title": "Уровни и режимы графа: обзор, группа, покрытие, риски, порядок, влияние", "parent": "maps.functional", "status": "not_implemented", "priority": "should", "horizon": "next" },
      { "id": "maps.code", "title": "Кодовая база и сверка свидетельств", "parent": "maps", "status": "implemented" },
      { "id": "maps.groups", "title": "Группы: обзор, группа целиком, соседи выбранного модуля", "parent": "maps", "status": "implemented" },
      { "id": "maps.data", "title": "Потоки данных", "parent": "maps", "status": "implemented", "note": "На тех же группах: обзор «группы кода ↔ виды источников»." },
      { "id": "maps.user", "title": "Пользовательские пути", "parent": "maps", "status": "implemented" },
      { "id": "maps.refresh", "title": "Обновление карт по описи файлов", "parent": "maps", "status": "implemented", "note": "Модель отвечает черновиком, подтверждает человек." },

      { "id": "inbox", "title": "Входящее и база знаний", "summary": "Сырые мысли доменного специалиста превращаются в записи без markdown и git." },
      { "id": "inbox.parse", "title": "Разбор заметок в записи", "parent": "inbox", "status": "implemented" },
      { "id": "inbox.functional-first", "title": "Новая функция — сперва в функциональную карту", "parent": "inbox", "status": "partial", "note": "Правило и шаблон запроса есть; автоматического требования к разбору нет." },

      { "id": "work", "title": "Работа через консоль", "summary": "Задача берётся в работу из приложения: ветка, дифф, слияние человеком." },
      { "id": "work.task", "title": "Работа над задачей моделью в своей ветке", "parent": "work", "status": "implemented" },
      { "id": "work.fix", "title": "Починка нарушений моделью по подтверждённому плану", "parent": "work", "status": "implemented" },
      { "id": "work.phases", "title": "Фазы и общие шкалы готовности", "parent": "work", "status": "implemented", "note": "Разбиение задач на фазы моделью, общие шкалы «Задачи» и «Фазы»." },

      { "id": "projects", "title": "Проекты и подключение", "summary": "Завести формат в папке, подхватить уже написанную документацию, общие практики между проектами." },
      { "id": "projects.init", "title": "Заведение формата и импорт имеющейся документации", "parent": "projects", "status": "implemented" },
      { "id": "projects.shared", "title": "Общие практики между проектами", "parent": "projects", "status": "implemented" }
    ],
    "relations": [
      { "from": "validation.gates", "to": "records.types", "type": "depends", "summary": "связи записей — основа проверок" },
      { "from": "maps.groups", "to": "maps.code", "type": "depends", "summary": "группы строятся из модулей кодовой карты" },
      { "from": "maps.data", "to": "maps.groups", "type": "uses", "summary": "группы кода — те же" },
      { "from": "inbox.parse", "to": "maps.functional", "type": "feeds", "summary": "новая функция попадает в карту первой" },
      { "from": "work.task", "to": "validation.gates", "type": "depends" },
      { "from": "maps.functional.fill", "to": "inbox.parse", "type": "depends", "summary": "разбор входящего начинает нести связи и состояния" },
      { "from": "maps.functional.coverage", "to": "validation.verified", "type": "uses", "summary": "результат проверки — последний отчёт" },
      { "from": "maps.functional.consistency", "to": "maps.functional.coverage", "type": "depends", "summary": "расхождение считается по покрытию" },
      { "from": "maps.functional.levels", "to": "maps.functional.coverage", "type": "depends", "summary": "режим «Покрытие» красит по покрытию" },
      { "from": "maps.functional.levels", "to": "maps.functional.kinds", "type": "depends", "summary": "режимы читают приоритет, горизонт и новые виды связей" }
    ]
  }
}
```

## Журнал

- 2026-10-01 · заведена черновиком · модель
- 2026-10-02 · дополнена возможностями фазы 17 (ядро функциональной карты) · модель
