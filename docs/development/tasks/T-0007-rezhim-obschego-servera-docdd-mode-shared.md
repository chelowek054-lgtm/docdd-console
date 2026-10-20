---
id: T-0007
type: task
title: Режим общего сервера DOCDD_MODE=shared
status: in_review
change: feature
created: 2026-10-10
updated: 2026-10-20
owner: developer
links:
  implements: [R-0003]
  affects: [M-0010]
---

# Режим общего сервера DOCDD_MODE=shared

Переменная `DOCDD_MODE=shared` выключает свободный запрос к модели (`/api/llm/ask`), работу с полным доступом и слияние, пока нет прав (фаза 26), и называет причину на кнопке. Локальный режим не меняется. Готово, когда эти маршруты в режиме shared отвечают 403 с кодом `server_mode_shared`.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-20 · готова к работе · architect
- 2026-10-20 · в разработку · architect
- 2026-10-20 · на проверку · architect
