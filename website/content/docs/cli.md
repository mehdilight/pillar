---
title: CLI
summary: Every pillar command and its options.
section: reference
order: 70
---
Every command takes `--site <dir>` (`-s`), defaulting to the current directory.

## pillar dev

```bash
pillar dev [--port 7788] [--host 127.0.0.1] [--workers 4]
```

Serves the dashboard at `/`, the dev API at `/api/`, and the site at `/preview/` — rendered live, drafts included — on one port. Built dashboard files are served from `/_pillar/`, a prefix no site uses. `--workers` sets how many requests are served at once.

## pillar build

```bash
pillar build [--force] [--drafts]
```

Renders every route to the site's output directory. Incremental: pages whose inputs did not change are skipped. `--force` rebuilds everything; `--drafts` includes draft entries. Fails when a section failed to render. See [Building](/docs/building/).

## pillar check

```bash
pillar check
```

Validates schemas, templates and content, printing each problem with its file. Exits non-zero on errors; warnings are printed and pass. See [Validation](/docs/validation/).

## pillar make:collection

```bash
pillar make:collection <name> [--label "Guides"] [--fields title,date,tags,draft] [--no-template]
```

Creates a content type: `schemas/<name>.json`, `content/<name>/` and `templates/<singular>.json` (copied from `page.json`). Field presets: `title`, `date`, `summary`, `tags`, `image`, `order`, `draft`. The name is plural and lowercase: letters, digits and hyphens.

## pillar why

```bash
pillar why sections/hero.liqx
```

Shows which layer provides a file — the site, an addon, a plugin, the theme — and what it shadows.
