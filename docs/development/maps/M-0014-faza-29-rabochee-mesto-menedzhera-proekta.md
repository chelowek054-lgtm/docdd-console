---
id: M-0014
type: map
title: Фаза 29 — рабочее место менеджера проекта
status: approved
created: 2026-10-10
updated: 2026-10-11
---

# Фаза 29 — рабочее место менеджера проекта

Черновик: карта-намерение фазы P-0029 (рабочее место менеджера проекта). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "pm.board",
        "title": "Доска задач по статусам",
        "parent": "pm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "pm.roadmap",
        "title": "Дорожная карта фаз",
        "parent": "pm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "pm.milestones",
        "title": "Вехи: целевая дата фазы и отклонение",
        "parent": "pm",
        "status": "not_implemented",
        "priority": "could",
        "horizon": "next"
      },
      {
        "id": "pm.report",
        "title": "Сводка для заказчика",
        "parent": "pm",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "pm.assistant",
        "title": "Помощник менеджера",
        "parent": "pm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      }
    ],
    "relations": [
      {
        "from": "pm.board",
        "to": "access.assignee",
        "type": "uses",
        "summary": "фильтр по исполнителю"
      },
      {
        "from": "pm.roadmap",
        "to": "pm.milestones",
        "type": "uses"
      },
      {
        "from": "pm.assistant",
        "to": "context.roles",
        "type": "depends"
      },
      {
        "from": "pm.report",
        "to": "access.viewer",
        "type": "feeds",
        "summary": "наблюдатель читает сводку"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-11 · на подтверждение · architect
- 2026-10-11 · подтверждён · architect
