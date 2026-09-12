# Pillar

**A local-first static site generator with a schema-driven visual editor.**

Pillar turns Markdown content and Liqx templates into static HTML. Its dashboard lets you manage content, arrange page sections, and preview changes while keeping your site in ordinary files you can version with Git. Use it for blogs, documentation, landing pages, portfolios, and other content-driven sites.

No database or hosted account is required. The generated site can be served by any static host.

[Get started](#quick-start) · [Documentation](#documentation) · [Contributing](#contributing)

## Features

- **Visual editing:** arrange sections and blocks, edit their settings, and preview pages through the same renderer used for builds.
- **Structured content:** define collections with 29 field types, relationships, validation rules, and conditional fields. Entries use Markdown with frontmatter.
- **Schema-driven controls:** a template's `<schema>` block defines both its Liqx prop contract and its editor controls.
- **Themes and addons:** reuse layouts, sections, and snippets through a layer cascade, with site-level overrides.
- **Media and navigation:** manage uploads, image alt text, and nested navigation menus. Generate resized images at build time.
- **Git publishing:** save changes to disk, review them, and commit from the dashboard, with optional pushing to a remote.
- **Incremental builds:** rebuild changed pages and generate static output with content-hashed assets.
- **Extensible plugins:** add settings, editor panels, template extensions, routes, and build hooks. The included [SEO plugin](plugins/seo/README.md) provides metadata, structured data, sitemaps, and robots output.
- **English and French interfaces:** switch languages in the dashboard or visual editor without losing unsaved edits.

## Project status

Pillar is under active development. The renderer, dashboard, visual editor, validation, Git integration, and SEO plugin are implemented. APIs and file formats may evolve.

Composer plugin discovery, plugin lifecycle commands, feed/search plugins, and deployment adapters are planned.

## Requirements

- **PHP 8.2+** with `mbstring` and `json`.
- **Composer 2** for PHP dependencies.
- **Node.js 22+ and npm** to build the dashboard and bundled plugin interfaces from this checkout.
- **Git** to clone the repositories and use publishing features.

PHP's `gd` extension enables image resizing; `exif` enables photo orientation correction. Without `gd`, images are served at their original size. Node.js is needed for dashboard development and compilation, not for serving the generated site.

## Quick start

### 1. Install with Composer

Composer downloads Pillar and its dependencies from packages listed on Packagist. Once `phpmystic/pillar` is indexed, install the initial release:

```bash
composer create-project phpmystic/pillar my-site "^0.1"
cd my-site
npm --prefix apps/editor ci
npm --prefix apps/editor run build
```

This creates a copy of the full Pillar package. The example site lives in `examples/starter/`; the dashboard and bundled plugin interfaces currently require a local Node.js build. There is no `pillar init` command yet.

See [Installation](docs/installation.md) for Git installation and troubleshooting, or [Creating your own site](docs/creating-a-site.md) to keep your content in a separate project.

### 2. Open the starter site

From the Pillar repository root:

```bash
./bin/pillar dev --site examples/starter
```

Open **http://127.0.0.1:7788** for the dashboard. Choose **Customize** to open the visual editor, or visit **http://127.0.0.1:7788/preview/** to view the site.

The starter includes a landing page, blog, and documentation section. Edit an entry or change a section setting, save, and inspect the resulting files with `git diff`. Edits in this example modify the checkout's `examples/starter/` directory.

### 3. Validate and build

```bash
./bin/pillar check --site examples/starter
./bin/pillar build --site examples/starter
```

The generated site is written to `examples/starter/dist/`. Preview the production output locally:

```bash
php -S 127.0.0.1:8080 -t examples/starter/dist
```

Set `base_url` in your site's `site.json` before deploying. Upload the contents of the output directory to your static host. Draft entries are excluded from production builds by default.

## How it works

A Pillar site is a directory containing configuration, templates, content, and assets. Liqx renders the templates; Pillar supplies content, resolves theme layers, and builds the routes.

```text
my-site/
├── site.json                  # Site configuration, addons, and plugins
├── layout/theme.liqx          # Page shell
├── templates/*.json           # Page section composition
├── sections/*.liqx            # Section markup and schema
├── snippets/*.liqx            # Reusable template components
├── config/settings_schema.json
├── config/settings_data.json  # Theme setting values
├── config/plugins/*.json      # Plugin settings
├── data/menus.json            # Navigation menus
├── schemas/*.json             # Content models
├── content/<collection>/*.md   # Markdown entries with frontmatter
└── assets/                    # Stylesheets, images, fonts, and uploads
```

Saving in the dashboard writes files to disk. Publishing records changes in Git and can push them to a configured remote. Building generates the static site; deployment is a separate step. Sites without their own Git repository can still be edited, previewed, and built.

For an independent project, copy the starter into a separate directory and initialize its own Git repository. See the [project structure](website/content/docs/project-structure.md), [site configuration](website/content/docs/site-json.md), and [publishing guide](website/content/docs/publishing.md) for details.

## CLI

Run commands from this checkout using `./bin/pillar`. Every command accepts `--site <directory>`; the default is the current directory.

| Command | Purpose |
| --- | --- |
| `dev` | Start the dashboard and live preview; default port is `7788`. |
| `build` | Generate the static site; use `--force` to rebuild everything or `--drafts` to include drafts. |
| `check` | Validate schemas, templates, and content. |
| `make:collection <name>` | Scaffold a content model, content directory, and template. |
| `why <path>` | Show which layer supplies a file and which versions it overrides. |

```bash
./bin/pillar dev --site examples/starter --port 7790
./bin/pillar why sections/hero.liqx --site examples/starter
./bin/pillar build --help
```

## Documentation

Start with the [documentation index](docs/README.md), or choose a setup guide:

- [Installation](docs/installation.md): Composer, Git, requirements, and troubleshooting.
- [Creating your own site](docs/creating-a-site.md): copy the starter, configure Git, and build your site.
- [Development](docs/development.md): work on Pillar and run its checks.


The documentation is itself a Pillar site in [`website/`](website/), using the starter as an addon. Run it locally:

```bash
./bin/pillar dev --site website --port 7790
```

Open **http://127.0.0.1:7790/preview/docs/introduction/** to read it, or browse the source guides:

| Topic | Guides |
| --- | --- |
| Getting started | [Introduction](website/content/docs/introduction.md), [How it works](website/content/docs/how-it-works.md) |
| Content | [Collections and entries](website/content/docs/collections-and-entries.md), [Content types](website/content/docs/content-types.md), [Media library](website/content/docs/media-library.md) |
| Templates and design | [Liqx templates](website/content/docs/liqx-templates.md), [Schema blocks](website/content/docs/schema-block.md), [Themes and addons](website/content/docs/themes-and-addons.md) |
| Publishing | [Building](website/content/docs/building.md), [Git publishing](website/content/docs/publishing.md), [Deploying](website/content/docs/deploying.md) |
| Extensions | [Plugins](website/content/docs/plugins.md), [SEO plugin](plugins/seo/README.md) |
| Internals | [Backend architecture](docs/backend.md), [Dashboard development](apps/editor/README.md), [HTTP API](website/content/docs/http-api.md) |

### Interface language

Choose **English** or **Français** in either header. The preference is remembered across screens and tabs. On the first visit, Pillar follows a supported browser language, with English as the fallback. Switching the interface language preserves site content and unsaved edits.

Translations use i18next. See the [translation guide](apps/editor/src/i18n/README.md) to add or update messages, including plugin translations.

## Contributing

Bug reports, documentation improvements, and focused pull requests are welcome. For bugs, include reproduction steps, expected and actual behavior, relevant error output, and your PHP and Node.js versions. Discuss substantial changes in an issue before starting implementation.

See the [development guide](docs/development.md) for repository layout, frontend development, tests, and generated field types.

## Template language reference

Start with [Liqx templates](website/content/docs/liqx-templates.md) or the complete [pagination recipe](website/content/docs/pagination.md).

- [Document structure](website/content/docs/liqx-structure.md)
- [Frontmatter](website/content/docs/liqx-frontmatter.md)
- [Expressions](website/content/docs/liqx-expressions.md)
- [Elements and attributes](website/content/docs/liqx-elements.md)
- [Filter reference](website/content/docs/liqx-filters.md)
- [Control flow](website/content/docs/liqx-control-flow.md)
- [Components and slots](website/content/docs/liqx-components.md)
- [Schema, styles, and scripts](website/content/docs/liqx-schema-style-script.md)
- [Methods, globals, and scope](website/content/docs/liqx-methods-globals.md)

## License

Pillar is licensed under the [MIT License](LICENSE).
