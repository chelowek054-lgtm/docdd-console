---
id: M-0110
type: map
title: Удаление 3D-карт
status: approved
created: 2026-11-24
updated: 2026-11-24
---

# Удаление 3D-карт

Выведены из эксплуатации интерфейс WebGL и его зависимости. Свидетельство исходной реализации осталось в M-0004.

```docdd-codemap
{
  "removed": {
    "modules": [
      {
        "id": "app/components/MermaidDiagram3D.vue"
      }
    ],
    "imports": [
      {
        "from": "app/components/MermaidDiagram3D.vue",
        "to": "app/utils/map-mermaid.ts",
        "evidence": {
          "path": "app/components/MermaidDiagram3D.vue",
          "line": 2,
          "fragment": "import { colorOf, type MermaidEdge, type MermaidNode } from '../utils/map-mermaid';"
        }
      }
    ]
  }
}
```

## Журнал

- 2026-11-24 · полный вывод 3D по подтверждению пользователя · Codex
