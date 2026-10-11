---
id: M-0009
type: map
title: Фаза 24 — консоль ведёт сама себя
status: approved
created: 2026-10-10
updated: 2026-10-10
---

# Фаза 24 — консоль ведёт сама себя

Черновик: карта-намерение фазы P-0024 (консоль ведёт сама себя). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "self.records",
        "title": "План и работа над консолью — записями в ней самой",
        "parent": "self",
        "status": "partial",
        "priority": "must",
        "horizon": "now",
        "note": "Требования, проверки, задачи и фазы заведены 2026-10-10; не подтверждены."
      },
      {
        "id": "self.drift",
        "title": "Документы не расходятся с кодом и друг с другом",
        "parent": "self",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "self.check",
        "title": "Сборка падает на нарушении процесса в собственных записях",
        "parent": "self",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "now"
      }
    ],
    "relations": [
      {
        "from": "self.check",
        "to": "self.records",
        "type": "depends",
        "summary": "проверять можно то, что заведено записями"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-10 · на подтверждение · architect
- 2026-10-10 · подтверждён · architect
