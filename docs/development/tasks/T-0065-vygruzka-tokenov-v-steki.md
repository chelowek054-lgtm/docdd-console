---
id: T-0065
type: task
title: 'Выгрузка токенов в Nuxt UI, Expo, Compose и SwiftUI'
status: in_review
change: feature
links:
  implements: [R-0032]
  verified_by: [V-0032]
  depends_on: [T-0061]
  affects: [M-0030]
reuse: none
created: 2026-10-11
updated: 2026-10-11
---

# Выгрузка токенов в Nuxt UI, Expo, Compose и SwiftUI

Чистые функции `server/lib/design-export.ts`, по одной на стек: `nuxt-ui` — переменные в `main.css` для обеих тем и цвета `app.config.ts`; `expo` — `constants/theme.ts` с `LightColors`/`DarkColors`, отступами и кеглями; `compose` — `Color.kt` (`LightColorScheme`/`DarkColorScheme`), `Type.kt`, `Shape.kt`, `AppTheme`; `swiftui` — `Theme.swift` и `Contents.json` цветов каталога ассетов с Any/Dark. Одинаковый вход — одинаковый текст; снимки в тестах. На экране «Дизайн» — вкладка «Стеки» с текстом выгрузки.

## Журнал

- 2026-10-11 · заведена черновиком · claude
- 2026-10-11 · готова к работе · architect
- 2026-10-11 · в разработку · architect
- 2026-10-11 · на проверку · architect
