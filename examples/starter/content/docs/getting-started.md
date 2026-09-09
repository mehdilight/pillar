---
title: Getting started
order: 1
---
Install the package, then work on a directory:

```bash
composer require pillar/pillar
pillar dev --site ./my-site
```

`pillar dev` serves three things on one port: the dashboard at `/`, a JSON API
over the working tree at `/api`, and the site itself at `/preview`. The preview
renders through the same code `pillar build` uses, so what you see is what gets
written.

When you are ready:

```bash
pillar build          # → dist/, plain HTML files
pillar build --force  # ignore the incremental manifest
```
