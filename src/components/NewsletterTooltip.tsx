import styles from './NewsletterSubscribeBox.module.css';

/** CSS-only (hover/focus) — the widget it sits in stays a plain server-rendered form otherwise. */
export function NewsletterTooltip({ text }: { text: string }) {
  return (
    <span className={styles.tooltipWrap}>
      <button type="button" className={styles.tooltipTrigger} aria-describedby="newsletter-tooltip" title={text}>
        ?
      </button>
      <span role="tooltip" id="newsletter-tooltip" className={styles.tooltipBubble}>
        {text}
      </span>
    </span>
  );
}
