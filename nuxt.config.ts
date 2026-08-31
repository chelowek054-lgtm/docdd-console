export default defineNuxtConfig({
  compatibilityDate: '2026-08-30',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],

  // Приложение локальное: слушает localhost, аутентификации нет, потому что
  // нет удалённого доступа (docs/01-architecture.md, раздел «Безопасность»).
  devServer: { host: '127.0.0.1' },

  nitro: {
    storage: {
      // Список проектов — единственные собственные данные приложения.
      data: { driver: 'fs', base: './.data' }
    }
  },

  ui: {
    // Цвета по смыслу: нарушение — красное, предупреждение — жёлтое,
    // подтверждённое — зелёное. Дальше ими пользуются все экраны.
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral']
    }
  },

  app: {
    head: {
      title: 'DocDD Console',
      htmlAttrs: { lang: 'ru' }
    }
  }
});
