---
id: M-0010
type: map
title: Фаза 25 — безопасность общего сервера
status: draft
created: 2026-10-10
updated: 2026-10-10
---

# Фаза 25 — безопасность общего сервера

Черновик: карта-намерение фазы P-0025 (безопасность общего сервера). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "security.mode",
        "title": "Режим общего сервера: опасное выключено, пока нет прав",
        "parent": "security",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "security.roots",
        "title": "Проекты только из разрешённых каталогов",
        "parent": "security",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "security.sandbox",
        "title": "Модель на сервере не выходит за проект",
        "parent": "security",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      }
    ],
    "relations": [
      {
        "from": "deploy.script",
        "to": "security.mode",
        "type": "uses",
        "summary": "скрипт ставит сервер в режим shared"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
