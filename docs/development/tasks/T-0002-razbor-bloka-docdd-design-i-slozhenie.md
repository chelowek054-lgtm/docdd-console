---
id: T-0002
type: task
title: 'Разбор блока docdd-design и сложение «общее → локальное», GET /design'
status: backlog
change: feature
links:
  implements: [R-0001]
  verified_by: [V-0001]
  depends_on: [T-0001]
  affects: [M-0007]
created: 2026-10-11
updated: 2026-10-11
---

# Разбор блока docdd-design и сложение «общее → локальное», GET /design

Чистая логика в `server/lib/design.ts`: разбор блока из подтверждённых `design`, сложение источников с меткой происхождения у каждой части, `design_conflict`. Сервис `server/utils/design-service.ts` и маршрут `GET /api/projects/:id/design`. Переиспользует, а не пишет заново: чтение общих источников и сложение уровней из `server/lib/practice-rules.ts` и `server/utils/rules-service.ts` (тот же путь, что у `docdd-rules`), разбор записи — `server/lib/parse.ts`.

## Журнал

- 2026-10-11 · заведена черновиком · claude
