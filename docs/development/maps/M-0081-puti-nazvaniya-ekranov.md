---
id: M-0081
type: map
title: 'Пользовательские пути: русские названия и файлы экранов'
status: review
created: 2026-10-24
updated: 2026-10-24
---

# Пользовательские пути: русские названия и файлы экранов

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками
то, что модель не поняла, и подтвердите — до этого карта на общую картину
не влияет.

Экраны получили русские названия вместо имён файлов, у старых экранов из M-0001 указан файл страницы — по нему экран попадает в свой раздел на схеме. Связи экрана карт (maps.vue) объявлены заново: файл изменился вместе с разделами путей и деревом потоков.

```docdd-codemap
{
  "added": {
    "imports": [
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 4,
          "fragment": "import { capabilityViews } from '~/utils/functional-view'; i"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 22,
          "fragment": "} from '~~/server/lib/functional';"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/flow-groups.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 31,
          "fragment": "} from '~~/server/lib/flow-groups';"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 32,
          "fragment": "import { ghostNeighbors, groupCard, groupModules, groupScope"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/layers.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 33,
          "fragment": "import { layerOf } from '~~/server/lib/layers';"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/hierarchy.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 850,
          "fragment": "import { ancestors, visibleAt, type Edge as HierarchyEdge, t"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/custom-maps.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 1272,
          "fragment": "import type { CustomMapView as CustomMapContent } from '~~/s"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 1273,
          "fragment": "import type { CustomMapDefinition } from '~~/server/lib/type"
        }
      }
    ]
  }
}
```

```docdd-dataflow
{}
```

```docdd-userflow
{
  "added": {
    "screens": [
      {
        "id": "/projects/:id/documents",
        "title": "Документы",
        "file": "app/pages/projects/[id]/documents.vue"
      },
      {
        "id": "/projects/:id/phases",
        "title": "Фазы",
        "file": "app/pages/projects/[id]/phases.vue"
      },
      {
        "id": "/",
        "title": "Проекты",
        "file": "app/pages/index.vue"
      },
      {
        "id": "/projects/:id",
        "title": "Обзор проекта",
        "file": "app/pages/projects/[id]/index.vue"
      },
      {
        "id": "/projects/:id/verify",
        "title": "Сверка",
        "file": "app/pages/projects/[id]/verify.vue"
      },
      {
        "id": "/projects/:id/fill",
        "title": "Наполнение",
        "file": "app/pages/projects/[id]/fill.vue"
      },
      {
        "id": "/projects/:id/maps",
        "title": "Карты",
        "file": "app/pages/projects/[id]/maps.vue"
      },
      {
        "id": "/projects/:id/records/:recordId",
        "title": "Запись",
        "file": "app/pages/projects/[id]/records/[recordId].vue"
      },
      {
        "id": "/projects/:id/requirements",
        "title": "Требования",
        "file": "app/pages/projects/[id]/requirements.vue"
      },
      {
        "id": "/projects/:id/work",
        "title": "Работа",
        "file": "app/pages/projects/[id]/work.vue"
      },
      {
        "id": "/audit",
        "title": "Журнал доступа",
        "file": "app/pages/audit.vue"
      },
      {
        "id": "/design",
        "title": "Дизайн между проектами",
        "file": "app/pages/design.vue"
      },
      {
        "id": "/login",
        "title": "Вход",
        "file": "app/pages/login.vue"
      },
      {
        "id": "/models",
        "title": "Модели",
        "file": "app/pages/models.vue"
      },
      {
        "id": "/notifications",
        "title": "Уведомления",
        "file": "app/pages/notifications.vue"
      },
      {
        "id": "/people",
        "title": "Люди",
        "file": "app/pages/people.vue"
      },
      {
        "id": "/portfolio",
        "title": "Портфель",
        "file": "app/pages/portfolio.vue"
      },
      {
        "id": "/projects/:id/analyst",
        "title": "Аналитик",
        "file": "app/pages/projects/[id]/analyst.vue"
      },
      {
        "id": "/projects/:id/checks",
        "title": "Проверки",
        "file": "app/pages/projects/[id]/checks.vue"
      },
      {
        "id": "/projects/:id/design",
        "title": "Дизайн проекта",
        "file": "app/pages/projects/[id]/design.vue"
      },
      {
        "id": "/projects/:id/file",
        "title": "Файл кода",
        "file": "app/pages/projects/[id]/file.vue"
      },
      {
        "id": "/projects/:id/glossary",
        "title": "Глоссарий",
        "file": "app/pages/projects/[id]/glossary.vue"
      },
      {
        "id": "/projects/:id/graph",
        "title": "Граф записей",
        "file": "app/pages/projects/[id]/graph.vue"
      },
      {
        "id": "/projects/:id/import",
        "title": "Импорт",
        "file": "app/pages/projects/[id]/import.vue"
      },
      {
        "id": "/projects/:id/inbox",
        "title": "Входящее",
        "file": "app/pages/projects/[id]/inbox.vue"
      },
      {
        "id": "/projects/:id/issues",
        "title": "Нарушения",
        "file": "app/pages/projects/[id]/issues.vue"
      },
      {
        "id": "/projects/:id/knowledge",
        "title": "База знаний",
        "file": "app/pages/projects/[id]/knowledge.vue"
      },
      {
        "id": "/projects/:id/manager",
        "title": "Менеджер",
        "file": "app/pages/projects/[id]/manager.vue"
      },
      {
        "id": "/projects/:id/reference",
        "title": "Справочник",
        "file": "app/pages/projects/[id]/reference.vue"
      },
      {
        "id": "/projects/:id/releases",
        "title": "Релизы",
        "file": "app/pages/projects/[id]/releases.vue"
      },
      {
        "id": "/projects/:id/results",
        "title": "Результаты проверок",
        "file": "app/pages/projects/[id]/results.vue"
      },
      {
        "id": "/projects/:id/search",
        "title": "Поиск",
        "file": "app/pages/projects/[id]/search.vue"
      },
      {
        "id": "/projects/:id/shared",
        "title": "Общие практики",
        "file": "app/pages/projects/[id]/shared.vue"
      },
      {
        "id": "/projects/:id/strategy",
        "title": "Стратегия",
        "file": "app/pages/projects/[id]/strategy.vue"
      },
      {
        "id": "/projects/:id/tasks",
        "title": "Задачи",
        "file": "app/pages/projects/[id]/tasks.vue"
      },
      {
        "id": "/usage",
        "title": "Расход моделей",
        "file": "app/pages/usage.vue"
      }
    ]
  }
}
```

## Журнал

- 2026-10-24 · заведена черновиком · модель
- 2026-10-24 · на подтверждение · architect

## Журнал

- 2026-10-24 · заведена черновиком · модель
