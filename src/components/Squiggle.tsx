/** The hand-drawn rule that sits under the wordmark and post titles. */
export function Squiggle({
  width = 300,
  color = 'var(--clay)',
  className,
}: {
  width?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={14}
      viewBox="0 0 300 14"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{ maxWidth: '100%' }}
    >
      <path
        d="M3 9c25-8 50 4 75-1s50-9 75-2 47 8 72 3 72-6 72-6"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
