---
id: T-0031
type: task
title: 'Перевести запросы fix, task и inbox на пакет контекста'
status: in_progress
change: feature
created: 2026-10-10
updated: 2026-10-20
owner: developer
links:
  implements: [R-0011]
  depends_on: [T-0027]
  affects: [M-0013]
---

# Перевести запросы fix, task и inbox на пакет контекста

Сборщики в server/lib/prompt.ts берут данные из пакета; замер размера до и после на этом репозитории и на learning. Готово, когда запросы стали меньше, а тесты разбора ответов зелёные.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-20 · готова к работе · architect
- 2026-10-20 · в разработку · architect
