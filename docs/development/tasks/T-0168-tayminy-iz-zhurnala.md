---
id: T-0168
type: task
title: 'Тайминги из журнала: lead, cycle, время в статусах, ожидание документов, оценка и просрочка'
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

# Тайминги из журнала: lead, cycle, время в статусах, ожидание документов, оценка и просрочка

Чистая функция в server/lib над записью, её журналом и связями: lead time, cycle time, время в ready/in_progress/in_review с учётом возвратов, ожидание подтверждения документов из documents/refines, estimate против cycle time, дни просрочки после due. Кэш в .docdd — только ускорение. Готово, когда расчёт покрыт тестами на записях с известным ответом.

## Журнал

- 2026-10-25 · заведена черновиком · модель
