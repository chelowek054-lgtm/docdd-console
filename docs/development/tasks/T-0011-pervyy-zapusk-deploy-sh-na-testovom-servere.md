---
id: T-0011
type: task
title: Первый запуск deploy.sh на тестовом сервере Ubuntu
status: done
change: fix
created: 2026-10-10
updated: 2026-10-24
owner: architect
links:
  implements: [R-0020]
  depends_on: [T-0010]
  affects: [M-0010, M-0007]
---

# Первый запуск deploy.sh на тестовом сервере Ubuntu

Запустить скрипт на чистой Ubuntu и на сервере с Docker на 80, разобрать сбои, отметить deploy.script, deploy.access, deploy.auth «Реализовано». Готово, когда обе установки прошли и проверка 401 зелёная.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
- 2026-10-24 · в разработку · developer
- 2026-10-24 · прогон в Docker (Ubuntu 24.04, systemd): чистая установка и сервер с занятым портом 80 прошли, 401 зелёная; найден и исправлен сбой сборки по памяти · developer
- 2026-10-24 · на проверку · developer
- 2026-10-24 · закрыта: возможности deploy.script, deploy.access, deploy.auth отмечены реализованными (M-0077) · architect
