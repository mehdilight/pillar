---
title: Deploying
summary: The build is plain files. Put dist/ on any static host — by building in CI, letting your host build, or uploading it.
section: publishing
order: 52
---
Pillar's output needs no server-side code: every page is an `index.html` in a folder, so any static host serves it with clean URLs. Set `base_url` in `site.json` to the public address first — canonical URLs, the sitemap and structured data are absolute and are left out without it.

## Build in CI

The dashboard publishes by pushing to git, so the natural setup is: push → CI builds → CI deploys. A GitHub Actions workflow for GitHub Pages:

```yaml
name: Deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3', extensions: gd, exif, mbstring }
      - run: composer install --no-dev
      - run: php bin/pillar build --site . --force
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

`--force` on CI: a fresh checkout has no manifest anyway, and it makes the intent obvious.

## Let the host build

Netlify, Vercel, Cloudflare Pages and similar hosts can run the build themselves when they can run PHP: set the build command to `php bin/pillar build --site .` and the output directory to `dist`.

## Upload it

`dist/` is self-contained. `rsync`, an S3 bucket, an FTP upload — anything that copies files works.

## Caching

Hashed assets (`base.a1b2c3d4.css`, resized image copies) never change under the same name: serve `/assets/` with a long cache lifetime. Pages themselves should be revalidated.

## Planned: deploy adapters

`site.json` already has a `deploy` key (`"static"`). Adapters that write each host's configuration — redirects, headers — and deploy with one command (`pillar deploy`) are designed but not built yet. Until then, the recipes above are the way.
