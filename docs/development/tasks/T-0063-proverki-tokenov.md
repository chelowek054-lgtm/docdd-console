---
id: T-0063
type: task
title: 'Проверки токенов: контраст, обе темы, полнота шкал'
status: done
change: feature
links:
  implements: [R-0031]
  verified_by: [V-0030]
  depends_on: [T-0061]
  affects: [M-0030]
reuse: none
created: 2026-10-11
updated: 2026-10-20
---

# Проверки токенов: контраст, обе темы, полнота шкал

Чистые функции в `server/lib/design.ts`: контраст по формуле WCAG 2.x (относительная яркость sRGB), пары «текст/фон» из R-0031, предупреждения `design_contrast_low`, `design_theme_incomplete`, `design_scale_gap`, `design_conflict` — в общем списке нарушений ([docs/05-validation.md](../../05-validation.md)) и в «Сверке».

## Журнал

- 2026-10-11 · заведена черновиком · claude
- 2026-10-11 · готова к работе · architect
- 2026-10-11 · в разработку · architect
- 2026-10-11 · на проверку · architect
- 2026-10-20 · закрыта · architect
