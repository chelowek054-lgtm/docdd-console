---
id: V-0004
type: verification
title: Модель не читает файлы вне проекта
status: approved
created: 2026-10-10
updated: 2026-10-21
kind: integration
runner: npm
command: npm run test -- tests/model-sandbox.spec.ts
---

# Модель не читает файлы вне проекта

Автоматическая проверка: `npm run test -- tests/model-sandbox.spec.ts`. Пройдена, когда все тесты файла зелёные. Тестов пока нет — их пишет задача, выполняющая R-0004.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-10 · на подтверждение · architect
- 2026-10-10 · подтверждён · architect
- 2026-10-21 · проверена вручную (вид integration) · architect · проверил Claude Sonnet 5.5 (агент), по поручению пользователя · Принято по указанию пользователя: проверено тестами с заглушками внешних сервисов (fetch/spawn подменены), с настоящими… · architect
