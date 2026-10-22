import { tr } from '../i18n/tr';
/** «2 мин 22 с» — так, как это произносят вслух. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return tr('t83.m5.dur.sec', { n: total });
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds === 0 ? tr('t83.m5.dur.min', { m: minutes }) : tr('t83.m5.dur.minsec', { m: minutes, s: seconds });
}
