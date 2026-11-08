---
id: M-0092
type: map
title: 'Функциональная карта: MCP, экономия токенов, модули'
status: approved
created: 2026-11-08
updated: 2026-11-08
---

# Функциональная карта: MCP, экономия токенов, модули

Черновик: составлен моделью, не подтверждён. Прочитайте, поправьте и подтвердите — до этого карта на общую картину не влияет.

```docdd-functional
{
  "added": {
    "capabilities": [
      { "id": "mcp", "title": "Работа через MCP", "summary": "Ассистент ведёт проект через инструменты консоли и не может обойти правила DocDD.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "mcp.read", "title": "Чтение состояния и контекста задачи", "parent": "mcp", "summary": "Состояние проекта, следующие задачи, пакет контекста и нарушения — короткими ответами с бюджетом.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "mcp.write", "title": "Черновики и разрешённые переходы", "parent": "mcp", "summary": "Заводить черновики, вести журнал и двигать задачу по белому списку; подтверждать и сливать нельзя.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "tokens", "title": "Экономия токенов", "summary": "Модель получает только нужное, а расход виден по каждой задаче.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "tokens.report", "title": "Расход по задачам и базовая линия", "parent": "tokens", "summary": "Токены, доля кэша и заходы по задаче и виду запроса.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "tokens.expected", "title": "Ожидаемый результат у задачи", "parent": "tokens", "summary": "Задача без проверяемого результата не уходит в работу: меньше переделок.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "tokens.sections", "title": "Разделы документов вместо целых файлов", "parent": "tokens", "summary": "Задача ссылается на раздел, в запрос уходит он, остальное модель открывает сама.", "status": "not_implemented", "priority": "should", "horizon": "now" },
      { "id": "tokens.verify", "title": "Короткий вывод проверок", "parent": "tokens", "summary": "Модели — только упавшее и итог, полный лог — в файле.", "status": "not_implemented", "priority": "should", "horizon": "now" },
      { "id": "tokens.session", "title": "Свежая сессия со сводкой", "parent": "tokens", "summary": "Разросшаяся сессия заменяется новой с короткой сводкой.", "status": "not_implemented", "priority": "could", "horizon": "next" },
      { "id": "platform", "title": "Модульная основа", "summary": "Новая возможность добавляется отдельным модулем, не трогая соседние.", "status": "not_implemented", "priority": "must", "horizon": "now" },
      { "id": "platform.modules", "title": "Модули с публичным входом и реестр инструментов", "parent": "platform", "summary": "Модуль — каталог с index.ts; свои инструменты MCP он объявляет сам; границы проверяет архитектурная сверка.", "status": "not_implemented", "priority": "must", "horizon": "now" }
    ]
  }
}
```

## Журнал

- 2026-11-08 · заведена черновиком · модель
- 2026-11-08 22:06 · подтверждён · chelowek, подтверждено в чате, записала модель
