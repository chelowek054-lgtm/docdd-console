import { tr } from '../i18n/tr';

/** Время задачи по журналу (ADR-0039): минуты, часы, а дольше суток — дни. */
export function spanLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return tr('tm.min', { n: minutes });
  if (minutes < 24 * 60) return tr('tm.hours', { n: Math.round((minutes / 60) * 10) / 10 });
  return tr('tm.days', { n: Math.round((minutes / 1440) * 10) / 10 });
}
/** «2 мин 22 с» — так, как это произносят вслух. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return tr('t83.m5.dur.sec', { n: total });
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds === 0 ? tr('t83.m5.dur.min', { m: minutes }) : tr('t83.m5.dur.minsec', { m: minutes, s: seconds });
}
