---
id: M-0012
type: map
title: Фаза 27 — несколько языковых моделей
status: approved
created: 2026-10-10
updated: 2026-10-11
---

# Фаза 27 — несколько языковых моделей

Черновик: карта-намерение фазы P-0027 (несколько языковых моделей). Объявляет подпункты возможностей курса M-0008; задачи фазы ссылаются на неё связью `affects`, поэтому покрытие каждой возможности видно на функциональной карте.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "llm.providers",
        "title": "Один интерфейс для многих провайдеров",
        "parent": "llm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.api",
        "title": "Модели по API: OpenAI-совместимые и Anthropic",
        "parent": "llm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.agents",
        "title": "Агенты для работы над задачей: Claude Code и другие",
        "parent": "llm",
        "status": "partial",
        "priority": "should",
        "horizon": "next",
        "note": "Claude Code уже работает; Codex CLI и Gemini CLI — нет."
      },
      {
        "id": "llm.settings",
        "title": "Настройки моделей у администратора, ключи вне репозитория",
        "parent": "llm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.routing",
        "title": "Какой запрос какой моделью",
        "parent": "llm",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "llm.usage",
        "title": "Учёт запросов: кто, какая модель, сколько стоило",
        "parent": "llm",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "llm.queue",
        "title": "Очередь запросов на сервере, видная команде",
        "parent": "llm",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "next"
      }
    ],
    "relations": [
      {
        "from": "llm.api",
        "to": "llm.providers",
        "type": "depends"
      },
      {
        "from": "llm.agents",
        "to": "llm.providers",
        "type": "depends"
      },
      {
        "from": "llm.settings",
        "to": "llm.providers",
        "type": "depends"
      },
      {
        "from": "llm.routing",
        "to": "llm.settings",
        "type": "depends",
        "summary": "маршруты задаются в настройках"
      },
      {
        "from": "llm.usage",
        "to": "access.login",
        "type": "uses",
        "summary": "кто спросил"
      },
      {
        "from": "llm.settings",
        "to": "access.permissions",
        "type": "depends",
        "summary": "настраивает администратор"
      }
    ]
  }
}
```

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-11 · на подтверждение · architect
- 2026-10-11 · подтверждён · architect
