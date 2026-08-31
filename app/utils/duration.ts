/** «2 мин 22 с» — так, как это произносят вслух. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} с`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds === 0 ? `${minutes} мин` : `${minutes} мин ${seconds} с`;
}
