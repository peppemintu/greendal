import { sqliteTable, text, integer, index, check, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/** A "thought" — a normal blog post, built from Block[] (see the Block type below). */
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  /** One-line teaser shown on the home page and index. */
  dek: text('dek'),
  /** JSON: Block[] */
  blocks: text('blocks').notNull().default('[]'),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  /** Unix seconds. Drives ordering and the displayed date. */
  publishedAt: integer('published_at'),
  /** Set when archived from the admin — hidden everywhere public, but the row (and its comments) stay. */
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * A recipe. Ingredients and steps are JSON columns rather than markdown,
 * because the servings scaler needs the quantities as numbers.
 */
export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  intro: text('intro'),
  heroImage: text('hero_image'),
  handsOnMinutes: integer('hands_on_minutes'),
  totalMinutes: integer('total_minutes'),
  /** The servings the stored quantities are written for. */
  baseServings: integer('base_servings').notNull().default(2),
  /** Rendered as "{n} as dinner", "makes 1 loaf" etc. {n} is substituted. */
  yieldLabel: text('yield_label').notNull().default('{n} as dinner'),
  /** JSON: Ingredient[] */
  ingredients: text('ingredients').notNull().default('[]'),
  /** JSON: Step[] */
  steps: text('steps').notNull().default('[]'),
  /** The handwritten aside inside the ingredients panel. */
  pullNote: text('pull_note'),
  /** The "why this one" paragraph under the method. */
  headnote: text('headnote'),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  publishedAt: integer('published_at'),
  /** Set when archived from the admin — hidden everywhere public, but the row (and its comments) stay. */
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Free-form key/value for the about page, tagline, footer text. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * Accounts. There is exactly one `admin` (the blog's owner); everyone else
 * who registers is a `reader`. Guests (no row here) can read and nothing else.
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Lowercased, trimmed. Never shown publicly. */
  email: text('email').notNull().unique(),
  /** What shows under a comment. Not unique — two "Annas" is fine. */
  displayName: text('display_name').notNull(),
  /** "scrypt$N$r$p$saltBase64$hashBase64" — see hashPassword() in auth.ts. */
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'reader'] })
    .notNull()
    .default('reader'),
  /** null = address not confirmed yet; readers can't comment until then. */
  emailVerifiedAt: integer('email_verified_at'),
  /** Set by the admin. Distinct from archivedAt: this one isn't the user's choice. */
  blockedAt: integer('blocked_at'),
  /** Set by the user closing their own account. Row stays for recovery. */
  archivedAt: integer('archived_at'),
  notifyOnReply: integer('notify_on_reply').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Opaque server-side sessions — the cookie holds only this row's id, nothing
 * decodable. That way a ban or a role change takes effect on the next
 * request, not whenever a JWT happens to expire.
 */
export const sessions = sqliteTable('sessions', {
  /** 32 random bytes, base64url — this is the cookie's value. */
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
});

/** One-time tokens for email verification and password reset. */
export const authTokens = sqliteTable('auth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['verify_email', 'reset_password'] }).notNull(),
  /** SHA-256 of the token that went out in the email — the token itself isn't stored. */
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  createdAt: integer('created_at').notNull(),
});

/**
 * Weekly letter subscribers — a separate list from `users`, since reading
 * the blog and getting a weekly email are different commitments and most
 * subscribers will never register. `userId` links a subscription back to a
 * reader account when it was opted into from one (skips the confirm-email
 * step below, since that address is already verified); it's null for a
 * guest who only ever typed an email into the subscribe box.
 */
export const subscribers = sqliteTable('subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Lowercased, trimmed. The address mail actually goes to. */
  email: text('email').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  /** 'pending' only applies to the guest/email-box path — a reader toggling
   *  on goes straight to 'active', since their account email is already
   *  confirmed. */
  status: text('status', { enum: ['pending', 'active', 'unsubscribed'] })
    .notNull()
    .default('pending'),
  /** SHA-256 of the confirm-subscription token, null once confirmed. Not
   *  single-use — see confirmSubscription() for why (same reasoning as
   *  verify_email above: a mail scanner's link-prefetch shouldn't burn it
   *  before the person clicks). */
  confirmTokenHash: text('confirm_token_hash'),
  /**
   * The standing unsubscribe link's token, stored as-is — not hashed like
   * the auth tokens above. Those guard a sensitive action (proving control
   * of an account) with a token minted once and never needed again, so
   * hashing costs nothing. This one has to go out unchanged in every future
   * issue, which means either storing it in the clear or storing the hash
   * and losing the ability to reconstruct it — and unsubscribing is a
   * low-stakes, fully reversible action even if the link leaked, so there's
   * no real security given up by keeping it plain.
   */
  unsubscribeToken: text('unsubscribe_token').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  confirmedAt: integer('confirmed_at'),
  unsubscribedAt: integer('unsubscribed_at'),
});

/**
 * A record of each weekly letter actually sent — exists so the cron hitting
 * /api/newsletter/send twice in the same week (a retry, a misfire) is a
 * no-op rather than a duplicate mailing. One row per week that had posts to
 * recap; a quiet week with nothing published never gets a row and is simply
 * skipped, not recorded as "sent".
 */
export const newsletterSends = sqliteTable('newsletter_sends', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Unix seconds, Monday 00:00 UTC of the covered week. Unique — this is the idempotency key. */
  weekStart: integer('week_start').notNull().unique(),
  weekEnd: integer('week_end').notNull(),
  sentAt: integer('sent_at').notNull(),
  postCount: integer('post_count').notNull(),
  recipientCount: integer('recipient_count').notNull(),
});

/** Fixed-window counters for login attempts, registrations, comment posts, etc. */
export const rateLimits = sqliteTable('rate_limits', {
  /** e.g. "login:203.0.113.4" — caller decides the shape. */
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at').notNull(),
});

/**
 * Comments on a post or a recipe — exactly one of postId/recipeId is set
 * (enforced below), never both and never neither. No FK cascade to posts/
 * recipes: those are archived, not deleted (see design doc §5), so a
 * comment never needs to react to its parent disappearing out from under
 * it. See docs/design/users-comments-editor.md §4 for the full visibility
 * and moderation rules — src/lib/comments.ts implements them.
 */
export const comments = sqliteTable(
  'comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    postId: integer('post_id').references(() => posts.id),
    recipeId: integer('recipe_id').references(() => recipes.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    /** null = top-level. One level of nesting only — a reply's parentId always points at a top-level comment. */
    parentId: integer('parent_id').references((): AnySQLiteColumn => comments.id),
    /** Plain text, not HTML — see renderCommentBody() in src/lib/comments.ts. */
    body: text('body').notNull(),
    visibility: text('visibility', { enum: ['public', 'private'] })
      .notNull()
      .default('public'),
    status: text('status', { enum: ['visible', 'hidden', 'deleted'] })
      .notNull()
      .default('visible'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    editedAt: integer('edited_at'),
  },
  (table) => [
    check(
      'comments_exactly_one_parent',
      sql`(${table.postId} is not null and ${table.recipeId} is null) or (${table.postId} is null and ${table.recipeId} is not null)`,
    ),
    index('comments_post_created_idx').on(table.postId, table.createdAt),
    index('comments_recipe_created_idx').on(table.recipeId, table.createdAt),
    index('comments_author_idx').on(table.authorId),
    index('comments_parent_idx').on(table.parentId),
  ],
);

export type PostRow = typeof posts.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type SubscriberRow = typeof subscribers.$inferSelect;

export type Ingredient = {
  /** null means "no number" — e.g. "flaky salt, to taste". */
  qty: number | null;
  /** "g", "ml", "" for countable things like leeks. */
  unit: string;
  name: string;
  /** Quantities that shouldn't multiply with servings (a pinch of salt). */
  fixed?: boolean;
};

export type Step = {
  /** Bold lead-in, e.g. "Clean them properly." */
  lead: string;
  text: string;
};

/**
 * A post's content, block by block. `id` is a short random string, stable
 * across saves — used as the React key and as the drag-and-drop identity,
 * so it must survive edits to the block's own content.
 */
export type Block =
  | { id: string; type: 'text'; markdown: string }
  | { id: string; type: 'heading'; text: string; level: 2 | 3 }
  | {
      id: string;
      type: 'image';
      url: string;
      alt: string;
      caption?: string;
      width?: 'column' | 'wide' | 'full';
    }
  | { id: string; type: 'divider'; style?: 'rule' | 'squiggle' | 'dots' }
  | { id: string; type: 'ps'; text: string; recipeId?: number | null };
