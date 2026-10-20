---
id: M-0052
type: map
title: 'Быстрая отрисовка на клиенте: лёгкая разметка и только нужные данные'
status: approved
created: 2026-10-20
updated: 2026-10-20
---

# Быстрая отрисовка на клиенте: лёгкая разметка и только нужные данные

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "perf.client",
        "parent": "perf.large-projects",
        "title": "Быстрая отрисовка на клиенте: лёгкая разметка и только нужные данные",
        "summary": "Страницы не встраивают и не рисуют лишнего: тяжёлые компоненты и данные — по требованию; бюджет скорости проверяется прогоном.",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.map-tree",
        "parent": "perf.client",
        "title": "Функциональная карта без кнопок на каждой строке",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.map-payload",
        "parent": "perf.client",
        "title": "Страница карт грузит только открытую вкладку",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.lists",
        "parent": "perf.client",
        "title": "Лёгкие строки списков задач, требований, фаз и проверок",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.index-payload",
        "parent": "perf.client",
        "title": "Индекс проекта не встраивается целиком в каждую страницу",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.budget",
        "parent": "perf.client",
        "title": "Бюджет скорости страниц — проверка-метрика",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "perf.client.prod-run",
        "parent": "perf.client",
        "title": "Ежедневный запуск консоли на собранной версии",
        "priority": "should",
        "horizon": "next"
      }
    ]
  }
}
```

## Журнал

- 2026-10-20 · заведена из docs/inbox/skorost-otrisovki-funkcionalnaya-karta-risuet-kn.md, docs/inbox/skorost-otrisovki-otvet-karty-otdaet-vse-vidy-sr.md, docs/inbox/skorost-otrisovki-spiski-zadach-trebovaniy-faz-i.md, docs/inbox/skorost-otrisovki-indeks-proekta-vstraivaetsya-v.md, docs/inbox/skorost-otrisovki-byudzhet-stranic-kak-proverka.md, docs/inbox/skorost-otrisovki-rezhim-razrabotki-na-kazhdyy-d.md · приложение
- 2026-10-20 · на подтверждение · architect
- 2026-10-20 · подтверждён · architect
