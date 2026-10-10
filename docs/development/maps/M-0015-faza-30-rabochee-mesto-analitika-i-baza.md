---
id: M-0015
type: map
title: Фаза 30 — рабочее место аналитика и база знаний
status: draft
created: 2026-10-10
updated: 2026-10-10
---

# Фаза 30 — рабочее место аналитика и база знаний

Черновик: карта-намерение фазы P-0030 (рабочее место аналитика и база знаний). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "analyst.requirements",
        "title": "Требования с критериями приёмки",
        "parent": "analyst",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "analyst.assistant",
        "title": "Помощник аналитика",
        "parent": "analyst",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "knowledge.space",
        "title": "Пространство знаний: дерево страниц",
        "parent": "knowledge",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "knowledge.search",
        "title": "Поиск по всему проекту",
        "parent": "knowledge",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "knowledge.glossary",
        "title": "Глоссарий проекта",
        "parent": "knowledge",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      }
    ],
    "relations": [
      {
        "from": "analyst.assistant",
        "to": "context.roles",
        "type": "depends"
      },
      {
        "from": "analyst.requirements",
        "to": "validation.verified",
        "type": "feeds",
        "summary": "критерии становятся проверками"
      },
      {
        "from": "context.pack",
        "to": "knowledge.glossary",
        "type": "uses",
        "summary": "термины из текста попадают в пакет"
      },
      {
        "from": "knowledge.space",
        "to": "inbox.parse",
        "type": "uses",
        "summary": "база знаний из входящего"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
