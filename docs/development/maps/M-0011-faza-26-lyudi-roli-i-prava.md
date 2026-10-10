---
id: M-0011
type: map
title: 'Фаза 26 — люди, роли и права'
status: draft
created: 2026-10-10
updated: 2026-10-10
---

# Фаза 26 — люди, роли и права

Черновик: карта-намерение фазы P-0026 (люди, роли и права). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "access.login",
        "title": "Вход под своим именем",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.team",
        "title": "Команда проекта и роли в манифесте",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.permissions",
        "title": "Права ролей на действия",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.journal",
        "title": "Журнал и отчёты подписаны человеком",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.assignee",
        "title": "Исполнитель задачи и «Мои задачи»",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.viewer",
        "title": "Наблюдатель: только смотреть",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.audit",
        "title": "Журнал доступа: кто, что и когда сделал на сервере",
        "parent": "access.roles",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      }
    ],
    "relations": [
      {
        "from": "access.permissions",
        "to": "access.login",
        "type": "depends",
        "summary": "право есть у человека, а не у вкладки"
      },
      {
        "from": "access.permissions",
        "to": "access.team",
        "type": "depends",
        "summary": "роль человека — в команде проекта"
      },
      {
        "from": "access.journal",
        "to": "access.login",
        "type": "depends"
      },
      {
        "from": "access.viewer",
        "to": "access.permissions",
        "type": "depends"
      },
      {
        "from": "access.assignee",
        "to": "access.team",
        "type": "depends"
      },
      {
        "from": "access.login",
        "to": "deploy.auth",
        "type": "replaces",
        "summary": "свой вход заменит общий пароль nginx"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
