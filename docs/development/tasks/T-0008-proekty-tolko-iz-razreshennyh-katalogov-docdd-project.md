---
id: T-0008
type: task
title: Проекты только из разрешённых каталогов DOCDD_PROJECT_ROOTS
status: backlog
change: feature
created: 2026-10-10
updated: 2026-10-10
owner: developer
links:
  implements: [R-0003]
  affects: [M-0010]
---

# Проекты только из разрешённых каталогов DOCDD_PROJECT_ROOTS

`POST /api/projects` принимает путь только внутри каталогов из `DOCDD_PROJECT_ROOTS`; в режиме shared переменная обязательна. Готово, когда путь вне списка (в том числе через `..` и символические ссылки) отклоняется 403.

## Журнал

- 2026-10-10 · заведена: план «Платформа команды вместо Jira и Confluence» (docs/15-team-platform.md) · модель
