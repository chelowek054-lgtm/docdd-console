---
id: A-0010
type: decision
title: 'Фронтенд: Nuxt 4 + TypeScript + Feature-Sliced Design'
status: draft
created: 2026-09-13
updated: 2026-09-13
links:
  supersedes: [A-0001]
---

# Фронтенд: Nuxt 4 + TypeScript + Feature-Sliced Design

Nuxt 4 + TypeScript — базовый стек клиента без явной причины на иное. Feature-Sliced Design: слои app/pages/widgets/features/entities/shared, зависимости только вниз; доменно-независимое переиспользуемое ядро — в shared. Nuxt UI — базовая библиотека компонентов, если для проекта явно не решено иначе. i18n подключать сразу, если в плане есть хоть один нерусскоязычный пользователь.

Не делать: не мешать слои FSD как попало — features не лезет напрямую в entities другого домена, только через публичный интерфейс слоя; не заводить свою структуру папок «для особого случая» без записанного решения.

Источник: проверено на практике InteractMed, learning/Praxis.

## Журнал

- 2026-09-13 · заведена из docs/inbox/frontend-nuxt-skill.md · приложение
