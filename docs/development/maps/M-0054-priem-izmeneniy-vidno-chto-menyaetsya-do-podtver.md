---
id: M-0054
type: map
title: 'Приём изменений: видно, что меняется, до подтверждения'
status: approved
created: 2026-10-20
updated: 2026-10-20
---

# Приём изменений: видно, что меняется, до подтверждения

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "records.diff",
        "parent": "records",
        "title": "Приём изменений: видно, что меняется, до подтверждения",
        "summary": "Перед подтверждением человек видит разницу «было → станет» для карт, вектора, документов, задач, порядка и токенов; «было» — из git и подтверждённых записей.",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.core",
        "parent": "records.diff",
        "title": "Общий механизм разницы: маршрут «что меняется» и компонент над записью",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.maps",
        "parent": "records.diff",
        "title": "Разница карты на самой схеме на всех уровнях вложенности",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.vision",
        "parent": "records.diff",
        "title": "Разница вектора проекта по полям",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.text",
        "parent": "records.diff",
        "title": "Разница текста, полей и связей документа или задачи",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.previews",
        "parent": "records.diff",
        "title": "Предпросмотры порядка, фаз и починки — в виде «было → станет»",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "records.diff.design",
        "parent": "records.diff",
        "title": "Разница токенов дизайна: палитра, контраст, файлы выгрузки",
        "priority": "must",
        "horizon": "now"
      }
    ]
  }
}
```

## Журнал

- 2026-10-20 · заведена из docs/inbox/priyom-izmeneniy-vidno-chto-menyaetsya-do-podtverzhdeniya.md · приложение
- 2026-10-20 · на подтверждение · architect
- 2026-10-20 · подтверждён · architect
