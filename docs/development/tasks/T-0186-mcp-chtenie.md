---
id: T-0186
type: task
title: 'MCP: сервер и инструменты чтения'
status: in_progress
change: feature
reuse: none
created: 2026-11-08
updated: 2026-11-08
links:
  implements: [R-0107]
  affects: [M-0092]
  verified_by: [V-0115]
  depends_on: [T-0183]
---

# MCP: сервер и инструменты чтения

`cli/mcp.ts` по stdio, клиент API, `project_status`, `next_tasks`, `task_context`, `list_issues`, инструкция подключения. Зависимость `@modelcontextprotocol/sdk`.

## Ожидаемый результат

Claude Code подключается по MCP и получает контекст задачи в пределах бюджета; нет запущенной консоли — понятная ошибка.

## Журнал

- 2026-11-08 · заведена черновиком · модель
- 2026-11-08 22:06 · готова к работе · chelowek, подтверждено в чате, записала модель
- 2026-11-08 22:06 · в разработку · developer
