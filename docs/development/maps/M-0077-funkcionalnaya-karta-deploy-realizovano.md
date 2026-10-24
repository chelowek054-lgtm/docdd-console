---
id: M-0077
type: map
title: 'Функциональная карта: «Развёртывание на сервере — реализовано»'
status: approved
created: 2026-10-24
updated: 2026-10-24
---

# Функциональная карта: «Развёртывание на сервере — реализовано»

Скрипт установки проверен на чистой Ubuntu 24.04 (Docker с systemd) и на машине с чужой службой на порту 80
(T-0011, [docs/14-deploy.md](../../14-deploy.md), раздел «Проверено»). Три возможности из M-0007 переходят
из «частично» в «реализовано»; остальные поля те же.

```docdd-functional
{
  "added": {
    "capabilities": [
      { "id": "deploy.script", "title": "Скрипт установки и обновления на Ubuntu", "parent": "deploy", "status": "implemented", "priority": "must", "horizon": "now", "note": "deploy/deploy.sh: Node по .nvmrc, сборка (предел памяти Node поднят), служба, повторный запуск обновляет. Прогнан на чистой Ubuntu 24.04 и на машине с занятым портом 80." },
      { "id": "deploy.access", "title": "Доступ по сети через nginx на своём порту", "parent": "deploy", "status": "implemented", "priority": "must", "horizon": "now", "note": "Сервис слушает только 127.0.0.1; nginx на 8088 (по умолчанию), порт 80 скрипт не занимает — проверено при чужой службе на 80." },
      { "id": "deploy.auth", "title": "Авторизация перед сервисом (basic auth в nginx)", "parent": "deploy", "status": "implemented", "priority": "must", "horizon": "now", "note": "Без пароля nginx отвечает 401, с паролем 200 — проверено на установке в Docker." }
    ]
  }
}
```

## Журнал

- 2026-10-24 · заведена черновиком · модель
- 2026-10-24 · на подтверждение · модель
- 2026-10-24 · подтверждён по прямому указанию владельца · architect
