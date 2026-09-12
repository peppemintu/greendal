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

export type PostRow = typeof posts.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;

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
