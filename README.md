# Pillar

A **local-first static site generator** built on
[Liqx](https://github.com/phpmystic/liqx), with a schema-driven visual
dashboard and git as the store.

Blog, documentation, landing page, portfolio, changelog — anything that is
pages plus markdown. Nothing in it is specific to one kind of site.

```bash
pillar dev      # dashboard + live preview at http://127.0.0.1:7788
pillar build    # render the site to dist/ — plain HTML, no server
pillar check    # validate schemas, templates and content
pillar why sections/hero.liqx   # which layer provides a file, and what it shadows
```

Markdown in, HTML out. Edit here, deploy anywhere.

## Try it

```bash
composer install
./bin/pillar dev --site examples/starter
```

`examples/starter` is a real site: a landing page, a blog, and a documentation
section with a sidebar — three uses, one set of parts. Open the dashboard,
click a section, change a setting, and watch the file on disk change with it.

## Three ideas

- **Local first.** No database, no service, no account. A site is a directory;
  saving is writing a file.
- **Git is the store.** Draft is the working tree, publish is a commit, history
  is `git log`, rollback is `git revert`. No `templates` table.
- **The `<schema>` block is the whole editor.** One JSON block in a template,
  two readers: Liqx type-checks the template's props against it, Pillar reads
  the same block as the dashboard's control manifest.

Read [`plan.md`](plan.md) for the product, [`docs/backend.md`](docs/backend.md)
for the PHP architecture — including plugins and theme addons — and
[`apps/editor/README.md`](apps/editor/README.md) for the dashboard.

## A site

```
site.json                     name, base_url, output, addons, plugins
layout/theme.liqx             the page shell
templates/*.json              which sections a page has        ← editor-owned
sections/*.liqx               markup + a <schema> block
snippets/*.liqx               components
config/settings_*.json        site-wide settings + values      ← editor-owned
schemas/*.json                content models
content/<collection>/*.md     markdown + frontmatter           ← editor-owned
assets/*                      css, images, fonts               ← editor-owned
```

The four editor-owned paths are the only things the dashboard writes.
Everything else is developer territory, edited in an editor.

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
examples/starter/     a real site: landing page, blog, docs
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

Next: plugins and theme addons ([`docs/backend.md`](docs/backend.md) §10), then
deploy adapters for Vercel, Netlify, Cloudflare and Pages.
