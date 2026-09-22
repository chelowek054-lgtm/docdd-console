---
id: A-0012
type: decision
title: 'Локальная разработка: docker-compose база + override'
status: draft
created: 2026-09-13
updated: 2026-09-13
links:
  supersedes: [A-0003]
---

# Локальная разработка: docker-compose база + override

docker-compose.yaml — базовый, прод-подобный стек (docker compose -f docker-compose.yaml up --build). docker-compose.override.yaml — оверрайд для локальной разработки: dev-цели с hot-reload, подхватывается автоматически. .env.example — шаблон переменных окружения в репозитории; настоящий .env — только локально. Все значения конфигурации — из .env, не зашиты в docker-compose.yaml.

Не делать: не коммитить настоящий .env с реальными значениями; не заводить третий отдельный способ запуска «для тестов»/«для CI», если хватает override с другими значениями .env.

Источник: проверено на практике InteractMed и другие проекты этого стека.

## Журнал

- 2026-09-13 · заведена из docs/inbox/docker-compose-skill.md · приложение
