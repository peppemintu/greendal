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

## Running it with Docker

```bash
cp .env.example .env             # then edit it — same three values as above
docker compose up -d --build
docker compose exec app node scripts/seed.mjs   # optional: sample content
```

The app listens on `127.0.0.1:3000` on the host (not exposed to the LAN/internet
directly — see the tunnel section below). `data/` and `public/uploads/` are bind-mounted
from the repo root, so they survive rebuilds; back them up the same way as a bare-metal
install. There's no automatic migration step: either run `scripts/seed.mjs` (creates the
tables and fills them with sample content) or `docker compose exec app npx drizzle-kit
push` (creates the tables, no sample content) once before first use.

To rebuild after pulling: `docker compose up -d --build`.

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

After that, every push to `main` (including a merged PR) rebuilds the image, restarts
the container, applies schema changes (`drizzle-kit push` — new tables/columns land
automatically), smoke-tests `http://127.0.0.1:3000/`, and prunes old images. `data/` and
`public/uploads/` are gitignored and untouched by the checkout (`clean: false` keeps it
that way), so real content survives every deploy.

That schema step isn't real migrations — no version history, no rollback, just "make the
live schema match `src/lib/schema.ts`". It applies additive changes (a new table, a new
column) without asking anything. Anything it can't apply unambiguously (e.g. a rename it
can't tell apart from a drop+add) makes the step fail rather than guess — when that
happens, run `docker compose exec app npx drizzle-kit push` by hand on the runner and
answer its prompt, then push again.

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
