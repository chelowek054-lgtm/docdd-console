---
id: T-0218
type: task
title: 'Запись через MCP без входа — только на localhost'
status: ready
change: feature
reuse: none
created: 2026-11-23
updated: 2026-11-23
links:
  implements: [R-0134]
  decided_by: [A-0008]
  affects: [M-0098]
  verified_by: [V-0144]
---

# Запись через MCP без входа — только на localhost

`server/lib/mcp/`: функция `writeAccess`, `cli/mcp.ts`; `docs/17-mcp.md`.

## Ожидаемый результат

решение о записи — чистая функция, проверенная на четырёх случаях. Проверка V-0144 пройдена.

## Журнал

- 2026-11-23 · заведена из разбора razbor-2026-11-23.md (В-1.3; A-0008) · модель
- 2026-11-23 · готова к работе · модель по поручению chelowek
