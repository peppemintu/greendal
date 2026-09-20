const ASPECT_RATIO = 162 / 700;
const VARIANT_COUNT = 4;

/** Deterministic, not Math.random() — this can render on the server and again
 *  during client hydration, and two different random picks for the same spot
 *  would show up as a hydration mismatch. Pass anything stable (a slug, a
 *  block id) and it always lands on the same variant for that thing. */
function pickVariant(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % VARIANT_COUNT) + 1;
}

/**
 * The hand-drawn rule that sits under the wordmark and post titles — a
 * transparent PNG (traced by hand, not the site's own SVG), tinted through a
 * CSS mask so the `color` prop still works: background-color painted through
 * a mask image is the only way to recolor a raster shape with CSS alone.
 *
 * Pass `hero` for the homepage wordmark's squiggle (always the same one).
 * Everywhere else, pass a stable `seed` (a post slug, a block id — anything
 * that won't change between renders) so the pick is one of the other four,
 * varied by context but reproducible.
 */
export function Squiggle({
  width = 300,
  color = 'var(--clay)',
  className,
  hero = false,
  seed = '',
}: {
  width?: number;
  color?: string;
  className?: string;
  hero?: boolean;
  seed?: string;
}) {
  const src = hero ? '/squiggles/squiggle-hero.webp' : `/squiggles/squiggle-${pickVariant(seed)}.webp`;
  const height = Math.round(width * ASPECT_RATIO);
  const mask = `url(${src}) left center / contain no-repeat`;

  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        width,
        height,
        maxWidth: '100%',
        backgroundColor: color,
        WebkitMask: mask,
        mask,
      }}
    />
  );
}
