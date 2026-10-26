---
id: T-0175
type: task
title: Переход draft → legacy
status: in_review
change: feature
reuse: none
created: 2026-10-25
updated: 2026-10-26
links:
  implements: [R-0104]
  decided_by: [A-0001]
  depends_on: [T-0172]
  affects: [M-0088]
  verified_by: [V-0111]
---

# Переход draft → legacy

В server/lib/rules.ts (`withLegacy`) разрешить `legacy` и из `draft`; тест tests/legacy.spec.ts — черновик уходит в
legacy, у карты по-прежнему отказ. Больше ничего: пачка, исключение из правил и возврат в курс уже работают (T-0172…T-0174).

## Журнал

- 2026-10-25 · заведена черновиком · модель
- 2026-10-26 14:51 · готова к работе · architect
- 2026-10-26 14:51 · в разработку · developer
- 2026-10-26 14:51 · на проверку · developer
