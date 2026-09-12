/** Unix seconds -> the "YYYY-MM-DDTHH:mm" string an <input type="datetime-local"> wants. */
export function toLocalInput(unix: number | null): string {
  if (!unix) return '';
  return new Date(unix * 1000).toISOString().slice(0, 16);
}
