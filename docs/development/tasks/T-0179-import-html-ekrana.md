---
id: T-0179
type: task
title: 'Импорт HTML-экрана из Claude Design'
status: backlog
change: feature
reuse: none
created: 2026-10-26
updated: 2026-10-26
links:
  implements: [R-0106]
  affects: [M-0090]
  verified_by: [V-0113]
  depends_on: [T-0178]
---

# Импорт HTML-экрана из Claude Design

`POST /design/mockups` (docs/03-server-api.md): HTML-файл или zip и id экрана; раскладка под `mockups/<экран>/` через `resolveInside`, лимит размера, отказ на `..` и абсолютные пути; черновик `design` с `screen`/`mockup` и строка журнала; повторный импорт черновика — новая версия, подтверждённого — отказ с подсказкой про преемника. Чистая часть — в server/lib/design-mockups.ts, с тестами.

## Журнал

- 2026-10-26 · заведена черновиком · модель
