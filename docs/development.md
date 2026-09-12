# Developing Pillar

[Documentation index](README.md) · [Installation](installation.md)

Install a Git checkout using the [installation guide](installation.md). Run the commands below from the Pillar repository root.

## Repository layout

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

## Local development

Complete the Git installation, then start the PHP server and the frontend development server in separate terminals:

```bash
# Terminal 1, from the repository root
./bin/pillar dev --site examples/starter
```

```bash
# Terminal 2, from the repository root
npm --prefix apps/editor run dev
```

Open **http://localhost:7777**. Vite proxies API and preview requests to the PHP server on port `7788`. Without a backend, the frontend uses in-memory demo data.

## Checks

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


## Keeping template documentation accurate

The `website/content/docs/liqx-*.md` chapters adapt the installed Liqx v0.1.0 syntax reference for Pillar. Preserve the source attribution and [Liqx MIT notice](LICENSE-liqx) when updating them. Keep executable language examples in `liqx` code fences.

`LiqxDocumentationTest` parses the reference snippets, renders them with sample data, and checks that every registered standard filter is documented. `PaginationDocumentationTest` builds the actual three-file recipe in the pagination guide, checks its page links and slices, and exercises its empty state and stale-page cleanup.

```bash
vendor/bin/phpunit --filter 'LiqxDocumentationTest|PaginationDocumentationTest'
./bin/pillar check --site website
./bin/pillar build --site website
```

When updating Liqx, review these chapters against the installed release and update the reference version and examples together.
