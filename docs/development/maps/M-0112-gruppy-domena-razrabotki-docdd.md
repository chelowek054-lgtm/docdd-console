---
id: M-0112
type: map
title: Группы домена разработки DocDD
status: approved
intent: true
created: 2026-11-24
updated: 2026-11-24
---

# Группы домена разработки DocDD

Обзор разделён на пять областей ответственности. Сохраняются узлы, их ссылки и исходные связи из [M-0108](M-0108-domen-razrabotki-v-docdd.md). Эта запись добавляет группы и принадлежность к ним.

```docdd-domain
{
  "added": {
    "nodes": [
      {
        "id": "dev.group.access",
        "kind": "context",
        "title": "Проект и доступ",
        "summary": "Границы проекта, участники, каналы и полномочия."
      },
      {
        "id": "dev.group.planning",
        "kind": "context",
        "title": "Постановка и готовность",
        "summary": "Уточняет намерение, фиксирует задачу и проверяет основания для старта."
      },
      {
        "id": "dev.group.knowledge",
        "kind": "context",
        "title": "Знания и операции",
        "summary": "Ведёт источники, поиск, инструкции и доступные операции."
      },
      {
        "id": "dev.group.execution",
        "kind": "context",
        "title": "Выполнение",
        "summary": "Ведёт попытку и её результаты в разрешённой рабочей области."
      },
      {
        "id": "dev.group.acceptance",
        "kind": "context",
        "title": "Проверка и приёмка",
        "summary": "Связывает проверяемые свидетельства с решением человека и историей задачи."
      },
      {
        "id": "dev.project",
        "kind": "context",
        "title": "Проект",
        "summary": "Граница документов, кода, прав и задач.",
        "parent": "dev.group.access"
      },
      {
        "id": "dev.people",
        "kind": "actor",
        "title": "Участники проекта",
        "summary": "Автор, исполнитель и принимающий действуют с правами своей роли. Один человек может выполнять несколько ролей.",
        "parent": "dev.group.access"
      },
      {
        "id": "dev.channel",
        "kind": "concept",
        "title": "Канал работы",
        "summary": "Вкладка, Claude Code, Codex CLI или прямой HTTP API обращаются к одной задаче.",
        "sysdesign": [
          "local-assistant.tab",
          "server.http",
          "server.mcp"
        ],
        "parent": "dev.group.access"
      },
      {
        "id": "dev.executor",
        "kind": "actor",
        "title": "Исполнитель попытки",
        "summary": "Человек, локальная модель или внешний харнес ведёт назначенную попытку в её границах.",
        "sysdesign": [
          "local-assistant.session",
          "external.harness"
        ],
        "parent": "dev.group.access"
      },
      {
        "id": "dev.intent",
        "kind": "concept",
        "title": "Намерение",
        "summary": "Входящее описание задачи, исследования, разбора реализации или дефекта.",
        "sysdesign": [
          "server.inbox"
        ],
        "parent": "dev.group.planning"
      },
      {
        "id": "dev.routing",
        "kind": "process",
        "title": "Подготовка задачи",
        "summary": "Уточняет цель, исключения и ожидаемый результат, связывает существующие документы и отмечает пробелы.",
        "sysdesign": [
          "server.inbox"
        ],
        "parent": "dev.group.planning"
      },
      {
        "id": "dev.task",
        "kind": "aggregate",
        "title": "Задача DocDD",
        "summary": "Одна запись задачи с ожидаемым результатом, ответственностью, зависимостями и журналом.",
        "sysdesign": [
          "server.validation",
          "server.work"
        ],
        "parent": "dev.group.planning"
      },
      {
        "id": "dev.baseline",
        "kind": "concept",
        "title": "Основание работы",
        "summary": "Актуальные требования, решения, контракты, карта, проверки и ревизии записей, на которые опирается задача.",
        "parent": "dev.group.planning"
      },
      {
        "id": "dev.gate",
        "kind": "rule",
        "title": "Готовность к изменению",
        "summary": "Код меняется по готовой задаче и действующему подтверждённому основанию. Проверка готовности принадлежит DocDD.",
        "sysdesign": [
          "server.validation"
        ],
        "parent": "dev.group.planning"
      },
      {
        "id": "dev.profile",
        "kind": "concept",
        "title": "Входные инструкции",
        "summary": "Короткие правила проекта, области и задачи со ссылками, версией и порядком применения.",
        "parent": "dev.group.knowledge"
      },
      {
        "id": "dev.module",
        "kind": "concept",
        "title": "Область проекта",
        "summary": "Владелец обязанности, смысловые границы, публичные входы, справки и способы проверки. Может соответствовать нескольким каталогам.",
        "parent": "dev.group.knowledge"
      },
      {
        "id": "dev.source",
        "kind": "concept",
        "title": "Источник знания",
        "summary": "Документ, раздел, путь или символ кода с происхождением и ревизией. Внешний источник имеет URL и дату доступа.",
        "sysdesign": [
          "server.files",
          "server.read"
        ],
        "parent": "dev.group.knowledge"
      },
      {
        "id": "dev.search",
        "kind": "process",
        "title": "Поиск по проекту",
        "summary": "Разрешает точные идентификаторы, имена и пути, дополняет их поиском по словам и смыслу.",
        "sysdesign": [
          "server.search",
          "local-assistant.retrieve"
        ],
        "parent": "dev.group.knowledge"
      },
      {
        "id": "dev.packet",
        "kind": "concept",
        "title": "Пакет задачи",
        "summary": "Ограниченный по бюджету набор цели, правил, решений, входов, проверок и доступных действий со ссылками.",
        "sysdesign": [
          "server.search",
          "local-assistant.retrieve"
        ],
        "parent": "dev.group.knowledge"
      },
      {
        "id": "dev.directory",
        "kind": "concept",
        "title": "Каталог операций",
        "summary": "Описывает возможности по областям, версии контрактов, условия вызова и побочные эффекты.",
        "sysdesign": [
          "server.mcp",
          "local-assistant.mcp"
        ],
        "parent": "dev.group.knowledge"
      },
      {
        "id": "dev.authority",
        "kind": "rule",
        "title": "Полномочия попытки",
        "summary": "Проект, задача, исполнитель и операция сверяются при каждом вызове. Переход канала не расширяет доступ.",
        "sysdesign": [
          "server.http",
          "server.mcp"
        ],
        "parent": "dev.group.access"
      },
      {
        "id": "dev.attempt",
        "kind": "aggregate",
        "title": "Попытка выполнения",
        "summary": "Отдельный запуск задачи с исполнителем, каналом, основанием, рабочей областью и событиями.",
        "sysdesign": [
          "server.local",
          "server.jobs"
        ],
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.area",
        "kind": "concept",
        "title": "Рабочая область",
        "summary": "Рабочее дерево задачи для кода или папка сессии для материалов. Результаты возвращаются в DocDD.",
        "sysdesign": [
          "server.work",
          "local-assistant.workspace"
        ],
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.feature",
        "kind": "process",
        "title": "Разработка изменения",
        "summary": "Патч, обновлённые документы и карта, результаты проверок и открытые вопросы.",
        "sysdesign": [
          "server.local.feature"
        ],
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.research",
        "kind": "process",
        "title": "Исследование",
        "summary": "Вопрос, проверенные источники, выводы и варианты решений. Веб-поиск включается отдельно.",
        "sysdesign": [
          "server.local.research",
          "local-assistant.research"
        ],
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.reverse",
        "kind": "process",
        "title": "Разбор реализации",
        "summary": "Описание собственного или разрешённого проекта по путям, символам, контрактам и наблюдаемому поведению.",
        "sysdesign": [
          "server.local.reverse",
          "server.maps"
        ],
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.attachment",
        "kind": "concept",
        "title": "Вложение",
        "summary": "Изображение или документ, привязанные к проекту и попытке. Производный материал ссылается на оригинал.",
        "sysdesign": [
          "local-assistant.vision",
          "local-assistant.workspace"
        ],
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.result",
        "kind": "concept",
        "title": "Кандидат результата",
        "summary": "Патч, отчёт исследования либо описание реализации с привязкой к попытке и основанию.",
        "parent": "dev.group.execution"
      },
      {
        "id": "dev.evidence",
        "kind": "concept",
        "title": "Свидетельство",
        "summary": "Ссылка на версию источника, отчёт проверки или наблюдение, подтверждающее конкретное утверждение.",
        "parent": "dev.group.acceptance"
      },
      {
        "id": "dev.review",
        "kind": "process",
        "title": "Приёмка результата",
        "summary": "Человек сопоставляет результат и свидетельства с ожидаемым результатом.",
        "sysdesign": [
          "server.work",
          "server.validation"
        ],
        "parent": "dev.group.acceptance"
      },
      {
        "id": "dev.approval",
        "kind": "rule",
        "title": "Адресное подтверждение",
        "summary": "Подтверждение относится к конкретным документам, действию и проверенной версии результата.",
        "sysdesign": [
          "local-assistant.mcp",
          "server.validation"
        ],
        "parent": "dev.group.acceptance"
      },
      {
        "id": "dev.journal",
        "kind": "concept",
        "title": "Журнал задачи",
        "summary": "Фиксирует автора, попытку, существенные события, результат и решение о приёмке.",
        "sysdesign": [
          "server.records",
          "server.jobs"
        ],
        "parent": "dev.group.acceptance"
      },
      {
        "id": "dev.closed",
        "kind": "event",
        "title": "Задача принята",
        "summary": "Решение человека и доказательства связаны с конкретным результатом. Статус закрытия выставляет DocDD.",
        "parent": "dev.group.acceptance"
      }
    ]
  }
}
```

## Журнал

- 2026-11-24 · подготовлена группировка домена по существующим областям ответственности · Codex
- 2026-11-24 18:56 · на подтверждение · architect
- 2026-11-24 18:56 · подтверждён · architect
