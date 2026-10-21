---
id: T-0090
type: task
title: Вид консоли по токенам D-0002 — подложка, карточки, плашки, таблицы, зоны нажатия
status: in_review
change: feature
created: 2026-10-12
updated: 2026-10-21
links:
  implements: [R-0030]
  affects: [M-0030]
reuse: none
---

# Вид консоли по токенам D-0002 — подложка, карточки, плашки, таблицы, зоны нажатия

Перенос вида холста Claude Design «Praxis» на саму консоль ([docs/16-design-system.md](../../16-design-system.md), «Поверхности и вид»). Токены — запись D-0002 во встроенных практиках (радиус `lg`, роль `shadow`, `elevation`, `backdrop`, `tint`, `caps`, `Table`); разбор и выгрузка — `server/lib/design-surface.ts` и `design-export.ts`; применение — `app/assets/css/main.css`, `app/app.config.ts`, `app/layouts/default.vue`, блоки `ds-card`; показ — раздел «Поверхности и вид» экрана «Дизайн». Переиспользует готовое: конвейер токенов и выгрузку в Nuxt UI из фазы 40 (`design.ts`, `design-export.ts`), новых модулей разбора не заводит, кроме чистых функций поверхностей. Не сделано: перевод поверхностей в Expo, Compose и SwiftUI; перевод остальных блоков `rounded border` на `ds-card`.

## Журнал

- 2026-10-12 · заведена; код и тесты `tests/design-surface.spec.ts` написаны, проверки зелёные; статус не двигала — это за человеком · claude
- 2026-10-20 · готова к работе · architect
- 2026-10-20 · в разработку · architect
- 2026-10-21 · на проверку · architect
