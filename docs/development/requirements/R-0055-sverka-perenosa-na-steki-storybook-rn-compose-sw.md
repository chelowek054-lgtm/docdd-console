---
id: R-0055
type: requirement
title: 'Сверка переноса на стеки: Storybook RN, Compose, SwiftUI'
status: approved
created: 2026-10-20
updated: 2026-10-20
---

# Сверка переноса на стеки: Storybook RN, Compose, SwiftUI

Для каждого объявленного стека проекта консоль проверяет, что каждый компонент контракта в каждом состоянии имеет историю или превью (Storybook React Native, Compose @Preview/Showkase, SwiftUI Previews) — design_story_missing, и что свойства совпадают с контрактом — design_contract_drift. Каталоги читаются из выгрузок CI проекта. Готово, когда на экране видна матрица «компонент × состояние × стек» и правила срабатывают на образце.

## Журнал

- 2026-10-20 · заведена из docs/inbox/storybook-kak-kontrakt-komponentov-pri-perenose.md · приложение
- 2026-10-20 · на подтверждение · architect
- 2026-10-20 · подтверждён · architect
