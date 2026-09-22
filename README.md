# greendal

A personal blog with two kinds of writing on it — *thoughts* (ordinary posts) and
*recipes* (which carry structured ingredients so the page can scale them to however
many people turned up). Everything is written from a small admin at `/admin`; there
are no markdown files to commit.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router | Server-rendered pages so posts have real URLs, real `<title>`/OG tags, and an RSS feed |
| Database | SQLite via better-sqlite3 + Drizzle | One file, no daemon. See [Backups](#backups) |
| UI primitives | Radix Primitives (Dialog, ToggleGroup) | Unstyled, so they don't fight the design. Radix *Themes* is deliberately not used |
| Styling | CSS Modules + custom properties | The design is bespoke; a utility framework would be noise |
| Auth | DB-backed sessions, `scrypt` passwords | One admin, any number of readers. See [Accounts & email](#accounts--email) |
| Editor | A block editor for thoughts, a structured form for recipes | Recipe quantities have to stay numeric for the scaler; posts are freer-form, so they're built from typed blocks instead |

## Running it

```bash
npm install
cp .env.example .env.local          # then edit it — see below
node scripts/seed.mjs               # optional: fills the DB with sample content
node scripts/create-admin.mjs       # creates your admin account from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                         # http://localhost:3000
```

`.env.local` needs, at minimum:

```
DATABASE_PATH=./data/greendal.db
SITE_URL=http://localhost:3000
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<at least 10 characters>
```

`EMAIL_PROVIDER` defaults to `console` — registration and password-reset links get printed to the
terminal instead of emailed, which is all local dev needs. See
[Accounts & email](#accounts--email) for what a real deployment needs on top of this.

Sign in at `/login` — the same form for the admin and for readers; it sends you to `/admin` or
back to wherever you came from, depending on the account.

## Running it with Docker

```bash
cp .env.example .env             # then edit it — same values as above
docker compose up -d --build
docker compose exec app node scripts/create-admin.mjs   # creates your admin account
docker compose exec app node scripts/seed.mjs           # optional: sample content too
```

The app listens on `127.0.0.1:3000` on the host (not exposed to the LAN/internet
directly — see the tunnel section below). `data/` and `public/uploads/` are bind-mounted
from the repo root, so they survive rebuilds; see [Backups](#backups) for keeping copies
elsewhere too. `create-admin.mjs` applies migrations itself (same as `seed.mjs`), so either
one alone is enough to get the tables created — run `create-admin.mjs` at least, since
without it there's no way to sign in.

To rebuild after pulling: `docker compose up -d --build`.

## Schema changes

`src/lib/schema.ts` is the source of truth; nothing else defines table shape (see
[Backups](#backups) for why that matters — `scripts/seed.mjs` used to have its own copy
of the `CREATE TABLE` statements, and the two drifted apart).

```bash
# after editing schema.ts:
npm run db:generate      # writes a new drizzle/NNNN_*.sql — read it before committing
git add drizzle/ src/lib/schema.ts
git commit -m "..."
```

Commit the generated SQL file along with the schema change. On deploy, `deploy.yml` runs
`drizzle-kit migrate`, which applies whatever migration files haven't been applied yet, in
order, and nothing else — no live diffing, no prompts, no guessing at intent. Locally,
`npm run db:migrate` does the same against your `DATABASE_PATH`.

## Accounts & email

Three kinds of visitor: **guests** (no account, read-only), **readers** (registered, can
comment — see [`docs/design/users-comments-editor.md`](docs/design/users-comments-editor.md) for
the full design), and **admin** (you — one account, created by `create-admin.mjs`, not through
`/register`).

Sessions are opaque random tokens in the `sessions` table, not JWTs — a ban or a role change
takes effect on the very next request instead of waiting for a token to expire. Passwords are
`scrypt` with a per-account salt. `middleware.ts` only checks that *some* session cookie is
present (it runs on the Edge runtime, which can't reach the database) — the actual check is
`getCurrentUser()` in `src/lib/auth.ts`, called by every page and action that needs to know who's
asking. Admin-only actions call `requireAdmin()` themselves too, not just the `/admin` layout —
a reader has a valid session cookie same as an admin does, so cookie-presence alone stopped being
enough to gate `/admin` once readers existed.

Registration is open, which means **outgoing email is required** for it to work for real — a
reader has to confirm their address before they can comment, and password reset needs somewhere
to send the link. `EMAIL_PROVIDER=console` (the default) logs mail to stdout instead, which is
fine for local dev but not for a real deployment.

To send real mail via [Resend](https://resend.com) (free tier is generous for a blog):

1. Create a Resend account, add your domain under *Domains*.
2. It shows you 3–4 DNS records (DKIM, SPF, usually an MX) — add them in Cloudflare exactly as
   shown. They'll be on a subdomain like `send.yourdomain.example`, so they won't collide with
   anything already on the root domain (including Cloudflare Email Routing, if you use that for a
   separate `you@yourdomain.example` inbox — that's unrelated to sending and entirely optional).
   If Resend gives you a `CNAME`, set it to "DNS only" (grey cloud) in Cloudflare — a proxied
   CNAME doesn't work for mail.
3. Click *Verify* in Resend once the records are saved — with Cloudflare this is usually
   seconds, not the hours other DNS hosts can take.
4. Create an API key (*Sending access* is enough) and set in `.env`:
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   EMAIL_FROM=greendal <no-reply@yourdomain.example>
   ```
5. Make sure `SITE_URL` is the real public URL, not `localhost` — it's what verification and
   reset links are built from.

A `_dmarc` TXT record (`v=DMARC1; p=none; rua=mailto:you@example.com`) isn't required but helps
deliverability, and `p=none` mode can't break anything — it only asks for reports, not enforcement.

## Comments

Verified readers can comment on posts and recipes, one level of replies deep, public by default
with an opt-in "only for the blog's author" toggle. The visibility rules (who sees what, who can
flip what private/public, why a hidden comment isn't quite the same thing as a deleted one) are
worked out in full in
[`docs/design/users-comments-editor.md`](docs/design/users-comments-editor.md) §4 — read that
before touching `src/lib/comments.ts` or `src/lib/commentActions.ts`, the rules have sharper edges
than they look.

A few things worth knowing if you're extending this:

- **Comment bodies are plain text, never HTML.** `CommentBody` builds React elements directly from
  the string (auto-escaped by JSX) and only turns `http(s)://` substrings into `<a rel="nofollow
  ugc noopener">` links — there's no `dangerouslySetInnerHTML`, no HTML string ever gets
  constructed from what a reader typed. If comments ever grow markdown support, that's a
  sanitiser-adding project, not a find-and-replace.
- **Nothing is deleted from the database.** A "deleted" comment is a status flag, not a removed
  row — same principle as accounts, posts, and recipes elsewhere in this project.
- **`ThreadNode` (from `getCommentThread()`) carries precomputed permissions** — `canEditNow`,
  `canDelete`, `canModerate`, `visibilityAction` — so the UI never has to re-derive (or trust) a
  permission check against a stale clock or role. The actual server actions in
  `commentActions.ts` re-verify everything themselves regardless; the precomputed fields are for
  deciding what buttons to show, not a substitute for that.
- **`/admin/comments`** is the moderation feed (filter by visibility/status/target, reply inline,
  hide/unhide, delete). **`/admin/readers`** lists registered readers with block/unblock and
  restoring a closed account.

## Post editor

A thought's content lives in `posts.blocks` — a JSON array of typed blocks, the same pattern
recipes already use for `ingredients`/`steps`. The type (`src/lib/schema.ts`):

```ts
type Block =
  | { id: string; type: 'text';    markdown: string }
  | { id: string; type: 'heading'; text: string; level: 2 | 3 }
  | { id: string; type: 'image';   url: string; alt: string; caption?: string;
                                    width?: 'column' | 'wide' | 'full' }
  | { id: string; type: 'divider'; style?: 'rule' | 'squiggle' | 'dots' }
  | { id: string; type: 'ps';      text: string; recipeId?: number | null };
```

`src/components/PostEditor.tsx` edits that array in place at `/admin/thoughts/[id]`, styled to
look like the real page rather than a form; `src/components/BlockRenderer.tsx` renders the same
blocks read-only, shared between the public post page, the editor's preview toggle, and (via
`src/lib/blocks.ts`) the RSS feed. A few things worth knowing:

- **Blocks reorder by drag (`@dnd-kit/core`) or the ↑/↓ buttons in each block's `⋯` menu** — the
  buttons are the fallback for touch/keyboard, not an afterthought, so don't remove them if you
  touch the drag code.
- **`Cmd/Ctrl+Enter`** adds a new text block below the current one and focuses it;
  **`Backspace`** at the start of an empty block deletes it and lands the cursor at the end of the
  previous one; **`Cmd/Ctrl+S`** saves. All three are wired through `data-block-id` attributes and
  a `focusRequest` effect in `PostEditor.tsx` — if you add a block type with its own text field,
  give its input/textarea a `data-block-id` and route its `onKeyDown` through the same handler or
  the shortcuts silently won't reach it.
- **The very first block of a brand-new post gets its id from `useId()`, not `Math.random()`.**
  That state is part of the initial render, which runs once on the server and once again during
  client hydration — two calls to `Math.random()` would produce two different ids for the same
  DOM node, and every later id-based lookup (drag-and-drop, the keyboard shortcuts above) would
  silently miss. Every block created after mount (inserted, duplicated) is client-only and can use
  the plain `randomId()` helper safely.
- **Autosaves to the server every ~20s** if anything changed, via a separate `autosavePost` action
  that returns instead of redirecting (unlike the explicit `savePost` action, which redirects to
  the list on success — that would throw you out of the editor mid-autosave). The first autosave of
  a new post creates its row and the client adopts the new id, so later autosaves become updates.
  A debounced copy also goes to `localStorage`; if a tab dies before its next autosave, reopening
  the same editor offers a "restore?" banner. Both are cleared once the server actually has the
  latest content.
- **Image uploads go through `/api/upload`** (admin-only), which now runs everything but animated
  GIFs through `sharp`: resized to 1600px on the long side and recoded to webp at quality 82 by
  default, or full resolution at quality 95 with the "upload original" checkbox. EXIF is stripped
  in both modes — a phone photo's GPS coordinates have no business on a public site — after an
  auto-rotate so orientation survives the strip. Files still land on disk under `public/uploads/`,
  but they're **served through `src/app/uploads/[filename]/route.ts`**, not Next's static
  handling for `public/` — `next start` indexes that folder once at boot and doesn't notice files
  written there afterward, so an upload against an already-running server would silently 404 until
  the next restart. The route handler re-reads the filesystem on every request instead.
- **Posts and recipes archive, they don't delete.** `archivedAt` on both tables; every public query
  filters it out, `/admin/thoughts` and `/admin/recipes` show an `archive` filter tab with a
  `restore` button, and the confirmation dialog says what actually happens ("disappears from the
  site but stays in the archive") rather than implying data loss.

## Weekly letter

A subscribe box sits next to the "· a blog" line on the home page. A guest, or a reader who
hasn't confirmed their email yet, gets a plain email field (double opt-in — confirming is a
separate click from an emailed link, same pattern as registering). A reader whose email is
already confirmed gets a subscribe/unsubscribe toggle instead, bound to their account — no second
email round-trip, since that address is already proven.

Once a week, everyone with an active subscription gets a plain-text letter recapping whatever
posts went out that week. **The app schedules itself** — `src/instrumentation.ts` starts an hourly
check when the server process boots (`next start`, in Docker, stays running — nothing serverless
here to kill a timer between requests) and calls `sendWeeklyIssueIfDue()` each time. That's
idempotent per calendar week (`newsletter_sends` tracks what's already gone out via a unique
`weekStart`), so checking far more often than needed is harmless — the other 167 checks a week are
two cheap `SELECT`s that no-op. No cron expression, no host-level scheduling, nothing to reconfigure
if you move this to a different machine. `src/lib/newsletter.ts` is where the real logic lives
(week-bounds math, building the issue, the idempotent send) if you want to read it before touching
any of this.

**The subject line and the intro paragraph are yours to write**, at `/admin/newsletter` — same
`settings` table tagline/footerNote/aboutBody already use. The list of that week's posts is always
generated fresh underneath whatever you write there; that page also shows a live preview of what's
accumulated so far this week, and a short history of what's actually gone out.

A week with nothing published in it is skipped silently — no "sorry, nothing happened" letter.

**`POST /api/newsletter/send`** still exists, guarded by `NEWSLETTER_CRON_SECRET` — it's not needed
for the weekly send itself, but it's there as a manual trigger: force a send right now, or confirm
the scheduled check is actually alive. It's just as idempotent as the automatic path, so calling it
is always safe:

```
curl -X POST https://yourdomain.example/api/newsletter/send -H "Authorization: Bearer YOUR_SECRET"
```

## Putting it behind a Cloudflare Tunnel

This avoids opening any port on the router — cloudflared makes an outbound connection to
Cloudflare, which proxies your domain to it. Since the app is bound to `127.0.0.1:3000`,
nothing is reachable except through the tunnel.

1. **Add the domain to Cloudflare** (if not already): Cloudflare dashboard → *Add a
   site* → pick the free plan → update your registrar's nameservers to the two
   Cloudflare gives you. Wait for the zone to go active.
2. **Create the tunnel**: dashboard → *Zero Trust* → *Networks* → *Tunnels* → *Create a
   tunnel* → *Cloudflared* → name it (e.g. `greendal`). This gives you a tunnel token.
3. **Route it to your hostname**: in the tunnel's *Public Hostname* tab, add
   `yourdomain.example` (or a subdomain) → service `HTTP://app:3000` if you run
   cloudflared from the compose file below (it talks to `app` over the compose network),
   or `HTTP://localhost:3000` if you run cloudflared directly on the host instead.
4. **Run cloudflared**: put the token in `.env` as `CLOUDFLARE_TUNNEL_TOKEN`, then
   uncomment the `cloudflared` service in `docker-compose.yml` and
   `docker compose up -d`. (Alternative: install `cloudflared` on the host and run
   `cloudflared service install <token>` instead of running it in Docker — either works,
   just keep the hostname target in step 3 consistent with which one you pick.)
5. **Set `SITE_URL`** in `.env` to `https://yourdomain.example` — it's used for RSS and
   OG tags, so it needs to match the public hostname, not `localhost`.

No port forwarding, no dynamic DNS, no certificate to manage — Cloudflare terminates TLS
for you. The tradeoff: your domain's traffic and DNS live behind Cloudflare's proxy.

## CI: auto-deploy on push to `main`

`.github/workflows/deploy.yml` redeploys automatically on every push to `main`, via a
self-hosted GitHub Actions runner on the same machine that serves the site. GitHub can't
reach into your home network to push a deploy, so the runner does the opposite: it polls
GitHub for work, which needs no open ports.

**One-time setup, on the machine that will run the site:**

1. GitHub repo → *Settings* → *Actions* → *Runners* → *New self-hosted runner*, pick
   your OS/arch, and run the download + config commands it shows you. Point the checkout
   folder it creates at wherever you want the live deployment to live (this becomes the
   directory `docker compose` runs from).
2. Install it as a service so it survives reboots and stays running unattended:
   `sudo ./svc.sh install && sudo ./svc.sh start` (Linux; the runner's docs show the
   equivalent for other OSes).
3. In that same directory, do the one-time Docker setup from above —
   `cp .env.example .env`, fill it in — once. The workflow checks for `.env` and fails
   loudly if it's missing rather than silently deploying a broken container; it never
   writes `.env` itself, so secrets never pass through CI logs.

After that, every push to `main` (including a merged PR) rebuilds the image, restarts the
container, snapshots the database, applies pending migrations (see
[Schema changes](#schema-changes)), smoke-tests `http://127.0.0.1:3000/`, and prunes old
images. `data/` and `public/uploads/` are gitignored and untouched by the checkout
(`clean: false` keeps it that way), so real content survives every deploy.

`deploy.yml` used to run `drizzle-kit push` here instead — it diffs the live database
against `schema.ts` and applies whatever it thinks reconciles them, which for SQLite can
mean recreating a table (copy data out, drop, recreate, copy back in). The first
automated deploy did exactly that and silently dropped the sample posts, because
`scripts/seed.mjs` had created `posts` slightly differently than `schema.ts` describes
(an inline `UNIQUE` column vs. a named index) — a difference `push` "fixes" by rebuilding
the table, non-interactively, without asking. Migrations don't have this failure mode:
the SQL that runs is exactly the SQL that was reviewed and committed, nothing inferred at
deploy time.

## Backups

`.github/workflows/backup.yml` runs daily (03:00 UTC) on the same self-hosted runner and
writes into `backups/` (gitignored, sits next to `data/`):
- `greendal-<timestamp>.db` — a copy of the database
- `uploads-<timestamp>.tar.gz` — a tarball of `public/uploads/`

It keeps the last 14 of each and deletes older ones. `deploy.yml` additionally snapshots
the database (not uploads — those don't change on deploy) right before every migration,
as `backups/pre-deploy-<timestamp>.db`, keeping the last 10.

**To restore**: stop the app (`docker compose stop app`), copy the chosen backup over
`data/greendal.db` (back up the current one first, in case you picked wrong), then
`docker compose start app`.

**This is not off-site backup.** Both `backups/` and `data/` live on the same disk, on the
same machine — a dead drive or a stolen laptop takes both. If that machine is the only
copy of the blog that matters to you, periodically copying `backups/` somewhere else
(cloud storage, another machine, a USB drive you don't leave plugged in) is still on you.

## Deploying on your own machine (without Docker)

Next needs a running Node process — this is not a folder of static files.

```bash
npm run build
npm start                      # listens on :3000
```

Keep it alive and put a reverse proxy in front of it for TLS. Caddy is the least
work, because it gets the certificate itself:

```
# /etc/caddy/Caddyfile
yourdomain.example {
    reverse_proxy 127.0.0.1:3000
}
```

Then, for the process itself, either a systemd unit or `pm2 start npm -- start`.

Three things that will bite you if you skip them:

1. **`data/` and `public/uploads/` are your actual site.** They're gitignored, so a
   fresh `git clone` has neither. Back both up on a schedule — see [Backups](#backups);
   `backup.yml` assumes the self-hosted-runner setup from the Docker/CI sections above,
   so without those you're on your own for the schedule part (`cron`, Task Scheduler,
   whatever fits).
2. **Your machine has to be reachable.** A static IP or dynamic DNS, port 443 open,
   and the box on whenever you want the site up.
3. **Rebuild after pulling.** `npm ci && npm run build && restart`.

## Layout

```
src/app/                  routes — public pages, /admin, /api/upload, /feed.xml
src/app/(auth)/           /login /register /forgot /reset /verify — shared by admin and readers
src/app/admin/actions.ts  every write to posts/recipes/settings goes through here
src/app/account/          the signed-in reader's (or admin's) own settings
src/components/           SiteHeader, RecipeDetail (the scaler), PostEditor, BlockRenderer
src/lib/schema.ts         the data model — read this first
src/lib/blocks.ts         Block[] -> plain text / HTML, shared by feed.xml and readingTime()
src/lib/auth.ts           sessions, password hashing, getCurrentUser()/requireAdmin()
src/lib/email.ts          sendEmail() — console/Resend, picked by EMAIL_PROVIDER
src/lib/comments.ts       visibility rules and the threaded query — read before touching either
src/lib/commentActions.ts create/edit/delete/hide/visibility mutations for comments
src/lib/newsletter.ts     week-bounds math, building an issue, the idempotent weekly send
src/lib/subscriberActions.ts subscribe/confirm/unsubscribe/toggle mutations for the letter
src/instrumentation.ts    starts the hourly check that sends the weekly letter — see Weekly letter
src/app/api/newsletter/send/  manual/debug POST trigger, not what actually sends it — see Weekly letter
src/styles/globals.css    design tokens
src/styles/form.module.css  shared field/button/error styles — admin editors and public forms alike
scripts/seed.mjs          applies migrations, then sample content from the original mockup
scripts/create-admin.mjs  applies migrations, then creates/resets the one admin account
drizzle/                  migrations — generated, not hand-edited (see Schema changes)
docs/design/               design docs for work in progress
```

## Notes

- **The font.** *Orange Juice* by Brittney Murphy is free for personal use; commercial
  use is $5 to her. The licence sits next to the file in `public/fonts/`. Be aware the
  face has a drop shadow baked into its outlines, so it prints as two offset copies —
  that is the typeface, not a CSS bug.
- **Markdown is not sanitised.** The only author is you, so raw HTML from a `text` block's
  markdown is allowed on purpose (see [Post editor](#post-editor)). If a second writer ever gets
  an account, sanitise `renderMarkdown` first.
