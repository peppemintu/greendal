import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** A "thought" — a normal blog post, body written in markdown. */
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  /** One-line teaser shown on the home page and index. */
  dek: text('dek'),
  body: text('body').notNull().default(''),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  /** Unix seconds. Drives ordering and the displayed date. */
  publishedAt: integer('published_at'),
  /** Optional "ps —" box at the foot of the post, pointing at a recipe. */
  psRecipeId: integer('ps_recipe_id'),
  psText: text('ps_text'),
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

/** Fixed-window counters for login attempts, registrations, comment posts, etc. */
export const rateLimits = sqliteTable('rate_limits', {
  /** e.g. "login:203.0.113.4" — caller decides the shape. */
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at').notNull(),
});

export type PostRow = typeof posts.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

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
