---
id: T-0004
type: task
title: Дубли авто-импорта ModelOutcome и LogLine
status: done
change: fix
created: 2026-10-10
updated: 2026-10-10
owner: developer
links:
  implements: [R-0002]
  affects: [M-0009]
---

# Дубли авто-импорта ModelOutcome и LogLine

Nuxt предупреждает о двух одноимённых экспортах в app/composables/useModelRequest.ts и app/stores/modelJobs.ts. Оставить тип в одном месте, второе — импортом. Готово, когда `nuxt dev` стартует без WARN Duplicated imports.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-10 · готова к работе · модель
- 2026-10-10 · в разработку · модель
- 2026-10-10 · на проверку · модель
- 2026-10-10 · закрыта · architect
