---
id: M-0090
type: map
title: 'Функциональная карта: «Экраны из Claude Design — HTML-макеты»'
status: draft
created: 2026-10-26
updated: 2026-10-26
---

# Функциональная карта: «Экраны из Claude Design — HTML-макеты»

Эталон экрана сейчас — картинка `design/mockups/<экран>.png`. Claude Design отдаёт экран живым HTML: его можно смотреть на
любой ширине и в обеих темах, сверять с токенами и снимать для проверки моделью. Ветка — внутри «Проверка экранов моделью»
(`design.screens`).

```docdd-functional
{
  "added": {
    "capabilities": [
      {
        "id": "design.screens.mockups",
        "title": "Экраны: HTML-макеты из Claude Design",
        "parent": "design.screens",
        "summary": "Эталон экрана — HTML из Claude Design, привязанный к экрану карты пользовательских путей и подтверждаемый, как документ. Вкладка «Экраны» дизайна показывает его живым на нужной ширине и теме рядом со снимком реализации.",
        "status": "not_implemented",
        "priority": "should",
        "horizon": "now"
      },
      {
        "id": "design.screens.mockups.import",
        "title": "Импорт HTML-экрана",
        "parent": "design.screens.mockups",
        "summary": "HTML-файл или архив экспорта Claude Design кладётся в проект одним действием и сразу становится черновиком проектного документа экрана.",
        "status": "not_implemented"
      },
      {
        "id": "design.screens.mockups.view",
        "title": "Вкладка «Экраны»: живой макет",
        "parent": "design.screens.mockups",
        "summary": "Список экранов карты путей с состоянием макета; макет — в изолированном окне на 375/768/1280 и в светлой/тёмной теме, рядом — снимок реализации.",
        "status": "not_implemented"
      },
      {
        "id": "design.screens.mockups.checks",
        "title": "Сверка макета: экран, токены, эталон для проверки",
        "parent": "design.screens.mockups",
        "summary": "Макет без экрана в карте и цвета вне токенов — предупреждения; подтверждённый макет снимается в PNG и служит эталоном для Responsive и Pixel-Perfect.",
        "status": "not_implemented"
      }
    ]
  }
}
```

## Журнал

- 2026-10-26 · заведена черновиком · модель
