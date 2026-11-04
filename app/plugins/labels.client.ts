import { setLabelTranslator } from '~~/server/lib/labels';
import { tr } from '~/i18n/tr';

/**
 * Подписи чистых функций (`server/lib/labels.ts`) — на языке интерфейса. Только в браузере:
 * на сервере те же функции пишут файлы проекта, и там подпись остаётся русским исходником.
 */
export default defineNuxtPlugin(() => {
  setLabelTranslator((key, params) => {
    const text = tr(key, params);
    return text === key ? null : text;
  });
});
