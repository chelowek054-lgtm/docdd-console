---
id: T-0165
type: task
title: 'Отметить по фактам: GET /map/behind и кнопка на «Стратегии»'
status: in_progress
change: feature
created: 2026-10-24
updated: 2026-10-24
reuse: 'server/lib/coverage.ts (capabilityFindings, capabilityCoverage); POST /map/capability action status'
links:
  implements: [R-0101]
  verified_by: [V-0107]
  affects: [M-0005]
---

# Отметить по фактам: GET /map/behind и кнопка на «Стратегии»

`behindProposals` в server/lib/coverage.ts поверх `capabilityFindings` и покрытия; маршрут `GET /api/projects/:id/map/behind`; строка и окно «Отметить по фактам» на экране «Стратегия», черновик — существующим `POST /map/capability` с `action: "status"`. Новых способов писать карту не заводим.

## Журнал

- 2026-10-24 · заведена черновиком · модель
- 2026-10-24 · готова к работе · architect
- 2026-10-24 · в разработку · developer
