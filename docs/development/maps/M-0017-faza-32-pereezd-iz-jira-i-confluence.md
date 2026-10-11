---
id: M-0017
type: map
title: Фаза 32 — переезд из Jira и Confluence
status: approved
created: 2026-10-10
updated: 2026-10-11
---

# Фаза 32 — переезд из Jira и Confluence

Черновик: карта-намерение фазы P-0032 (переезд из Jira и Confluence). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "migration.jira",
        "title": "Импорт задач из Jira",
        "parent": "migration",
        "status": "not_implemented",
        "priority": "could",
        "horizon": "later"
      },
      {
        "id": "migration.confluence",
        "title": "Импорт страниц Confluence",
        "parent": "migration",
        "status": "not_implemented",
        "priority": "could",
        "horizon": "later"
      }
    ],
    "relations": [
      {
        "from": "migration.jira",
        "to": "projects.init",
        "type": "uses",
        "summary": "тот же путь, что импорт документации"
      },
      {
        "from": "migration.confluence",
        "to": "inbox.parse",
        "type": "feeds",
        "summary": "страницы — во входящее"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-11 · на подтверждение · architect
- 2026-10-11 · подтверждён · architect
