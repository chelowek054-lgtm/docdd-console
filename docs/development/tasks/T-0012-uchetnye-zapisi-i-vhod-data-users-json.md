---
id: T-0012
type: task
title: 'Учётные записи и вход: .data/users.json, сессия, экран входа'
status: done
change: feature
created: 2026-10-10
updated: 2026-10-24
owner: developer
links:
  implements: [R-0005]
  affects: [M-0011]
reuse: none
---

# Учётные записи и вход: .data/users.json, сессия, экран входа

Учётки с хешем пароля (scrypt), вход и выход, cookie HttpOnly/SameSite=Strict, первый администратор из скрипта развёртывания, экран «Люди» у администратора. Готово, когда без входа API отвечает 401, а локальный режим может работать без входа по флагу.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-20 · готова к работе · architect
- 2026-10-20 · в разработку · architect
- 2026-10-20 · на проверку · architect
- 2026-10-21 · закрыта · architect
