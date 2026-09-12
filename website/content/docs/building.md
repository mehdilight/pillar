---
title: Building
summary: pillar build renders every route to dist/ — incrementally, rebuilding only pages whose inputs changed — along with hashed assets, resized images and whatever plugins add.
section: publishing
order: 50
---
```bash
pillar build --site my-site            # → my-site/dist/
pillar build --site my-site --force    # ignore the manifest, rebuild everything
pillar build --site my-site --drafts   # include draft entries
```

```text
✓ 12 page(s) written, 0 unchanged, 2 asset(s), 6 resized image(s) — 186ms
```

## What is written

- one `index.html` per route — `/`, `/blog/`, `/blog/page/2/`, `/posts/<slug>/`, `/docs/<slug>/` — and `404.html`;
- `assets/`, each file twice: under a content-hashed name (`base.a1b2c3d4.css`, what `asset_url` returns) and under its own name (so a markdown image's plain path works);
- resized copies of every image — see [Images](/docs/images/);
- whatever plugins add: the SEO plugin writes `sitemap.xml` and `robots.txt`.

The output directory is `site.json`'s `output`, `dist` by default.

## Incremental builds

Each page records, while it renders, everything it read: its template, the sections, blocks and snippets it used, and which collections it listed or linked to. That goes into `.pillar/manifest.json` with a hash of those inputs.

The next build rehashes each page's inputs and skips the page when nothing changed — a typo fixed in one post rebuilds that post and the listings that show it, not the whole site. A file's hash is its content, not its modification time: a checkout or a touched file that did not change rebuilds nothing.

Some inputs affect every page, and form a **fingerprint**: site settings, template JSONs, the asset map and its resized copies, alt text, `site.json`, plugin configuration and whatever plugins declare, and Pillar's own version. When the fingerprint changes, everything rebuilds.

Files a previous build wrote and this one did not — a deleted post, a disabled plugin's sitemap, an image's old copies — are removed from `dist/`. Nothing else in `dist/` is touched.

## Failures

A section that throws while rendering is shown as empty and the build reports it and fails, rather than shipping a page with a silent hole. Run `pillar check` first to catch schema and content problems — see [Validation](/docs/validation/).

## From the editor

The visual editor's **Build** button runs the same build in the dev server.
