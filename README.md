# greendal

A personal blog with two kinds of writing on it — *thoughts* (ordinary posts) and
*recipes* (which carry structured ingredients so the page can scale them to however
many people turned up). Everything is written from a small admin at `/admin`; there
are no markdown files to commit.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router | Server-rendered pages so posts have real URLs, real `<title>`/OG tags, and an RSS feed |
| Database | SQLite via better-sqlite3 + Drizzle | One file, no daemon. Backup is `cp data/greendal.db somewhere` |
| UI primitives | Radix Primitives (Dialog, ToggleGroup) | Unstyled, so they don't fight the design. Radix *Themes* is deliberately not used |
| Styling | CSS Modules + custom properties | The design is bespoke; a utility framework would be noise |
| Auth | One password, signed cookie (`jose`) | One author. A user table would be ceremony |
| Editor | Markdown for thoughts, a structured form for recipes | Recipe quantities have to stay numeric for the scaler |

## Running it

```bash
npm install
cp .env.example .env.local     # then edit it — see below
node scripts/seed.mjs          # optional: fills the DB with sample content
npm run dev                    # http://localhost:3000
```

`.env.local` needs three things:

```
DATABASE_PATH=./data/greendal.db
SESSION_SECRET=<openssl rand -base64 32>
ADMIN_PASSWORD=<the password you'll type at /admin/login>
SITE_URL=https://yourdomain.example    # used by RSS and OG tags
```

Sign in at `/admin/login`.

## Deploying on your own machine

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
   fresh `git clone` has neither. Back both up on a schedule.
2. **Your machine has to be reachable.** A static IP or dynamic DNS, port 443 open,
   and the box on whenever you want the site up.
3. **Rebuild after pulling.** `npm ci && npm run build && restart`.

## Layout

```
src/app/                  routes — public pages, /admin, /api/upload, /feed.xml
src/app/admin/actions.ts  every write to the database goes through here
src/components/           SiteHeader, RecipeDetail (the scaler), the two editors
src/lib/schema.ts         the data model — read this first
src/styles/globals.css    design tokens
scripts/seed.mjs          sample content from the original mockup
```

## Notes

- **The font.** *Orange Juice* by Brittney Murphy is free for personal use; commercial
  use is $5 to her. The licence sits next to the file in `public/fonts/`. Be aware the
  face has a drop shadow baked into its outlines, so it prints as two offset copies —
  that is the typeface, not a CSS bug.
- **Markdown is not sanitised.** The only author is you, so raw HTML in a post body is
  allowed on purpose. If a second writer ever gets an account, sanitise
  `renderMarkdown` first.
- **Uploads aren't resized.** An 8 MB cap, and that's it. Add `sharp` if you start
  dropping phone photos straight in.
