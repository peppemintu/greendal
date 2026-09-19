/**
 * Applies migrations, then fills the tables with the content from the design
 * mockup, so a fresh clone has something to look at. Safe to re-run: it
 * clears first.
 *
 *   node scripts/seed.mjs
 *
 * Table creation used to be duplicated here as hand-written SQL, separate
 * from src/lib/schema.ts. It drifted from what drizzle-kit generates (a
 * `UNIQUE` column vs. a named unique index) — harmless on its own, but it's
 * exactly the kind of difference `drizzle-kit push` "fixes" by recreating
 * the table. Migrations are the one place table shape gets defined now.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'greendal.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma('journal_mode = WAL');

migrate(drizzle(db), { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });

const RESET = process.argv.includes('--reset') || true;
if (RESET) {
  db.exec('DELETE FROM posts; DELETE FROM recipes; DELETE FROM settings;');
}

const now = Math.floor(Date.now() / 1000);
const at = (iso) => Math.floor(Date.parse(iso) / 1000);

const insertRecipe = db.prepare(`
INSERT INTO recipes (slug, title, intro, hero_image, hands_on_minutes, total_minutes,
  base_servings, yield_label, ingredients, steps, pull_note, headnote, status,
  published_at, created_at, updated_at)
VALUES (@slug, @title, @intro, @hero_image, @hands_on_minutes, @total_minutes,
  @base_servings, @yield_label, @ingredients, @steps, @pull_note, @headnote, 'published',
  @published_at, ${now}, ${now})
`);

const leeks = insertRecipe.run({
  slug: 'braised-leeks-no-fuss',
  title: 'braised leeks, no fuss',
  intro:
    "Dinner that cooks itself while you're in another room. Good with bread, better with an egg on top.",
  hero_image: null,
  hands_on_minutes: 10,
  total_minutes: 40,
  base_servings: 2,
  yield_label: '{n} as dinner',
  ingredients: JSON.stringify([
    { qty: 4, unit: '', name: 'leeks, trimmed' },
    { qty: 30, unit: 'g', name: 'good butter' },
    { qty: 200, unit: 'ml', name: 'chicken or veg stock' },
    { qty: 3, unit: '', name: 'sprigs of thyme' },
    { qty: 0.5, unit: '', name: 'lemon' },
    { qty: null, unit: '', name: 'flaky salt, to taste' },
  ]),
  steps: JSON.stringify([
    {
      lead: 'Clean them properly.',
      text: 'Halve the leeks lengthways, rinse the grit out from between the layers, and pat them properly dry — wet leeks steam, dry leeks brown.',
    },
    {
      lead: 'Get real colour on them.',
      text: 'Melt the butter in a wide pan. Lay the leeks cut-side down in one layer and leave them alone until deeply gold.',
    },
    {
      lead: 'Then leave it alone.',
      text: 'Stock halfway up, tuck in the thyme, cover and turn it down. Twenty-five minutes. Go do something else.',
    },
    {
      lead: 'Finish sharp.',
      text: "Lid off, heat up, reduce to something glossy. Lemon, salt, and eat straight from the pan if that's the kind of evening it is.",
    },
  ]),
  pull_note: 'use the good butter',
  headnote:
    'I learned this from a flatmate who cooked exactly four things and cooked them beautifully. She never measured the stock. Neither should you, really — the numbers up there are a kindness, not a rule.',
  published_at: at('2026-09-01T18:00:00Z'),
});

insertRecipe.run({
  slug: 'cold-noodles-for-hot-flats',
  title: 'cold noodles for hot flats',
  intro: 'For the evenings when turning on the hob feels like an act of self-harm.',
  hero_image: null,
  hands_on_minutes: 15,
  total_minutes: 15,
  base_servings: 2,
  yield_label: '{n} as dinner',
  ingredients: JSON.stringify([
    { qty: 200, unit: 'g', name: 'wheat noodles' },
    { qty: 3, unit: 'tbsp', name: 'sesame paste' },
    { qty: 2, unit: 'tbsp', name: 'light soy' },
    { qty: 1, unit: 'tbsp', name: 'black vinegar' },
    { qty: 1, unit: '', name: 'cucumber, shredded' },
    { qty: null, unit: '', name: 'chilli oil, as much as you dare' },
  ]),
  steps: JSON.stringify([
    { lead: 'Boil, then shock.', text: 'Cook the noodles, then run them under cold water until they squeak. This is the whole trick.' },
    { lead: 'Loosen the paste.', text: 'Sesame paste seizes. Add the soy and vinegar a spoon at a time, whisking, until it pours.' },
    { lead: 'Toss and top.', text: 'Sauce, noodles, cucumber, chilli oil. Eat standing at the window.' },
  ]),
  pull_note: 'colder than you think',
  headnote: null,
  published_at: at('2026-08-18T18:00:00Z'),
});

insertRecipe.run({
  slug: 'the-loaf-i-finally-got-right',
  title: 'the loaf I finally got right',
  intro: 'Two days of doing almost nothing, and then bread.',
  hero_image: null,
  hands_on_minutes: 30,
  total_minutes: 2880,
  base_servings: 1,
  yield_label: '{n} loaf',
  ingredients: JSON.stringify([
    { qty: 500, unit: 'g', name: 'strong white flour' },
    { qty: 350, unit: 'ml', name: 'water' },
    { qty: 100, unit: 'g', name: 'active starter' },
    { qty: 10, unit: 'g', name: 'salt' },
  ]),
  steps: JSON.stringify([
    { lead: 'Mix and wait.', text: 'Flour and water only. Leave it an hour so the flour drinks.' },
    { lead: 'Add the rest.', text: 'Starter, then salt. Fold four times over the next two hours.' },
    { lead: 'Shape and chill.', text: 'Shape, into the banneton, into the fridge overnight. Overnight is not negotiable.' },
    { lead: 'Bake hot, covered.', text: '250°C in a covered pot for 20 minutes, lid off for 20 more.' },
  ]),
  pull_note: 'cold dough scores better',
  headnote: null,
  published_at: at('2026-07-28T18:00:00Z'),
});

insertRecipe.run({
  slug: 'burnt-honey-ice-cream',
  title: 'burnt honey ice cream',
  intro: 'Take the honey further than feels sensible. That is the recipe.',
  hero_image: null,
  hands_on_minutes: 25,
  total_minutes: 60,
  base_servings: 4,
  yield_label: '{n} scoops, roughly',
  ingredients: JSON.stringify([
    { qty: 150, unit: 'g', name: 'honey' },
    { qty: 400, unit: 'ml', name: 'double cream' },
    { qty: 200, unit: 'ml', name: 'whole milk' },
    { qty: 5, unit: '', name: 'egg yolks' },
    { qty: 2, unit: 'g', name: 'salt', fixed: true },
  ]),
  steps: JSON.stringify([
    { lead: 'Burn it.', text: 'Honey in a dry pan until it smells like caramel and smoke. One shade past comfortable.' },
    { lead: 'Stop it with cream.', text: 'Off the heat, pour in the cream. It will spit. Stand back.' },
    { lead: 'Make the custard.', text: 'Temper the yolks, back to the pan, 82°C, strain.' },
    { lead: 'Chill, then churn.', text: 'Properly cold before it goes near the machine.' },
  ]),
  pull_note: 'past comfortable',
  headnote: null,
  published_at: at('2026-07-10T18:00:00Z'),
});

const insertPost = db.prepare(`
INSERT INTO posts (slug, title, dek, body, status, published_at, ps_recipe_id, ps_text, created_at, updated_at)
VALUES (@slug, @title, @dek, @body, 'published', @published_at, @ps_recipe_id, @ps_text, ${now}, ${now})
`);

insertPost.run({
  slug: 'a-small-case-for-boring-weeks',
  title: 'a small case for boring weeks',
  dek: 'nothing happened and I think that was the whole point of it.',
  body: `Nothing happened this week. I keep waiting to feel bad about that, and the feeling hasn't turned up yet, so I'm writing it down before it does.

Monday I moved a plant eighteen inches to the left. Wednesday the good bread was still warm. Thursday I read the same page four times and then went to bed at nine like a person with nothing to prove. This is the whole report.

> A week with nothing in it is not an empty week. It's a week you get to keep.

I think the trouble is that we've been taught to file weeks like receipts — proof of something, in case anyone asks. Nobody asks. And when they do, "it was quiet" is a complete answer, delivered by someone who slept.`,
  published_at: at('2026-09-02T20:00:00Z'),
  ps_recipe_id: leeks.lastInsertRowid,
  ps_text: 'I braised leeks twice this week, which is the closest thing to news.',
});

insertPost.run({
  slug: 'my-grandmothers-handwriting',
  title: "my grandmother's handwriting",
  dek: "found a box of her recipe cards and couldn't read a single measurement.",
  body: `The box was in the loft, under a bag of curtain rings nobody has ever needed.

Forty cards, maybe more. Her hand slopes hard to the right and abbreviates everything, so a card for what I'm fairly sure is a fruit cake reads, in full: *butter, sug, 3 eg, the usual flour, bake til done.*

Til done. As if the cake and I have an understanding.

I've been treating this as a problem to solve — decode the shorthand, restore the measurements, produce a proper recipe. But the shorthand is the recipe. She wrote these for someone who had already watched her make it, which is to say she wrote them for herself, and I am reading someone else's private notes and complaining they aren't a manual.`,
  published_at: at('2026-08-24T20:00:00Z'),
  ps_recipe_id: null,
  ps_text: null,
});

insertPost.run({
  slug: 'on-leaving-the-house-at-six',
  title: 'on leaving the house at six',
  dek: 'the city belongs to bakers and dogs and nobody tells you.',
  body: `At six the streets are wet even when it hasn't rained, and there are exactly three kinds of people out: bakers, dog owners, and men in hi-vis standing near a hole with real authority.

Nobody at that hour is performing. The performing starts at eight. Between six and eight the city is just doing its maintenance in public, unembarrassed, and you can walk through the middle of it like a ghost with a coffee.

I have not managed this more than four times in my life and every one of them is still sitting in my head, fully lit.`,
  published_at: at('2026-08-11T20:00:00Z'),
  ps_recipe_id: null,
  ps_text: null,
});

insertPost.run({
  slug: 'what-repotting-everything-taught-me',
  title: 'what repotting everything taught me',
  dek: 'mostly that I had been keeping eleven plants in a state of polite emergency.',
  body: `I did all of them in one afternoon, which was a mistake, and I would do it that way again.

Nine of the eleven were root-bound. Not dying — worse than dying, holding steady. Each one had made a dense white knot of itself in the shape of a container I had chosen for it in a shop, years ago, for no reason at all.

There is an obvious metaphor here and I'm going to leave it alone. What I actually want to say is more boring: the plants got bigger pots and, within three weeks, took them. They weren't waiting for better light or a feeding schedule or my attention. They were waiting for room.`,
  published_at: at('2026-07-30T20:00:00Z'),
  ps_recipe_id: null,
  ps_text: null,
});

const setSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

setSetting.run(
  'tagline',
  "a small place for whatever I'm turning over this week, and for the food that got made while I turned it over. come in, take your shoes off.",
);
setSetting.run('footerNote', 'come in, take your shoes off.');
setSetting.run('aboutTitle', 'who is doing all this');
setSetting.run(
  'aboutBody',
  `This is a blog kept by one person, mostly at the kitchen table.

There are two things on it. **Thoughts** are whatever I've been turning over — usually short, usually not about anything important. **Recipes** are the food that got made while I was turning it over. Every recipe has a dial for how many people turned up, because that is the number that actually changes.

Nothing here is advice. If you write back, I'll read it.`,
);

console.log('Seeded:', db.prepare('SELECT COUNT(*) c FROM posts').get().c, 'posts,',
  db.prepare('SELECT COUNT(*) c FROM recipes').get().c, 'recipes.');
