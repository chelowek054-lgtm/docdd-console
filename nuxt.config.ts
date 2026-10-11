import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-30',
  modules: ['@nuxt/ui', '@pinia/nuxt'],

  // Приложение локальное и работает без сети. @nuxt/fonts при старте ходит за
  // шрифтами к внешним провайдерам; если сеть их не отдаёт (ECONNRESET), рабочий
  // процесс vite-node падает и каждая страница отвечает 500 «IPC connection
  // closed». Поэтому внешние провайдеры отключены — шрифт берётся системный.
  fonts: {
    providers: {
      adobe: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      google: false,
      googleicons: false
    }
  },

  css: ['~/assets/css/main.css'],

  // Приложение локальное: слушает localhost, аутентификации нет, потому что
  // нет удалённого доступа (docs/01-architecture.md, раздел «Безопасность»).
  devServer: { host: '127.0.0.1' },

  vite: {
    // Серверной сборке Vite свой WebSocket не нужен: клиентский HMR висит на
    // основном сервере, а серверный код обновляет vite-node. Порт ему Nuxt берёт
    // через get-port-please, и тот первым пробует $PORT — тогда WebSocket
    // занимает [::]:PORT, а localhost (::1) получает 426 Upgrade Required.
    $server: { server: { ws: false } }
  },

  nitro: {
    // Шаблоны запросов лежат в docs/prompts и попадают в сборку оттуда же:
    // второй копии в server/assets не заводим, спорить о запросе нужно в дифф.
    serverAssets: [{
      baseName: 'prompts',
      dir: fileURLToPath(new URL('./docs/prompts', import.meta.url))
    }],
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
