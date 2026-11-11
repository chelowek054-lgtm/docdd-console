---
id: V-0128
type: verification
title: 'Практика DDD + Clean предупреждает о слоях'
status: approved
kind: unit
created: 2026-11-11
updated: 2026-11-11
links:
  verifies: [R-0118]
---

# Практика DDD + Clean предупреждает о слоях

Шаги: временный проект с контекстом `src/orders`, файлы в `domain` и `infrastructure`. Импорт из `domain` в `infrastructure` и импорт фреймворка в `domain`.

Ожидаемый результат: `arch_layer_up` и `arch_forbidden` — предупреждения, ошибок нет. Импорт `infrastructure` → `domain` молчит. При `tags: []` у `builtin` предупреждений нет.

## Журнал

- 2026-11-11 · заведена черновиком · модель
- 2026-11-11 16:52 · подтверждён · chelowek, подтверждено в чате, записала модель
