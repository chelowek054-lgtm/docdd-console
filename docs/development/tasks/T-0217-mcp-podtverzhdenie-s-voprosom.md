---
id: T-0217
type: task
title: 'MCP и сервер: подтверждение, приём и закрытие после вопроса человеку'
status: done
change: feature
reuse: none
created: 2026-11-23
updated: 2026-11-23
links:
  implements: [R-0133]
  decided_by: [A-0008]
  affects: [M-0098]
  verified_by: [V-0143]
---

# MCP и сервер: подтверждение, приём и закрытие после вопроса человеку

`server/lib/agents.ts` (`agentVerdict`), `server/lib/actions.ts` (журнал), маршруты `status`, `bulk/status`, `verified`; инструменты в `server/lib/mcp/tools/`; `docs/17-mcp.md`, `docs/03-server-api.md`, CLAUDE.md (строка про MCP).

## Ожидаемый результат

агент без `confirmation` получает прежний отказ, с ним — проходит и журнал несёт вопрос и ответ; `merge` отказан и с `confirmation`; инструменты без полей подтверждения отказывают. Проверка V-0143 пройдена.

## Журнал

- 2026-11-23 · заведена из разбора razbor-2026-11-23.md (п. 5.2; A-0008) · модель
- 2026-11-23 · готова к работе · модель по поручению chelowek
- 2026-11-23 · в работу · модель
- 2026-11-23 · на проверку: код в ветке claude/c1-llm-confirm, проверки зелёные · модель
- 2026-11-23 · закрыта: V-0143…V-0145 пройдены (отчёт 2026-11-23-c1-llm-confirm.json) · модель по поручению chelowek (разбор 2026-11-23, В-0.3, В-0.4)
