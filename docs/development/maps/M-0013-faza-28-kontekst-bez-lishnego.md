---
id: M-0013
type: map
title: Фаза 28 — контекст без лишнего
status: draft
created: 2026-10-10
updated: 2026-10-10
---

# Фаза 28 — контекст без лишнего

Черновик: карта-намерение фазы P-0028 (контекст без лишнего). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "context.pack",
        "title": "Пакет контекста из графа записей",
        "parent": "context",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "context.preview",
        "title": "«Что уйдёт модели» перед отправкой",
        "parent": "context",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "context.roles",
        "title": "Запросы к модели по ролям",
        "parent": "context",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "context.ask",
        "title": "Вопрос модели из любой записи",
        "parent": "context",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "context.migrate",
        "title": "Прежние запросы — на пакет контекста",
        "parent": "context",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      }
    ],
    "relations": [
      {
        "from": "context.preview",
        "to": "context.pack",
        "type": "depends"
      },
      {
        "from": "context.roles",
        "to": "context.pack",
        "type": "depends"
      },
      {
        "from": "context.ask",
        "to": "context.roles",
        "type": "depends"
      },
      {
        "from": "context.ask",
        "to": "access.permissions",
        "type": "depends",
        "summary": "спрашивать можно в пределах права роли"
      },
      {
        "from": "context.migrate",
        "to": "context.pack",
        "type": "depends"
      },
      {
        "from": "llm.api",
        "to": "context.pack",
        "type": "uses",
        "summary": "чат-модели получают только пакет"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
