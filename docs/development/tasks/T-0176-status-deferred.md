---
id: T-0176
type: task
title: 'Статус deferred: контракт, схема, переходы, исключение из текущей картины'
status: in_review
change: feature
created: 2026-10-26
updated: 2026-10-26
links:
  implements: [R-0105]
  affects: [M-0089]
  verified_by: [V-0112]
reuse: none
---

# Статус deferred: контракт, схема, переходы, исключение из текущей картины

Сначала документ: docs/02-workspace-contract.md (статусы и диаграммы), frontmatter.schema.json, docs/05-validation.md.
Потом код: переходы в server/lib/rules.ts и server/lib/transitions.ts (`approved ↔ deferred` у требования,
`backlog|ready → deferred → backlog` у задачи, из `deferred` — в `legacy` и `dropped`); исключение из готовности фаз,
обзора, покрытия, `requirement_*`, сроков и выбора `implements`; блокер `ready` при отложенном требовании; массовое
действие с причиной по образцу `bulk/legacy`. Тесты на переходы и исключение.

## Журнал

- 2026-10-26 · заведена черновиком · модель
- 2026-10-26 14:51 · готова к работе · architect
- 2026-10-26 14:51 · в разработку · developer
- 2026-10-26 14:51 · на проверку · developer
