---
id: M-0056
type: map
title: 'Функциональная карта: отметки состояния (10)'
status: approved
created: 2026-10-21
updated: 2026-10-21
---

# Функциональная карта: отметки состояния (10)

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками
то, что модель не поняла, и подтвердите — до этого карта на общую картину
не влияет.

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "self.drift",
        "title": "Документы не расходятся с кодом и друг с другом",
        "parent": "self",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "self.check",
        "title": "Сборка падает на нарушении процесса в собственных записях",
        "parent": "self",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "should",
        "horizon": "now"
      },
      {
        "id": "access.login",
        "title": "Вход под своим именем",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.audit",
        "title": "Журнал доступа: кто, что и когда сделал на сервере",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.journal",
        "title": "Журнал и отчёты подписаны человеком",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.assignee",
        "title": "Исполнитель задачи и «Мои задачи»",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.team",
        "title": "Команда проекта и роли в манифесте",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "access.viewer",
        "title": "Наблюдатель: только смотреть",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.permissions",
        "title": "Права ролей на действия",
        "parent": "access.roles",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "work.task-reviewer",
        "title": "Ревьюер задачи: явный или по правилу, фильтр и адресный запрос на проверку",
        "summary": "У каждой задачи есть роль, которая её принимает: поле reviewer или правило по видам проверок и типу изменения. Видна в карточке и списке, фильтр по ревьюеру, подставляется в «Принять вручную» и в запрос на проверку (ADR-0030).",
        "status": "implemented",
        "note": "Все задачи возможности закрыты, проверка прошла прогоном (2026-10-21)",
        "priority": "must",
        "horizon": "now"
      }
    ]
  }
}
```

## Журнал

- 2026-10-21 · заведена черновиком · модель
- 2026-10-21 · на подтверждение · architect
- 2026-10-21 · подтверждён · architect
