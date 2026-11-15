---
id: M-0095
type: map
title: 'Функциональная карта: System Design через DocDD'
status: draft
created: 2026-11-11
updated: 2026-11-11
---

# Функциональная карта: System Design через DocDD

Черновик: составлен моделью, не подтверждён. Вектор не меняется. В группу «Архитектура DDD + Clean» (M-0094) добавляется подгруппа «System Design через DocDD»: как продумывать глобальное устройство проекта и держать его под контролем записями (A-0005).

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "arch.system-design",
        "title": "System Design через DocDD",
        "parent": "arch",
        "summary": "Глобальное устройство продумывается по порядку и держится записями: цифры, границы, решения, контракты, контроль.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "arch.sd-quality",
        "title": "Требования к качеству с цифрами",
        "parent": "arch.system-design",
        "summary": "Нагрузка, задержка, доступность, восстановление, объём данных, безопасность, наблюдаемость — требованием с целевым числом и проверкой-метрикой.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "arch.sd-areas",
        "title": "Восемь областей решений архитектора",
        "parent": "arch.system-design",
        "summary": "К топологии, хранению и транзакциям добавляются связь сервисов, масштабирование, безопасность, наблюдаемость, развёртывание.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "arch.sd-panel",
        "title": "Панель решений архитектора",
        "parent": "arch.system-design",
        "summary": "На «Стратегии» под доменной картой: восемь областей, что нужно, что решено, что ждёт архитектора.",
        "status": "not_implemented",
        "priority": "must",
        "horizon": "now"
      },
      {
        "id": "arch.sd-guide",
        "title": "Справка System Design",
        "parent": "arch.system-design",
        "summary": "Порядок продумывания на одном примере в справке об архитектуре.",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "now"
      }
    ]
  }
}
```

## Журнал

- 2026-11-11 · заведена черновиком · модель
