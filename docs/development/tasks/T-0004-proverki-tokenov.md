---
id: T-0004
type: task
title: 'Проверки токенов: контраст, обе темы, полнота шкал'
status: backlog
change: feature
links:
  implements: [R-0002]
  verified_by: [V-0001]
  depends_on: [T-0002]
  affects: [M-0007]
reuse: none
created: 2026-10-11
updated: 2026-10-11
---

# Проверки токенов: контраст, обе темы, полнота шкал

Чистые функции в `server/lib/design.ts`: контраст по формуле WCAG 2.x (относительная яркость sRGB), пары «текст/фон» из R-0002, предупреждения `design_contrast_low`, `design_theme_incomplete`, `design_scale_gap`, `design_conflict` — в общем списке нарушений ([docs/05-validation.md](../../05-validation.md)) и в «Сверке».

## Журнал

- 2026-10-11 · заведена черновиком · claude
