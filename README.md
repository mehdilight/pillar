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

The current installation uses a local Composer path repository for Liqx. Composer plugin discovery, plugin lifecycle commands, feed/search plugins, and deployment adapters are planned.

## Requirements

- **PHP 8.2+** with `mbstring` and `json`.
- **Composer 2** for PHP dependencies.
- **Node.js 22+ and npm** to build the dashboard and bundled plugin interfaces from this checkout.
- **Git** to clone the repositories and use publishing features.

PHP's `gd` extension enables image resizing; `exif` enables photo orientation correction. Without `gd`, images are served at their original size. Node.js is needed for dashboard development and compilation, not for serving the generated site.

## Quick start

### 1. Clone and install

Clone Pillar and Liqx into the layout expected by [`composer.json`](composer.json). Run these commands in the directory where you keep your projects:

```bash
mkdir pillar-dev
cd pillar-dev
git clone https://github.com/mehdilight/liqx.git phpmystic/liqx
git clone https://github.com/mehdilight/pillar.git pillar
cd pillar

composer install
npm --prefix apps/editor ci
npm --prefix apps/editor run build
```

The relative path `../phpmystic/liqx` is required by the current Composer configuration. Both repositories must be accessible to your Git account. The dashboard build also compiles the bundled plugin interfaces.

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

### Repository layout

| Path | Contents |
| --- | --- |
| `src/` | PHP renderer, schemas, content, builds, dev server, CLI, Git integration, and plugin system |
| `apps/editor/` | SolidJS dashboard and visual editor |
| `plugins/seo/` | Bundled SEO plugin and its frontend |
| `examples/starter/` | Starter site with landing page, blog, and docs |
| `website/` | Documentation site |
| `schema/` | Shared field-type definitions |
| `tests/` | PHP tests and fixture sites |
| `tools/` | Development utilities and code generation |

### Local development

Complete the installation above, then start the PHP server and the frontend development server in separate terminals:

```bash
# Terminal 1, from the repository root
./bin/pillar dev --site examples/starter
```

```bash
# Terminal 2, from the repository root
npm --prefix apps/editor run dev
```

Open **http://localhost:7777**. Vite proxies API and preview requests to the PHP server on port `7788`. Without a backend, the frontend uses in-memory demo data.

### Checks

Run the checks relevant to your changes before submitting a pull request:

```bash
# PHP tests and static analysis
composer test
composer analyse

# Shared PHP/TypeScript field-type consistency
php tools/generate-field-types.php --check

# Dashboard and plugin checks
npm --prefix apps/editor test
npm --prefix apps/editor run test:seo
npm --prefix apps/editor run typecheck
npm --prefix apps/editor run build
```

When changing field types, edit `schema/field-types.json` and run `php tools/generate-field-types.php` to regenerate the PHP and TypeScript definitions. Keep generated definitions and relevant documentation in the same pull request.

## License

Pillar is licensed under the [MIT License](LICENSE).
