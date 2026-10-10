---
id: T-0005
type: task
title: 'dev-сервер — localhost:3000 отвечает 426 Upgrade Required'
status: done
change: fix
created: 2026-10-10
updated: 2026-10-10
owner: developer
links:
  implements: [R-0002]
  affects: [M-0009]
---

# dev-сервер — localhost:3000 отвечает 426 Upgrade Required

В dev-режиме на [::]:3000 отвечает не Nuxt, а сервер WebSocket; 127.0.0.1:3000 работает. Найти, кто слушает IPv6, и привести к одному адресу. Готово, когда http://localhost:3000 открывает приложение.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-10 · готова к работе · модель
- 2026-10-10 · в разработку · модель
- 2026-10-10 · на проверку · модель
- 2026-10-10 · закрыта · architect
