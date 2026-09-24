---
id: M-0004
type: map
title: Функциональная карта, 3D и pending — новые модули и обновлённые описания
status: approved
created: 2026-09-24
updated: 2026-09-24
---

# Функциональная карта, 3D и pending — новые модули и обновлённые описания

Четыре новых файла (дерево функциональной карты, его узел, 3D-режим графа,
ручка правки возможности) и уточнённые описания одиннадцати изменившихся.

```docdd-codemap
{
  "added": {
    "modules": [
      {
        "id": "server/api/projects/[id]/map/capability.post.ts",
        "title": "capability.post",
        "layer": "маршруты",
        "path": "server/api/projects/[id]/map/capability.post.ts",
        "summary": "Заводит черновик карты с одной возможностью функциональной карты (добавить/переименовать/убрать) без похода к модели."
      },
      {
        "id": "app/components/FunctionalTree.vue",
        "title": "FunctionalTree",
        "layer": "компоненты",
        "path": "app/components/FunctionalTree.vue",
        "summary": "Сворачиваемое дерево функциональной карты с формой добавления, переименования и удаления возможностей и кнопкой подтверждения черновика."
      },
      {
        "id": "app/components/FunctionalTreeNode.vue",
        "title": "FunctionalTreeNode",
        "layer": "компоненты",
        "path": "app/components/FunctionalTreeNode.vue",
        "summary": "Одна строка дерева возможностей: рекурсивно рисует детей, кнопки добавить/переименовать/убрать по наведению."
      },
      {
        "id": "app/components/MermaidDiagram3D.vue",
        "title": "MermaidDiagram3D",
        "layer": "компоненты",
        "path": "app/components/MermaidDiagram3D.vue",
        "summary": "3D-режим графа карты (3d-force-graph): подписанные сферы, размер по числу связей, легенда слоёв, автоподгонка вида."
      },
      {
        "id": "server/api/projects/[id]/prompt/index.post.ts",
        "title": "index.post",
        "layer": "маршруты",
        "path": "server/api/projects/[id]/prompt/index.post.ts",
        "summary": "Собирает запрос к модели по шаблону из docs/prompts: fix, maps, map-fix, inbox, verify и functional-check."
      },
      {
        "id": "server/lib/maps.ts",
        "title": "maps",
        "layer": "ядро",
        "path": "server/lib/maps.ts",
        "summary": "Разбор блоков карт, сверка свидетельств, свод подтверждённых карт в общую картину и пометка pending у ещё не устоявшихся."
      },
      {
        "id": "server/lib/prompt.ts",
        "title": "prompt",
        "layer": "ядро",
        "path": "server/lib/prompt.ts",
        "summary": "Чистые функции сборки запросов к модели: подставляют данные проекта в шаблоны, включая дерево возможностей для проверки по коду."
      },
      {
        "id": "server/utils/llm.ts",
        "title": "llm",
        "layer": "серверные утилиты",
        "path": "server/utils/llm.ts",
        "summary": "Запуск Claude Code для запросов к модели, потоковый разбор событий и отмена."
      },
      {
        "id": "server/utils/map-service.ts",
        "title": "map-service",
        "layer": "серверные утилиты",
        "path": "server/utils/map-service.ts",
        "summary": "Общая картина проекта: сложенные подтверждённые карты, статус свидетельств по рёбрам, pending-разметка и счётчик unverified."
      },
      {
        "id": "app/components/MapInspector.vue",
        "title": "MapInspector",
        "layer": "компоненты",
        "path": "app/components/MapInspector.vue",
        "summary": "Боковая карточка узла или ребра карты: summary, api, файл с подсветкой, свидетельство и пометка «карта не устоялась»."
      },
      {
        "id": "app/components/MermaidDiagram.vue",
        "title": "MermaidDiagram",
        "layer": "компоненты",
        "path": "app/components/MermaidDiagram.vue",
        "summary": "Отрисовка mermaid с зумом, панорамой, кликом по узлу и ребру, фокусом на соседях, прозрачностью pending и экспортом SVG."
      },
      {
        "id": "app/components/PromptPanel.vue",
        "title": "PromptPanel",
        "layer": "компоненты",
        "path": "app/components/PromptPanel.vue",
        "summary": "Запрос к модели: собрать, показать, скопировать, отправить и показать ответ (fix, maps, functional-check)."
      },
      {
        "id": "app/layouts/default.vue",
        "title": "default",
        "layer": "разметка",
        "path": "app/layouts/default.vue",
        "summary": "Общая раскладка страниц: шапка с навигацией по цепочке документ → работа → сверка и переключатель темы."
      },
      {
        "id": "app/pages/projects/[id]/maps.vue",
        "title": "maps",
        "layer": "экраны",
        "path": "app/pages/projects/[id]/maps.vue",
        "summary": "Экран «Карты»: четыре вида карты, чипы слоёв, 2D/3D, Дерево/Граф у функциональной карты, черновики от модели."
      },
      {
        "id": "app/utils/map-mermaid.ts",
        "title": "map-mermaid",
        "layer": "клиентские утилиты",
        "path": "app/utils/map-mermaid.ts",
        "summary": "Перевод карт в текст mermaid вместе с данными для карточки, подсказок, соседей, порядком узлов mindmap и pending."
      }
    ],
    "imports": [
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/analyze.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 6,
          "fragment": "import { analyze } from '../../../../lib/analyze';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/cache.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 7,
          "fragment": "import { dropCache } from '../../../../lib/cache';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/import.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 8,
          "fragment": "import { targetPath } from '../../../../lib/import';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 9,
          "fragment": "import { mapDraftText, type MapChange } from '../../../../lib/maps';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/paths.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 10,
          "fragment": "import { OutsideRootError, normalizeRoot, resolveInside } from '../../../../lib/paths';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/scaffold.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 11,
          "fragment": "import { nextId } from '../../../../lib/scaffold';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/schema.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 12,
          "fragment": "import { validateFunctional } from '../../../../lib/schema';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/lib/workspace.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 13,
          "fragment": "import { DEVELOPMENT_DIR, WorkspaceError, readWorkspace } from '../../../../lib/workspace';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/utils/http.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 14,
          "fragment": "import { fail, failWith } from '../../../../utils/http';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/utils/index-service.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 15,
          "fragment": "import { loadIndex } from '../../../../utils/index-service';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/utils/projects.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 16,
          "fragment": "import { findProject } from '../../../../utils/projects';"
        }
      },
      {
        "from": "server/api/projects/[id]/map/capability.post.ts",
        "to": "server/utils/record-write.ts",
        "evidence": {
          "path": "server/api/projects/[id]/map/capability.post.ts",
          "line": 17,
          "fragment": "import { today } from '../../../../utils/record-write';"
        }
      },
      {
        "from": "app/components/FunctionalTree.vue",
        "to": "app/components/FunctionalTreeNode.vue",
        "evidence": {
          "path": "app/components/FunctionalTree.vue",
          "line": 3,
          "fragment": "import type { Capability } from './FunctionalTreeNode.vue';"
        }
      },
      {
        "from": "app/components/MermaidDiagram3D.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/MermaidDiagram3D.vue",
          "line": 2,
          "fragment": "import { colorOf, type MermaidEdge, type MermaidNode } from '../utils/map-mermaid';"
        }
      },
      {
        "from": "server/lib/maps.ts",
        "to": "server/lib/write.ts",
        "evidence": {
          "path": "server/lib/maps.ts",
          "line": 2,
          "fragment": "import { yamlSafe } from './write';"
        }
      },
      {
        "from": "server/utils/map-service.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/utils/map-service.ts",
          "line": 10,
          "fragment": "import type { WorkRecord } from '../lib/types';"
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
{}
```

## Журнал

- 2026-09-24 · заведена черновиком · человек
- 2026-09-24 · на подтверждение
- 2026-09-24 · подтверждён
