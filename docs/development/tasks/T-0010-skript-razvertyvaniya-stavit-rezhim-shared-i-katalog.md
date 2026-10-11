---
id: T-0010
type: task
title: Скрипт развёртывания ставит режим shared и каталог проектов
status: backlog
change: feature
created: 2026-10-10
updated: 2026-10-10
owner: developer
links:
  implements: [R-0003, R-0020]
  depends_on: [T-0007, T-0008]
  affects: [M-0010, M-0007]
---

# Скрипт развёртывания ставит режим shared и каталог проектов

deploy.sh пишет в юнит `DOCDD_MODE=shared` и `DOCDD_PROJECT_ROOTS=$PROJECTS_DIR`; docs/14-deploy.md описывает это. Готово, когда после установки свободный запрос к модели отвечает отказом.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
