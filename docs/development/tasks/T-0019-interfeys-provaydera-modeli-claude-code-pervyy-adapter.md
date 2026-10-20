---
id: T-0019
type: task
title: Интерфейс провайдера модели; Claude Code — первый адаптер
status: in_review
change: feature
created: 2026-10-10
updated: 2026-10-20
owner: developer
links:
  implements: [R-0008]
  affects: [M-0012]
---

# Интерфейс провайдера модели; Claude Code — первый адаптер

Вынести из server/utils/llm.ts интерфейс провайдера (вид agent/chat, ask, лента событий, коды отказов); Claude Code — адаптер без смены поведения. Готово, когда все прежние тесты зелёные, а ask() не знает про claude.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-20 · готова к работе · architect
- 2026-10-20 · в разработку · architect
- 2026-10-20 · на проверку · architect
