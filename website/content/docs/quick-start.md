---
title: Quick start
summary: Install Pillar, open the starter site in the dashboard, change a page, and build it to plain HTML — in about five minutes.
section: start
order: 2
---
## Requirements

- **PHP 8.2 or newer** with `mbstring`, and ideally `gd` (images are resized with it — without it they are served at full size) and `exif` (photos taken sideways come out upright).
- **Composer**.
- **Git**, if you want publishing — Pillar works without it, there is just nothing to commit to.

Node is only needed to work on Pillar's own dashboard; it ships prebuilt in `public/editor/` once built.

## Install

Install Pillar from its Git repository. Composer installs the published Liqx dependency from Packagist:

```bash
git clone https://github.com/mehdilight/pillar.git pillar
cd pillar && composer install
(cd apps/editor && npm ci && npm run build)   # the dashboard
```

Every command in these docs is `bin/pillar` from that checkout; `pillar` below is short for it.

## Open the starter

The repository includes `examples/starter`: a landing page, a blog and a small docs section, on a theme whose colours and widths are all settings. Copy it somewhere and start the dev server:

```bash
cp -r examples/starter ~/my-site
cd ~/my-site && git init && git add -A && git commit -m "Start from the Pillar starter"
pillar dev --site ~/my-site
```

`pillar dev` prints one address — `http://127.0.0.1:7788` by default. Open it:

- `/` is the **dashboard**: your content, media, navigation and settings.
- **Customize** in the top bar opens the **visual editor** at `/editor/`.
- `/preview/` is the **site**, rendered live.

## Change something

1. In the dashboard, open **Posts** and pick an entry. Edit its text in the editor, then press **Save** (or `⌘S`). The file in `content/posts/` changes — run `git diff` to see exactly how.
2. Click **Customize**. Select the **Hero** section in the page tree, change its heading, and watch the preview update. The change lands in `templates/index.json`.
3. Open **Publish**. It lists the files you changed. Write a message and click **Commit & publish**: that is a git commit, pushed if the site has a remote.

## Build

```bash
pillar build --site ~/my-site
```

The site is written to `dist/`: an `index.html` per page, content-hashed assets, resized images, a sitemap and `robots.txt` (from the SEO plugin). Serve it with anything:

```bash
php -S 127.0.0.1:8080 -t ~/my-site/dist
```

Builds are incremental — run it again and unchanged pages are skipped. `--force` rebuilds everything.

## Start from nothing instead

A Pillar site is any folder with a `site.json`:

```json
{ "name": "My site", "base_url": "https://example.com" }
```

Add a `layout/theme.liqx`, a section or two in `sections/`, and a `templates/index.json` that lists them — [Templates and sections](/docs/templates-and-sections/) walks through each file. Or declare the starter as an **addon** and override only what you need, which is how this documentation site is built: see [Themes and addons](/docs/themes-and-addons/).

## Next

- [How Pillar works](/docs/how-it-works/) — the model in one page.
- [Project structure](/docs/project-structure/) — every folder a site can have.
