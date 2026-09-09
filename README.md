# Pillar

A **local-first static site generator** built on
[Liqx](https://github.com/phpmystic/liqx), with a schema-driven visual
dashboard and git as the store.

```bash
pillar dev      # dashboard + live preview at http://127.0.0.1:7788
pillar build    # render the site to dist/ — plain HTML, no server
pillar check    # validate schemas, templates and content
pillar why sections/hero.liqx   # which layer provides a file, and what it shadows
```

Markdown in, HTML out. Edit here, deploy anywhere.

## What it is

The storefront-theme model — sections composed into pages, each declaring its
editable surface in a `<schema>` block — applied to a static site, with three
deliberate choices:

- **Local first.** No database, no service, no account. A site is a directory;
  saving is writing a file.
- **Git is the store.** Draft is the working tree, publish is a commit, history
  is `git log`, rollback is `git revert`. No `theme_templates` table.
- **The `<schema>` block is the whole editor.** One JSON block, two readers:
  Liqx type-checks a template's props, Pillar reads the same block as the
  dashboard's control manifest.

Read [`plan.md`](plan.md) for the product, [`docs/backend.md`](docs/backend.md)
for the PHP architecture — including plugins and theme addons — and
[`apps/editor/README.md`](apps/editor/README.md) for the dashboard.

## Layout

```
src/                  the PHP package (Pillar\)
  Render/             Liqx wiring: layers, drops, sections, pages
  Schema/             <schema> parsing, casting, validation
  Content/            markdown + frontmatter
  Build/              routes, incremental builds, assets
  Dev/                the dashboard server and its JSON API
  Git/                the store
  Cli/                the `pillar` command
apps/editor/          the dashboard SPA (SolidJS)
schema/               field-types.json — PHP and TypeScript are generated from it
tests/                phpunit, against a real fixture site
```

## Development

```bash
composer install
vendor/bin/phpunit
vendor/bin/phpstan analyse
php tools/generate-field-types.php --check   # PHP and TS field types in step

cd apps/editor && npm install && npm run build
```

## Where it stands

Built and tested: the render path, the layer cascade (site → addons → theme),
the schema layer with `pillar check`, incremental builds, and `pillar dev` —
the dashboard drives real files over a JSON API and previews through the same
renderer the build uses.

Next: plugins and theme addons (`docs/backend.md` §10), then deploy adapters.
