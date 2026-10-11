---
id: M-0016
type: map
title: 'Фаза 31 — масштаб: портфель, шаблоны, зоны ответственности'
status: approved
created: 2026-10-10
updated: 2026-10-11
---

# Фаза 31 — масштаб: портфель, шаблоны, зоны ответственности

Черновик: карта-намерение фазы P-0031 (масштаб: портфель, шаблоны, зоны ответственности). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "scale.portfolio",
        "title": "Портфель проектов",
        "parent": "scale",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "scale.templates",
        "title": "Шаблон нового проекта",
        "parent": "scale",
        "status": "partial",
        "priority": "should",
        "horizon": "later",
        "note": "Заведение формата в пустой папке есть; шаблона с вектором, ролями и практиками нет."
      },
      {
        "id": "scale.zones",
        "title": "Зоны ответственности: владелец возможности и фазы",
        "parent": "scale",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "scale.concurrency",
        "title": "Одновременная работа без потери правок",
        "parent": "scale",
        "status": "partial",
        "priority": "must",
        "horizon": "later",
        "note": "Защищён только текст записи (409); статусы, поля и порядок — нет."
      },
      {
        "id": "scale.performance",
        "title": "Большие проекты без тормозов",
        "parent": "scale",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "later"
      }
    ],
    "relations": [
      {
        "from": "scale.zones",
        "to": "access.team",
        "type": "depends"
      },
      {
        "from": "scale.portfolio",
        "to": "access.permissions",
        "type": "uses",
        "summary": "видны только свои проекты"
      },
      {
        "from": "scale.templates",
        "to": "projects.init",
        "type": "depends"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-11 · на подтверждение · architect
- 2026-10-11 · подтверждён · architect
