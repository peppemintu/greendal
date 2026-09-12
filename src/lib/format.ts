/** Turns a title into a url-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sept','oct','nov','dec'];

/** "sept 2" — the short form used in listings. */
export function shortDate(unix: number | null): string {
  if (!unix) return 'draft';
  const d = new Date(unix * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "sept 2, 2026" — the long form on a post page. */
export function longDate(unix: number | null): string {
  if (!unix) return 'unpublished';
  const d = new Date(unix * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "40 min", "2 hr 10 min", "2 days". */
export function duration(minutes: number | null): string {
  if (!minutes) return '—';
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
  return `${minutes} min`;
}

/** Reading time at a relaxed 200 wpm, minimum 1. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const VULGAR: Record<string, string> = {
  '0.25': '¼', '0.33': '⅓', '0.5': '½', '0.66': '⅔', '0.75': '¾',
};

/** 1.5 -> "1½", 0.5 -> "½", 200 -> "200". Keeps scaled amounts readable. */
export function prettyNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 100) / 100;
  const glyph = VULGAR[frac.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')] ?? VULGAR[String(frac)];
  if (glyph) return `${whole || ''}${glyph}`;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded % 1 === 0 ? String(rounded) : String(Math.round(rounded * 10) / 10);
}
