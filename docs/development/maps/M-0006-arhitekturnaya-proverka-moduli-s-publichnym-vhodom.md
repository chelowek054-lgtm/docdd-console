---
id: M-0006
type: map
title: Архитектурная проверка — модули с публичным входом
status: draft
created: 2026-10-05
updated: 2026-10-05
---

# Архитектурная проверка — модули с публичным входом

Черновик: фаза 18, шаг 1. Новый модуль `server/lib/architecture.ts` — чистая
функция над списком файлов и импортов подтверждённой карты кода: вход модуля по
соглашению языка, правила «через вход», «не вверх», соседи, циклы, `shared` и
`kernel`, слои, подсказка «поднять». Правило `architectureRules` в
`server/lib/rules.ts` вешает находки на карту, объявившую импорт.

```docdd-codemap
{
  "added": {
    "modules": [
      {
        "id": "server/lib/architecture.ts",
        "title": "architecture",
        "layer": "ядро",
        "summary": "Точная проверка архитектуры по карте кода: модули с публичным входом, слои, shared и kernel, подсказка «поднять»"
      }
    ],
    "imports": [
      {
        "from": "server/lib/architecture.ts",
        "to": "server/lib/types.ts",
        "evidence": {
          "path": "server/lib/architecture.ts",
          "line": 1,
          "fragment": "import type { ArchitectureConfig } from './types';"
        }
      },
      {
        "from": "server/lib/rules.ts",
        "to": "server/lib/architecture.ts",
        "evidence": {
          "path": "server/lib/rules.ts",
          "line": 2,
          "fragment": "import { checkArchitecture } from './architecture';"
        }
      }
    ]
  }
}
```

Новых источников данных и экранов шаг не вводит: чистая функция и правило.

```docdd-dataflow
{ "added": { "sources": [], "flows": [] } }
```

```docdd-userflow
{ "added": { "screens": [], "transitions": [], "calls": [] } }
```

## Журнал

- 2026-10-05 · заведена черновиком · модель
