---
id: T-0172
type: task
title: Статус legacy в схеме, переходах и правилах
status: backlog
change: feature
created: 2026-10-25
updated: 2026-10-25
links:
  implements: [R-0103]
  affects: [M-0086]
  verified_by: [V-0110]
---

# Статус legacy в схеме, переходах и правилах

Добавить статус `legacy` в перечень статусов (docs/02-workspace-contract.md) для requirement, task, design, decision, verification. В server/lib/transitions.ts — переход в legacy разрешён из любого статуса кроме draft, обратный переход — только в draft, как у остальных статусов. В server/lib/rules.ts, server/lib/coverage.ts и server/lib/strategy.ts — legacy-записи исключаются из покрытия процессом, здоровья узла и предупреждений (requirement_unverified, task_no_requirement, capability_behind и подобных). В server/lib/task-order.ts — legacy-записи не предлагаются в выборе requirement для implements. Переиспользует существующий механизм массовой смены статуса (BulkDirection) в server/lib/transitions.ts — legacy — ещё одно направление, не новый механизм.

## Журнал

- 2026-10-25 · заведена из docs/inbox/legacy-zapisi.md · приложение
