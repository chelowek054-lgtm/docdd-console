import { useModelJobs } from '~/stores/modelJobs';

/**
 * После обновления страницы — вернуть задания к модели этой вкладки и подключиться к
 * идущим (ADR-0034). Только в браузере: на сервере `sessionStorage` нет.
 */
export default defineNuxtPlugin(() => {
  useModelJobs().restore();
});
