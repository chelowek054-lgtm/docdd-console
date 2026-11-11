---
id: T-0200
type: task
title: 'Доменная карта: формат, схема, проверки'
status: in_review
change: feature
reuse: none
created: 2026-11-11
updated: 2026-11-11
links:
  implements: [R-0119]
  affects: [M-0094]
  verified_by: [V-0129]
---

# Доменная карта: формат, схема, проверки

Модуль `server/lib/domain-map/` (вход `index.ts`): разбор блока `docdd-domain`, состояние из подтверждённых записей, четыре предупреждения. Запись в `MAP_KINDS`, схема `docs/schemas/domain.schema.json`, раздел в `docs/07-maps.md` и `docs/02-workspace-contract.md`.

Переиспользует: `server/lib/maps.ts` — в справочнике записей о них нет, поэтому `reuse: none`.

## Ожидаемый результат

Карта `domain` разбирается, складывается и проверяется; V-0129 зелёная.

## Журнал

- 2026-11-11 · заведена черновиком · модель
- 2026-11-11 16:52 · готова к работе · chelowek, подтверждено в чате, записала модель
- 2026-11-11 16:55 · в разработку · developer
- 2026-11-11 17:20 · на проверку · developer
