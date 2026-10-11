---
id: M-0030
type: map
title: Единый дизайн между проектами — новая возможность
status: approved
intent: true
created: 2026-10-11
updated: 2026-10-11
---

# Единый дизайн между проектами — новая возможность

Новая группа функциональной карты: консоль ведёт проекты на разных стеках, и единый вид между ними держится не на памяти, а на токенах, которые ведутся глобально в самой консоли и спускаются в проекты с проверкой экранов моделью. Карта-намерение: кода ещё нет, кодовую карту и потоки уточнит «Обновить карты», когда он появится (`intent: true` снимется тогда же).

```docdd-functional
{
  "added": {
    "capabilities": [
      { "id": "design", "title": "Единый дизайн между проектами", "summary": "Токены дизайна — цвета по ролям для светлой и тёмной темы, типографика, отступы, радиусы, принципы и реестр компонентов — лежат одним источником и одинаково приходят во все проекты, на каком бы стеке они ни были." },
      { "id": "design.tokens", "title": "Токены в общем источнике и сложение «общее → локальное»", "parent": "design", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "design.checks", "title": "Проверка токенов: контраст, обе темы, полнота шкал, конфликт", "parent": "design", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "design.screen", "title": "Экран «Дизайн»: палитра обеих тем, шкалы, реестр компонентов", "parent": "design", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "design.export", "title": "Выгрузка токенов в Nuxt UI, Expo, Compose, SwiftUI", "parent": "design", "status": "not_implemented", "priority": "should", "horizon": "now" },
      { "id": "design.drift", "title": "Сверка файла темы и компонентов проекта с токенами", "parent": "design", "status": "not_implemented", "priority": "should", "horizon": "now" },
      { "id": "design.screens", "title": "Проверка экранов моделью: Responsive и Pixel-Perfect", "parent": "design", "status": "not_implemented", "priority": "must", "horizon": "now", "note": "Снимки экранов из карты путей на трёх ширинах в двух темах; модель находит расхождения с эталоном, правка — задачей." }
    ],
    "relations": [
      { "from": "design.tokens", "to": "projects.shared", "type": "uses", "summary": "токены приходят тем же путём, что правила практик" },
      { "from": "design.checks", "to": "design.tokens", "type": "depends" },
      { "from": "design.screen", "to": "design.tokens", "type": "depends" },
      { "from": "design.export", "to": "design.tokens", "type": "depends" },
      { "from": "design.drift", "to": "design.export", "type": "depends", "summary": "сверяется с тем, что дала бы выгрузка" },
      { "from": "design.screens", "to": "design.tokens", "type": "depends", "summary": "эталон для Pixel-Perfect — токены" },
      { "from": "design.screens", "to": "maps.user", "type": "uses", "summary": "список экранов — из карты пользовательских путей" }
    ]
  }
}
```

## Журнал

- 2026-10-11 · заведена черновиком · claude
- 2026-10-11 · на подтверждение · architect
- 2026-10-11 · подтверждён · architect
