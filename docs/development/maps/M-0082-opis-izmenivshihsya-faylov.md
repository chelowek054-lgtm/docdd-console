---
id: M-0082
type: map
title: 'Опись: изменившиеся файлы экрана карт и отрисовки'
status: draft
created: 2026-10-24
updated: 2026-10-24
---

# Опись: изменившиеся файлы экрана карт и отрисовки

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте руками
то, что модель не поняла, и подтвердите — до этого карта на общую картину
не влияет.

Файлы изменились после подтверждения карт (потоки деревом, разделы экранов, отрисовка по очереди): модули объявлены заново с прежними описаниями, связи import — с текущими строками.

```docdd-codemap
{
  "added": {
    "modules": [
      {
        "id": "app/components/MermaidDiagram.vue",
        "title": "MermaidDiagram",
        "layer": "компоненты",
        "summary": "id узла в тексте mermaid → полный текст для наведения (app/utils/map-mermaid.ts)."
      },
      {
        "id": "app/i18n/en/pages2.ts",
        "title": "pages2",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «pages2» (английский)."
      },
      {
        "id": "app/i18n/ru/pages2.ts",
        "title": "pages2",
        "layer": "переводы",
        "summary": "Строки интерфейса раздела «pages2» (русский)."
      },
      {
        "id": "app/pages/projects/[id]/maps.vue",
        "title": "maps",
        "layer": "экраны",
        "summary": "Две категории карт (ADR-0035): `strategic` — стратегическая карта (вид `functional`) на экране «Стратегия», `working` — рабочие карты (шаблоны с движком и свои) на экране «Карты»."
      },
      {
        "id": "app/utils/map-mermaid.ts",
        "title": "map-mermaid",
        "layer": "клиентские утилиты",
        "summary": "Карты в текст mermaid. Тот же текст показывается на экране и выгружается, чтобы вставить его в документ проекта и перерисовывать в его сборке (docs/07-maps.md)."
      }
    ],
    "imports": [
      {
        "from": "app/components/MermaidDiagram.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/MermaidDiagram.vue",
          "line": 2,
          "fragment": "import type { MermaidEdge } from '../utils/map-mermaid'; con"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "app/composables/useProjectIndex.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 2,
          "fragment": "import type { ApiFailure } from '~/composables/useProjectInd"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 3,
          "fragment": "import type { ArchViolationView, FunctionalMode, MapSelectio"
        }
      },
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
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 34,
          "fragment": "import type { ProjectMap } from '~~/server/lib/maps';"
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
          "line": 1274,
          "fragment": "import type { CustomMapView as CustomMapContent } from '~~/s"
        }
      },
      {
        "from": "app/pages/projects/[id]/maps.vue",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "app/pages/projects/[id]/maps.vue",
          "line": 1275,
          "fragment": "import type { CustomMapDefinition } from '~~/server/lib/type"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/functional.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 18,
          "fragment": "} from '../../server/lib/functional';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/flow-groups.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 25,
          "fragment": "} from '../../server/lib/flow-groups';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/groups.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 32,
          "fragment": "} from '../../server/lib/groups';"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/layers.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 34,
          "fragment": "import { layerOf } from '../../server/lib/layers'; import { "
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "server/lib/maps.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 35,
          "fragment": "import type { ApiItem, Evidence, EvidenceVerdict, ProjectMap"
        }
      },
      {
        "from": "app/utils/map-mermaid.ts",
        "to": "app/utils/functional-view.ts",
        "evidence": {
          "path": "app/utils/map-mermaid.ts",
          "line": 44,
          "fragment": "} from './functional-view';"
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

- 2026-10-24 · заведена черновиком · модель

## Журнал

- 2026-10-24 · заведена черновиком · модель
