import { getCurrentUser } from '@/lib/auth';
import { isReaderSubscribed } from '@/lib/newsletter';
import { toggleReaderSubscription } from '@/lib/subscriberActions';
import { NewsletterSubscribeForm } from './NewsletterSubscribeForm';
import { NewsletterTooltip } from './NewsletterTooltip';
import styles from './NewsletterSubscribeBox.module.css';

const TOOLTIP_TEXT = 'A short letter once a week, recapping whatever got posted. Unsubscribe anytime.';

/**
 * A guest or a reader who hasn't confirmed their email yet gets the plain
 * email-box (subscribeToNewsletter double-opts them in by mail). A reader
 * whose email is already confirmed skips that — their address is already
 * proven, so this is just a toggle against the account they're signed into.
 * The admin doesn't need to subscribe to their own blog, so sees neither.
 */
export async function NewsletterSubscribeBox() {
  const user = await getCurrentUser();
  if (user?.role === 'admin') return null;

  if (user && user.emailVerifiedAt) {
    const subscribed = await isReaderSubscribed(user.email);
    return (
      <span className={styles.wrap}>
        <form action={toggleReaderSubscription}>
          <input type="hidden" name="subscribe" value={subscribed ? 'false' : 'true'} />
          <button
            type="submit"
            className={subscribed ? styles.toggleButtonActive : styles.toggleButton}
          >
            {subscribed ? 'subscribed ✓' : 'subscribe'}
          </button>
        </form>
        <NewsletterTooltip text={TOOLTIP_TEXT} />
      </span>
    );
  }

  return <NewsletterSubscribeForm />;
}
