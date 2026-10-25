---
id: M-0085
type: map
title: 'Функциональная карта: «Сроки и фактическое время задач»'
status: draft
created: 2026-10-25
updated: 2026-10-25
---

# Функциональная карта: «Сроки и фактическое время задач»

Черновик: составлен моделью, не подтверждён. Новая ветка контура «Рабочее место менеджера проекта» — в первую очередь
(приоритет `must`, горизонт `now`). Решение — ADR-0039, требование — R-0102.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "pm.timing",
        "title": "Сроки и фактическое время задач",
        "parent": "pm",
        "summary": "У задач и фаз есть срок и оценка, а консоль считает по журналу, сколько реально заняла каждая задача и каждый её этап — для анализа планирования.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "pm.timing.fields",
        "title": "Срок и оценка у задачи и фазы; перенос срока из тега",
        "parent": "pm.timing",
        "summary": "due и estimate в front matter задачи, due у фазы; теги due-YYYY-MM-DD переносятся в поле действием с записью в журнал. Агент только предлагает.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "pm.timing.journal",
        "title": "Время в строке журнала",
        "parent": "pm.timing",
        "summary": "Новые строки журнала — с часами и минутами по часовому поясу проекта; старые без времени читаются как начало дня.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "pm.timing.metrics",
        "title": "Тайминги из журнала",
        "parent": "pm.timing",
        "summary": "Lead и cycle time, время в каждом статусе, ожидание подтверждения документов, оценка против факта, просрочка — считаются при чтении.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "pm.timing.views",
        "title": "Сроки на «Работе», в карточке и у фазы",
        "parent": "pm.timing",
        "summary": "Срок, «просрочена», «осталось N дней», факт и оценка у задачи; срок и прогноз окончания у фазы.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "pm.timing.analytics",
        "title": "«Аналитика» и экспорт",
        "parent": "pm.timing",
        "summary": "Средние lead и cycle time по типам и ролям (человек и агент отдельно), время по статусам, точность оценок, пропускная способность по неделям, просрочки; CSV и JSON.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "pm.timing.rules",
        "title": "Предупреждения о сроках",
        "parent": "pm.timing",
        "summary": "task_overdue, phase_overdue, estimate_exceeded — предупреждения в «Обзоре» и npm run check, сборку не роняют.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      }
    ]
  }
}
```

## Журнал

- 2026-10-25 · заведена черновиком · модель
