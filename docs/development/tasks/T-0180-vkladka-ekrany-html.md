---
id: T-0180
type: task
title: 'Вкладка «Экраны»: живой макет на ширинах и темах рядом со снимком'
status: in_review
change: feature
reuse: none
created: 2026-10-26
updated: 2026-10-26
links:
  implements: [R-0106]
  affects: [M-0090]
  verified_by: [V-0113, V-0114]
  depends_on: [T-0179]
---

# Вкладка «Экраны»: живой макет на ширинах и темах рядом со снимком

Существующая вкладка `screens` экрана «Дизайн» (app/components/DesignScreens.vue) получает список экранов карты путей с состоянием макета и кнопку «Добавить экран». `GET /design/mockups/:screen/*` отдаёт только файлы макета; просмотр — `iframe sandbox="allow-scripts"` без `allow-same-origin`, ширины 375/768/1280, тема через `data-theme` и `color-scheme`; рядом — снимок реализации из `design/screens/`.

## Журнал

- 2026-10-26 · заведена черновиком · модель
- 2026-10-26 19:50 · готова к работе · architect
- 2026-10-26 19:50 · в разработку · developer
- 2026-10-26 19:50 · на проверку · developer
