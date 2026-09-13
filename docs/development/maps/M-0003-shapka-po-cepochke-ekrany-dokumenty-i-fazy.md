---
id: M-0003
type: map
title: Шапка по цепочке, экраны Документы и Фазы
status: draft
created: 2026-09-13
updated: 2026-09-13
---

# Шапка по цепочке, экраны Документы и Фазы

Изменение к M-0001: шапка разложена по цепочке документ → работа → сверка,
и у каждого типа записи из контракта появился свой список
(docs/04-ui.md, «Навигация»). Добавлены два экрана — «Документы» (проектные
документы, решения и контракты с вкладкой в адресе) и «Фазы» — и чистая
функция расчёта фазы по задачам, которую зовут и экран, и шапка.

`app/layouts/default.vue` и `app/pages/projects/[id]/maps.vue` объявлены
заново, без смены слоя: оба файла изменились после подтверждения M-0001, и
без повторного описания опись держала бы их в «изменившихся». Повторное
объявление — уточнение, а не дубль: в картине побеждает последнее.

## Чего в этой карте нет

Использование `phaseProgress` в `default.vue` и `phases.vue` связью не
записано: это автоимпорт Nuxt, строки `import` у него нет, и свидетельству
не на что опереться — так же, как в M-0001 не записаны вызовы
`useProjectIndex` со страниц.

Переходы из шапки на новые экраны не приписаны ни одному экрану: шапка общая
для всех — по той же причине, по которой M-0001 не приписывает переходы из
`RecordLink.vue`. Обращение «Новой записи» к `POST /api/projects/:id/records`
живёт в общем компоненте `NewRecord.vue` и экрану «Документы» не приписано.

Потоки данных не меняются: оба экрана читают тот же индекс, что и остальные.

## Кодовая база

```docdd-codemap
{
  "added": {
    "modules": [
      {"id":"app/layouts/default.vue","title":"default","layer":"разметка","summary":"Шапка проекта по цепочке документ → работа → сверка: группы Документы, Работа, Сверка, Наполнение и прямые кнопки Обзор, Карты, Практики, со счётчиками незакрытого у пунктов."},
      {"id":"app/pages/projects/[id]/documents.vue","title":"documents","layer":"экраны","summary":"Проектные документы, решения и контракты одним экраном с вкладкой по типу в адресе (?type=): неподтверждённое наверху, кто на документ опирается и чем он заменён."},
      {"id":"app/pages/projects/[id]/phases.vue","title":"phases","layer":"экраны","summary":"Список фаз: статус, посчитанный по задачам, полоса готовности, что мешает закрыть и состав."},
      {"id":"app/pages/projects/[id]/maps.vue","title":"maps","layer":"экраны"},
      {"id":"app/utils/phases.ts","title":"phases","layer":"клиентские утилиты","summary":"Состав и статус фазы по задачам из covers и поля phase — чистая функция, статус из файла фазы не читается.","api":[
        {"name":"phaseProgress","kind":"function","summary":"Состав, статус, полоса готовности и незакрытые задачи фазы","signature":"(phase: IndexRecord, records: readonly IndexRecord[]) => PhaseProgress"},
        {"name":"phaseState","kind":"function","summary":"Статус фазы по статусам её задач","signature":"(tasks: readonly { status: string }[]) => PhaseState"},
        {"name":"PhaseProgress","kind":"type","summary":"Что экран знает о фазе"},
        {"name":"PhaseState","kind":"type","summary":"planned, active или done"}
      ]}
    ],
    "imports": [
      {"from":"app/pages/projects/[id]/documents.vue","to":"server/lib/types.ts","evidence":{"path":"app/pages/projects/[id]/documents.vue","line":2,"fragment":"import type { IndexRecord } from '~~/server/lib/types';"}},
      {"from":"app/utils/phases.ts","to":"server/lib/types.ts","evidence":{"path":"app/utils/phases.ts","line":3,"fragment":"import type { IndexRecord } from '../../server/lib/types';"}}
    ]
  }
}
```

## Потоки данных

```docdd-dataflow
{}
```

## Пользовательские пути

```docdd-userflow
{
  "added": {
    "screens": [
      {"id":"/projects/:id/documents","title":"documents","file":"app/pages/projects/[id]/documents.vue"},
      {"id":"/projects/:id/phases","title":"phases","file":"app/pages/projects/[id]/phases.vue"}
    ],
    "transitions": [
      {"from":"/projects/:id/documents","to":"/projects/:id/records/:recordId","trigger":"ссылка","evidence":{"path":"app/pages/projects/[id]/documents.vue","line":134,"fragment":":to=\"`/projects/${projectId}/records/${id}`\""}},
      {"from":"/projects/:id/phases","to":"/projects/:id/records/:recordId","trigger":"ссылка","evidence":{"path":"app/pages/projects/[id]/phases.vue","line":57,"fragment":"<NuxtLink :to=\"`/projects/${projectId}/records/${task.id}`\""}}
    ]
  }
}
```

## Журнал

- 2026-09-13 · заведена
