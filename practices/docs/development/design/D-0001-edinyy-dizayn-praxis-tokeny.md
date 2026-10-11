---
id: D-0001
type: design
title: Единый дизайн PRAXIS — токены для всех проектов консоли
status: approved
created: 2026-10-11
updated: 2026-10-11
tags: [design]
---

# Единый дизайн PRAXIS — токены для всех проектов консоли

Эталон оформления, который консоль спускает в проекты на Nuxt + Nuxt UI, React Native +
Expo, Kotlin/Compose и Swift/SwiftUI ([docs/16-design-system.md](../../../../../docs/16-design-system.md)).
Значения не придуманы: перенесены из `learningFront/src/shared/config/design.ts` проекта
`learning`, где контраст палитры уже проверен на фонах своей темы (приглушённый текст держит
около 5:1). Роли названы по смыслу, а не по оттенку: `accent`, а не `green`. Единицы —
логические пиксели (`px` в вебе, `dp` в Android, `pt` в iOS).

Начертания (`weight`) в исходном конфиге заданы словарём `regular/medium/semibold/bold`
без привязки к кеглям; здесь привязка выбрана так: текст — 400, `lead` — 500,
`title` — 600, `display` — 700. Межстрочный интервал — исходные 1.45 от кегля,
округлённые.

Подключается тегом `design` у встроенного источника `builtin` на экране «Практики».

```docdd-design
{
  "principles": [
    "Mobile-first: экран начинается с 375 px и растёт вверх",
    "Зона нажатия не меньше 44×44",
    "Контраст текста не ниже 4.5:1 в обеих темах",
    "Светлая и тёмная темы обязательны, у каждой роли есть значение в обеих",
    "Цвет, кегль, отступ и радиус берутся из токенов, а не объявляются в компонентах",
    "Цвет задаётся ролью, а не оттенком: accent, а не blue",
    "Приглушённый текст уже приглушён: opacity поверх него не накидывается"
  ],
  "typography": {
    "caption": { "size": 12, "line": 17, "weight": 400 },
    "small":   { "size": 13, "line": 19, "weight": 400 },
    "body":    { "size": 15, "line": 22, "weight": 400 },
    "lead":    { "size": 17, "line": 25, "weight": 500 },
    "title":   { "size": 22, "line": 32, "weight": 600 },
    "display": { "size": 28, "line": 41, "weight": 700 }
  },
  "spacing": { "xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24, "xxl": 32 },
  "radius":  { "sm": 8, "md": 12, "pill": 999 },
  "palette": {
    "light": {
      "bg": "#F4F6F4",
      "surface": "#FFFFFF",
      "surfaceAlt": "#E7ECE9",
      "ink": "#141F1C",
      "muted": "#516760",
      "line": "#D3DCD7",
      "accent": "#1B6552",
      "onAccent": "#FFFFFF",
      "core": "#835412",
      "ok": "#256A41",
      "warn": "#7B5911",
      "danger": "#973024",
      "onDanger": "#FFFFFF"
    },
    "dark": {
      "bg": "#0E1412",
      "surface": "#18211F",
      "surfaceAlt": "#232F2C",
      "ink": "#E6EDE9",
      "muted": "#9CB0A8",
      "line": "#334340",
      "accent": "#6BC2A4",
      "onAccent": "#08110E",
      "core": "#E3AD68",
      "ok": "#7CC79A",
      "warn": "#E5BC74",
      "danger": "#EE9384",
      "onDanger": "#2A0F0A"
    }
  },
  "components": [
    { "name": "TopBar",   "summary": "Шапка экрана: заголовок и «назад»" },
    { "name": "Card",     "summary": "Панель на поверхности `surface`, радиус `md`" },
    { "name": "Button",   "summary": "Основная (`accent`) и призрачная; высота не меньше 44" },
    { "name": "Field",    "summary": "Поле ввода с состоянием ошибки" },
    { "name": "Pill",     "summary": "Плашка статуса или метки" },
    { "name": "Progress", "summary": "Дорожка прогресса, тон `accent` или `core`" },
    { "name": "Empty",    "summary": "Пустое состояние: текст, а не пустое место" }
  ]
}
```

## Журнал

- 2026-10-11 · заведена из конфига оформления проекта learning (T-0062) · модель
- 2026-10-11 · на подтверждение · architect
- 2026-10-11 · подтверждён · architect
