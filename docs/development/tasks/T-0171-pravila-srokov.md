---
id: T-0171
type: task
title: 'Правила task_overdue, phase_overdue, estimate_exceeded'
status: backlog
change: feature
reuse: none
created: 2026-10-25
updated: 2026-10-25
links:
  implements: [R-0102]
  verified_by: [V-0108]
  affects: [M-0085]
---

# Правила task_overdue, phase_overdue, estimate_exceeded

Три предупреждения в server/lib/rules.ts и docs/05-validation.md: задача не закрыта после due, фаза не закончена к сроку, факт больше оценки вдвое. Видны в «Обзоре» и npm run check, сборку не роняют. Готово, когда правила покрыты тестами и видны на реальном проекте.

## Журнал

- 2026-10-25 · заведена черновиком · модель
