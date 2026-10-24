---
id: T-0112
type: task
title: Ответ карты по виду и догрузка вкладок на странице карт
status: done
change: feature
created: 2026-10-20
updated: 2026-10-21
links:
  implements: [R-0048]
  affects: [M-0052]
reuse: none
---

# Ответ карты по виду и догрузка вкладок на странице карт

GET /api/projects/:id/map?kind=… отдаёт один вид плюс сводку для ярлыков; maps.vue запрашивает открытый вид, остальные — лениво при переключении (useFetch с ключом по виду). docs/03-server-api.md — параметр kind. Замер до: ответ 266 КБ, payload в HTML 258 КБ.

## Журнал

- 2026-10-20 · заведена из docs/inbox/skorost-otrisovki-otvet-karty-otdaet-vse-vidy-sr.md · приложение
- 2026-10-20 · готова к работе · architect
- 2026-10-20 · в разработку · architect
- 2026-10-21 · на проверку · architect
- 2026-10-21 · закрыта · architect
