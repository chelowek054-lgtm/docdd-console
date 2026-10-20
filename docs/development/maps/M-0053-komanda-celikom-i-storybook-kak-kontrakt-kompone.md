---
id: M-0053
type: map
title: Команда целиком и Storybook как контракт компонентов
status: approved
created: 2026-10-20
updated: 2026-10-20
---

# Команда целиком и Storybook как контракт компонентов

```docdd-functional
{
  "added": {
    "vision": {
      "audience": "Команды с несколькими проектами: архитектор и разработчик, менеджер проекта, аналитик, дизайнер, тестировщик, девопс, сопровождение, доменный специалист и наблюдатель со стороны заказчика — каждый со своей ролью, зоной ответственности и рабочим местом."
    },
    "capabilities": [
      {
        "id": "design.catalog",
        "parent": "design",
        "title": "Storybook как контракт компонентов между системами отрисовки",
        "summary": "Каталог Storybook проекта — эталон базовых и составных компонентов без бизнес-логики; перенос на Compose, SwiftUI, React Native сверяется с ним.",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "collab",
        "title": "Совместная работа: уведомления и обсуждения",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa",
        "title": "Рабочее место тестировщика",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "ops",
        "title": "Девопс и сопровождение: релизы, окружения, мониторинг",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "design.catalog.contract",
        "parent": "design.catalog",
        "title": "Контракт компонента: варианты, состояния, свойства, слоты, события; базовые и составные",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.catalog.storybook",
        "parent": "design.catalog",
        "title": "Storybook проекта — эталон: чтение каталога историй в реестр",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "design.catalog.parity",
        "parent": "design.catalog",
        "title": "Сверка переноса на стеки: Storybook RN, Compose, SwiftUI",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "design.catalog.snapshots",
        "parent": "design.catalog",
        "title": "Снимки историй — эталон Pixel-Perfect и визуальных регрессий",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "design.catalog.port",
        "parent": "design.catalog",
        "title": "Перенос компонента на стек моделью по контракту",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "access.team-roles",
        "parent": "access",
        "title": "Роли дизайнера, тестировщика, девопса и сопровождения",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "collab.notify",
        "parent": "collab",
        "title": "Уведомления команды",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "collab.comments",
        "parent": "collab",
        "title": "Обсуждение у записи",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa.cases",
        "parent": "qa",
        "title": "Шаги и ожидаемый результат в проверке",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa.runs",
        "parent": "qa",
        "title": "Прогон набора проверок на сборку или релиз",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "qa.defects",
        "parent": "qa",
        "title": "Запись о дефекте",
        "priority": "must",
        "horizon": "next"
      },
      {
        "id": "ops.releases",
        "parent": "ops",
        "title": "Релизы и окружения",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "ops.grafana",
        "parent": "ops",
        "title": "Grafana: метрики процесса, алерты во входящее, ссылки на панели",
        "priority": "should",
        "horizon": "next"
      },
      {
        "id": "ops.metric-checks",
        "parent": "ops",
        "title": "Проверка-метрика по запросу Prometheus",
        "priority": "should",
        "horizon": "later"
      },
      {
        "id": "self.facts",
        "parent": "self",
        "title": "Состояния карты и проверки соответствуют сделанному",
        "priority": "must",
        "horizon": "now"
      }
    ]
  }
}
```

## Журнал

- 2026-10-20 · заведена из docs/inbox/storybook-kak-kontrakt-komponentov-pri-perenose.md, docs/inbox/komanda-shire-dizaynery-testirovschiki-devopsy-s.md, docs/inbox/uvedomleniya-i-obsuzhdenie-u-zapisey.md, docs/inbox/rabochee-mesto-testirovschika-shagi-progony-defe.md, docs/inbox/devops-i-soprovozhdenie-relizy-okruzheniya-grafa.md, docs/inbox/fakty-karty-i-proverok-sootvetstvuyut-sdelannomu.md · приложение
- 2026-10-20 · на подтверждение · architect
- 2026-10-20 · подтверждён · architect
