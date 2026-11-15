---
id: T-0207
type: task
title: 'Восемь областей архитектора и поводы напоминания'
status: backlog
change: feature
reuse: none
created: 2026-11-11
updated: 2026-11-11
links:
  implements: [R-0124]
  affects: [M-0095]
  verified_by: [V-0134]
---

# Восемь областей архитектора и поводы напоминания

`ARCHITECT_AREAS` в `server/lib/domain-map/domain/model.ts` — восемь значений; схемы front matter и ответа модели; `domainFindings` получает требования к качеству и проверки и напоминает по поводам. Переиспользует `architectRefusal` и `domainFindings` без нового модуля.

## Ожидаемый результат

Право и напоминания по восьми областям; V-0134 зелёная.

## Журнал

- 2026-11-11 · заведена черновиком · модель
