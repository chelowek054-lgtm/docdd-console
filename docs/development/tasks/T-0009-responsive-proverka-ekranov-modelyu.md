---
id: T-0009
type: task
title: Responsive-проверка экранов моделью
status: backlog
change: feature
links:
  implements: [R-0004]
  verified_by: [V-0004]
  depends_on: [T-0008]
  affects: [M-0007]
created: 2026-10-11
updated: 2026-10-11
---

# Responsive-проверка экранов моделью

Шаблон запроса `docs/prompts/design-responsive.md` и разбор ответа в находки: на каждой ширине — горизонтальный скролл, обрезанное и наехавшее, перенос шапки, зона нажатия меньше 44×44, отступ по краю не из шкалы. Ответ — блок с находками «экран · ширина · тема · что не так»; находки видны в «Сверке» проекта. Переиспользует: запуск модели и ленту хода (`server/utils/llm.ts`, хранилище заданий `app/stores/modelJobs.ts`), сборку запросов (`server/lib/prompt.ts`).

## Журнал

- 2026-10-11 · заведена черновиком · claude
