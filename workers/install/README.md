# `install.imaginarystorage.com` — Cloudflare Worker (parked)

> **Status: not in active use.** The DNS for `imaginarystorage.com` is on
> Hostinger, not Cloudflare. Cloudflare Workers can't bind a zone route
> without the zone living on Cloudflare, so this Worker is dormant until
> DNS moves. The active install URL today is
> `https://nas.imaginarystorage.com/install.sh` — served as a static asset
> from `landing/public/install.sh` via the existing GitHub Pages site.

Tiny Worker that proxies the latest `install.sh` from the GitHub Release of
`imaginary-storage/NAS`. End users would do:

```bash
curl -fsSL install.imaginarystorage.com | sudo bash
```

The Worker streams the script body back directly — no client-side redirect
follow needed, so it works with bare `curl` too.

Browser visits to `https://install.imaginarystorage.com/` get a small landing
page with the command and a link to the repo.

## One-time setup

You need the Cloudflare account that owns the `imaginarystorage.com` zone.

```bash
npm install -g wrangler            # or `pnpm add -g wrangler`
wrangler login                     # opens browser, authorises your account
```

## Deploy

From this directory:

```bash
cd workers/install
wrangler deploy
```

`wrangler.toml` binds the Worker to `install.imaginarystorage.com/*` via a
zone route. Cloudflare provisions the DNS record automatically when the route
is created (it'll show as a proxied AAAA/A record pointing at Cloudflare's
edge). If a stale DNS record exists for `install.imaginarystorage.com` from
manual setup, delete it before deploying — Cloudflare needs to own that
record.

## Local dev

```bash
wrangler dev
# → http://localhost:8787
curl http://localhost:8787/
```

## Update / rollback

- **Update**: edit `src/index.js`, run `wrangler deploy` again.
- **Rollback**: `wrangler rollback` (lists prior versions; pick one).

## What it does

1. Browser hits `/` → returns the HTML landing page.
2. `curl` / `wget` hits `/` or `/install.sh` → proxies
   `https://github.com/imaginary-storage/NAS/releases/latest/download/install.sh`,
   sets `Content-Type: text/x-shellscript`, cached at the edge for 5 min.
3. Anything else → 404.

The Worker has no secrets and no state. Cloudflare's free tier is fine for
this workload (the GitHub Release is what bears the actual download
bandwidth; the Worker just proxies headers and streams bytes through).
