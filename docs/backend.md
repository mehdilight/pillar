# Pillar — the PHP backend

[← back to plan.md](../plan.md)

`plan.md` is the map: what Pillar is and why. This is the backend detail —
the packages, the seams, the render path, and the two ways it can be extended.

The whole product in one line, restated because every decision here answers to
it: **`pillar dev` opens a dashboard, you edit, `pillar build` writes `dist/`.**
Nothing runs on the public path.

---

## 1. Shape

One composer package, `pillar/pillar`, shipping a `pillar` CLI (and a PHAR).
**No framework.** The dependency set is deliberately narrow:

| Dependency | For |
|---|---|
| `phpmystic/liqx` | rendering — the whole point |
| `symfony/console` | the CLI |
| `symfony/http-foundation` | request/response, in `pillar dev` only |
| `league/commonmark` | markdown |
| `symfony/yaml` | frontmatter and plugin manifests |
| `symfony/finder` | walking `content/`, `sections/`, `plugins/` |

Nothing else. No DI container, no ORM, no routing package: `pillar dev` is a
single-user local process serving a handful of routes, and a `match` on the
path prefix is the honest amount of machinery. Bastet needs
`illuminate/database` + routing + DI because it is a commerce application with
real users and real money; Pillar's runtime is a directory and a build command.

A **service locator** (`Pillar\Support\Services`) — a typed array of
constructed singletons, ~60 lines — is enough for what plugins need
(§10). Reach for a container only if that stops being true.

## 2. Namespaces

```
Pillar\Cli          NewCommand, DevCommand, BuildCommand, ServeCommand,
                    CheckCommand, DeployCommand, PluginCommand
Pillar\Site         Site (site.json), Paths, PathPolicy, Layers
Pillar\Content      ContentStore, MarkdownFile, Frontmatter, ContentSchema
Pillar\Schema       SchemaParser, SectionSchema, BlockSchema, Setting,
                    FieldType, FieldTypeRegistry, SettingsCaster
Pillar\Render       LayeredFileSystem, EnvironmentFactory, PageRenderer,
                    SectionRenderer, Filters, Head\*, Drops\*
Pillar\Build        RouteTable, Builder, BuildManifest, DependencyRecorder,
                    Assets, Images, Sitemap, Feed, SearchIndex
Pillar\Dev          Server, Router, Api\*Controller, PreviewController,
                    DashboardController
Pillar\Git          GitSource, LocalGit, GitHubApi
Pillar\Deploy       DeployAdapter, StaticAdapter, VercelAdapter,
                    NetlifyAdapter, CloudflareAdapter, PagesAdapter
Pillar\Plugin       Plugin, PluginManifest, PluginLoader, PluginContext,
                    Registries\*
```

`Render` and `Content` know nothing about HTTP. `Build` and `Dev` are two
callers of the same renderer — which is what makes the editor's preview
honest: it renders through the identical path `pillar build` will use.

## 3. The render path

```
route → PageRenderer
          ├─ templates/<name>.json      → the ordered section list
          ├─ config/settings_data.json  → the settings drop
          ├─ ContentStore               → page / post / collection drops
          ├─ HeadRegistry               → <head> tags (core + plugins)
          └─ for each section:
               SectionRenderer
                 ├─ Template::parse(sections/<type>.liqx)   [compiled cache]
                 ├─ scope: section.settings (cast), section.blocks, page scope
                 └─ render(..., wrapper: <tag id data-pillar-section-id=…>)
          └─ layout/theme.liqx renders last, with content_for_layout
```

Five things to get right.

**`LayeredFileSystem implements Liqx\FileSystem`** (§4). Required, not
optional: liqx's own `LocalFileSystem` rejects any name containing `/`, and
Pillar resolves `sections/`, `blocks/` and `snippets/` across several layers.

**`EnvironmentFactory`** builds one liqx `Environment` per build (or per dev
request): the standard filters, plus Pillar's — `markdownify`, `asset_url`
(content-hashed), `image_url` / `image_srcset` / `image_tag` (build-time
resize, see below), `image_alt`, `absolute_url`, `excerpt`, `t` — plus globals (`section()`,
`render()`, `content_for_layout`, `now`), both file systems, and
`setCompiledTemplateDir('.pillar/compiled')` **from day one**. That last call
is the difference between a 500-page build taking seconds and taking minutes.
Every registered plugin extension is applied here, last (§10).

**Images are resized by the build.** Every JPEG, PNG and WebP under
`assets/` is copied at each width in `site.json` → `images.widths` (default
320, 640, 960, 1280, 1920) narrower than itself, as WebP unless
`images.format` is `original`, and cached in `.pillar/images/` so a copy is
made once. All copies are made up front rather than as pages ask: the set of
files is then a function of the assets, so incremental builds and cleanup
need no record of which page used which image. `image_url(700)` rounds up to
the nearest copy; `image_srcset` lists them; `image_tag(alt, class, sizes,
loading)` writes `srcset`, `sizes`, the original's `width`/`height` and
`loading="lazy"` (pass `'eager'` for an image at the top of the page).
Markdown images get the same, with `images.sizes` as their `sizes`. In the
dev preview a copy is `/assets/photo.jpg?w=640`, made on request. Without GD,
images are served at their original size. A theme must give images
`height: auto` wherever it constrains their width, or the `height` attribute
stretches them.

**Alt text** is written once per image in the media library and kept in
`config/media.json`, keyed by the image's path under `assets/`
(`{"uploads/team.jpg": {"alt": "…"}}`). An image used without alt of its own —
`![](/assets/uploads/team.jpg)` in markdown, `image_tag` with no second
argument — takes the library's; `image_alt` returns it for templates that
write their own `<img>`. Alt written where the image is used always wins. The
file is part of the build fingerprint, so changing an alt rebuilds every page.

**Drops** extend `Liqx\Drop`, whose entire contract is one method:
`beforeMethod(string $method): mixed`. `SiteDrop`, `PageDrop`, `PostDrop`,
`CollectionDrop`, `MenuDrop`, `ImageDrop`, `PaginateDrop`. Keep bastet's
convention — PHP `camelCase()` reads as `snake_case` in a template.

**Settings are not props.** A `<schema>` block's `settings` never become liqx
`props`; they arrive as `section.settings`, cast by `SettingsCaster`. liqx's
own `SchemaValidator` only fires when frontmatter did `return {...}` and
ignores unknown top-level keys, so the dual-consumer schema (§5) costs nothing
at render time.

**Quoted attribute values are literal.** Liqx interpolates through
`attr={expr}` or a template string; `class="template-{template}"` renders the
braces verbatim. Worth knowing before writing a theme, and worth saying in the
theme docs.

**The wrapper argument.** `Template::render($data, $strict, $wrapper)` lets the
*host* emit the enclosing element. So `SectionSchema`'s `tag`/`class` and the
editor's `data-pillar-section-id` are applied by `SectionRenderer` — a theme
author never hand-writes the editor's attributes, and cannot forget to.

**One rule inherited from bastet:** a section that throws renders as an empty
string and the page still ships. The error is collected — an overlay in
`pillar dev`, a non-zero exit with a report in `pillar build`. A merchant's
typo must never blank a page.

## 4. Layers: site, addons, theme

Every template lookup resolves through an ordered cascade, and this is the
mechanism theme addons (§10.2) are built on:

```
1. the site's own files          sections/hero.liqx        (always wins)
2. theme addons, in order        vendor/<addon>/sections/hero.liqx
3. the theme                     themes/<slug>/sections/hero.liqx
```

The site can override anything without forking; an addon can ship a section a
theme never had; a theme is a normal layer rather than a special case.

Two rules keep this debuggable rather than mysterious:

- **Order is declared, never discovered.** `site.json` lists addons in order;
  the resolution never depends on directory iteration or install sequence.
- **The winner is inspectable.** `pillar check --why sections/hero.liqx`
  prints every layer that offers the file and which one won. Without this, an
  override that silently does nothing is unanswerable.

`PathPolicy` applies at every layer: an allowlist of folders (`assets`,
`blocks`, `config`, `layout`, `locales`, `schemas`, `sections`, `snippets`,
`templates`) and extensions (`liqx, json, md, css, js, map, png/jpg/jpeg/gif/
webp/avif/svg/ico, woff/woff2/ttf/otf, txt, yaml`) — **no `.php`, ever,
allowlisted not blocklisted**, exactly as bastet's `ThemePackage` enforces.

## 5. The schema layer

Two flavours, one vocabulary — the full contract is `plan.md` §4.

`SchemaParser` keeps bastet's decision: **regex-extract the `<schema>` block,
do not parse the document.** The dashboard reads every schema on every load,
and parsing thirty templates to throw away their markup would be the slowest
thing in the product. Memoize per type, per layer.

`FieldType` is generated from `schema/field-types.json`, which also generates
the editor's TypeScript union. This is B2's *first* commit, not a cleanup
task: `Setting::fromArray()` throws on an unknown type, so a type the editor
offers and PHP rejects does not degrade — it stops the whole section parsing.
bastet drifted about fifteen types apart exactly here.

`FieldTypeRegistry` makes the set extensible (§10.1) without giving up that
guarantee: a plugin registering a type supplies the cast *and* the editor
component, and `pillar check` fails when only one side is present.

## 6. Content

`ContentStore` reads `content/**/*.md`, splits YAML frontmatter from body,
validates against `schemas/<collection>.json`, and hands back drops. Bodies
render through CommonMark; frontmatter values are cast by the same
`SettingsCaster` the sections use, which is why one `SettingInput` component
in the editor can render both a section setting and a post's `date`.

Content need not be a file on disk: `ContentSourceRegistry` (§10.1) lets a
plugin contribute items into a collection from anywhere — a CSV, a JSON dump,
an API pulled at build time. The store merges sources by collection; a
file-backed item wins over a contributed one with the same slug.

**Creating a type** is `Content\ContentType`, used by both `pillar
make:collection` and the dashboard's *New type*. It writes the three files a
person would write by hand — `schemas/<name>.json`, `content/<name>/`, and
`templates/<singular>.json` copied from `page.json` — so a type made either way
is the same thing, and either can be edited the other way. A declared type with
no entries still lists, or creating one and adding its first entry would be
impossible.

**Field types** come from `schema/field-types.json`, the one list PHP's
`FieldType` enum and the dashboard's union are generated from. Beyond text,
numbers and choices there are structured types: `group` (fields stored as one
object — `author.name`), `repeater` (rows of the same fields — an FAQ),
`table` (rows of strings, the first row the header), `checkboxes` (a list of
option values), `icon` (a Phosphor icon name — a theme renders it however it
likes) and `file` (a download from the media library: PDF, ZIP, Office,
MP3/MP4/WebM, each checked against its bytes on upload). Options widen a type:
`image` with `multiple` is a gallery, `date` with `time` a date and time.
Groups and repeaters nest three deep. Nested frontmatter is written as
indented YAML blocks; a schema is written with one field per line
(`Support\CompactJson`), so adding a field is a one-field diff.

**Relationships** are `collection_item` fields — `collections: [posts]`,
optionally `multiple` and `max` — plus `page`, a link to an entry of `pages`.
They are stored as references, the slug (or `collection/slug` when several
collections are offered), and read as the entries themselves: the store gives
each `PageDrop` an augmenter, so `page.related.map((post) => …)` loops over
posts, into groups and repeater rows too. A section's `collection_item`
setting resolves the same way through `SettingsCaster`. Resolving a reference
records its collection as a dependency, so a page showing a related post is
rebuilt when that post changes; drafts resolve only where drafts render; a
reference to nothing resolves to nothing, and `pillar check` warns about it.
`collection` stays a name — templates index `collections[name]` with it.

**Pagination** is declared by the template, not by a section:

```json
{ "paginate": { "collection": "posts", "per_page": 10 }, "sections": … }
```

It has to live there because the route table must know how many pages exist
*before* anything renders — a route table cannot be discovered by rendering.
`RouteTable` emits `/blog/`, `/blog/page/2/`, … and hands each route a
`PaginateDrop` carrying that page's slice, the URLs, and windowed `parts` so a
two-hundred-page collection does not draw two hundred links.

## 7. Build

`RouteTable` = static templates + one route per content item per collection +
whatever `RouteRegistry` contributes. Then per route: render → write
`dist/<path>/index.html`.

**Incremental builds are designed in, not bolted on.** Hash
`(content item + template JSON + every .liqx in its dependency set + settings
+ the plugin fingerprint)` → skip unchanged routes. **Hash contents, never
mtimes** — modification times have one-second granularity and the dev loop
saves and rebuilds inside the same second, so an mtime check silently serves
the previous render. That is not theoretical: the first implementation used
mtimes and skipped every page after a real edit (`Build\FileHash`).

**Collections are dependencies too.** A page that lists posts reads
`collections.posts`, which is not a template file, so the file-system recorder
never sees it — and adding a post used to leave the home page showing the old
list. `CollectionDrop` reports every read to `ContentStore::listen()`, the
recorder stores it as `collection:<name>`, and the build hashes that
collection's membership and contents. It is precise: editing a doc rebuilds the
pages that list docs, and nothing that only lists posts. The dependency set comes
free: wrap `LayeredFileSystem` in a `DependencyRecorder` during render and
every `load()` is a recorded dependency. Persist to `.pillar/manifest.json`.

**Plugins are part of that hash, and this is the subtle part.** A plugin that
reads something the recorder never saw — a config file, an environment
variable, a remote fetch — produces output that a later incremental build will
not know to invalidate, and the failure is a stale page in production. So
`PluginContext::dependsOn(string $path)` and `::fingerprint(string $value)`
are part of the plugin API, and the manifest records the plugin's slug and
version alongside them. `pillar build --force` exists for the same reason;
CI uses it.

Core's own `Sitemap`, `Feed` and `SearchIndex` are written **as plugins on the
public build API** rather than as privileged internals. If the API cannot
express a sitemap, it cannot express what a plugin author will want either.

## 8. `pillar dev`

The frontend already fixed this contract — these are exactly the endpoints
`apps/editor/src/api/client.ts` calls:

| Route | Reads / writes |
|---|---|
| `GET /api/health` | the probe the SPA uses to pick real data over fixtures |
| `GET /api/templates` · `/api/templates/{n}` | `templates/*.json` + every `<schema>` |
| `PUT /api/templates/{n}` · `PUT /api/layout` | writes `templates/*.json` |
| `GET/PUT /api/settings` · `GET /api/settings/schema` | `config/settings_{data,schema}.json` |
| `GET /api/content` · `/{collection}` · `PUT/DELETE /{collection}/{slug}` | `content/**/*.md` + `schemas/*.json` |
| `POST /api/media` | writes into `assets/`, returns the built URL |
| `GET /api/status` · `/api/history` | `git status --porcelain` · `git log` |
| `POST /api/publish` · `/api/discard` | commit (+ push) · `git checkout --` |
| `POST /api/build` | runs the builder, streams progress |
| `GET /preview/*` | the page rendered live, with `?editor=1` |
| `GET /` | the dashboard SPA (`public/editor`, resolved via its Vite manifest) |

Plugins may add routes under `/api/plugins/<slug>/*` (§10.1) — never at the
top level, so a plugin can never shadow a core endpoint.

## 9. Git and deploy

`GitSource`, two drivers. **`LocalGit` shells out to the `git` binary** —
`status --porcelain`, `add`, `commit`, `push`, `log --format`,
`checkout --`. Not a library: the binary is already installed wherever
someone edits a site, and the alternative is a large dependency
re-implementing porcelain. `GitHubApi` (Git Data API: blobs → tree → commit →
update ref) arrives with hosted mode.

Every git operation is scoped to the four editor-owned paths, so a
developer's half-finished `.liqx` edit is never swept into an editor commit.

`DeployAdapter` is `plan.md` §6, unchanged — `name()`, `detect()`,
`emitConfig()`, `deploy()`. Plugins register adapters through the same
registry the built-in five use.

---

## 10. Extensibility

**Implemented now:** `Plugin`, `PluginManifest`, `PluginLoader`, `PluginContext`,
`HeadRegistry`, Liqx extensions, `RouteRegistry`, `BuildHooks`, `EditorRegistry`
and plugin theme layers. The [SEO port](../plugins/seo/README.md) exercises these
through the build, preview and Solid dashboard. `dependsOn()` and `fingerprint()`
are registration-time APIs; declare external inputs while registering a plugin.
Plugin settings, manifests and PHP source files are fingerprinted automatically.

The broader discovery/lifecycle/registry/JavaScript-slot design below remains the
roadmap where it goes beyond those implemented surfaces. SEO's Solid panels are
bundled with the host; plugin PHP never supplies arbitrary executable browser code.


Two kinds of extension, deliberately kept apart, because they differ in what
they can do and therefore in how much they must be trusted.

|  | **Plugin** | **Theme addon** |
|---|---|---|
| Contains | PHP, and optionally an addon | liqx, assets, schemas, locales |
| Runs | in the build / dev process | never — it is data |
| Can | anything PHP can | be rendered |
| Trust | full; it is your machine | none needed; `PathPolicy` holds |
| Ships as | `plugins/<slug>/` or a composer package | a directory, a zip, a composer package |

A plugin **may contain** a theme addon (a `theme/` directory in its manifest).
That is how a plugin ships the section its own feature needs — an SEO plugin
providing a `breadcrumbs` section — without asking the site author to install
two things that must stay in step.

### 10.1 Plugins

```
plugins/<slug>/
  plugin.yaml         manifest — the only required file
  src/                PHP, PSR-4 rooted at `namespace:`
    Plugin.php        the `plugin_class`
    Commands/         *Command.php → pillar commands
  theme/              an addon this plugin ships (§10.2)
  editor/dist/*.js    built dashboard panels
```

```yaml
slug: seo
name: SEO
version: 1.2.0
plugin_class: Pillar\Seo\Plugin
namespace: Pillar\Seo\
src: src/
theme: theme/              # optional addon
editor: editor/dist/editor.js   # the dashboard bundle — see "Dashboard panels"
```

Discovery: `plugins/` in the site, plus any composer package of type
`pillar-plugin`. **Enablement is `site.json`, not a database** — a site is a
directory, and "which plugins are on" belongs in the file that is committed
with it. Order is declared there too, and it is the order extensions apply.

`install()` / `upgrade($from, $to)` / `uninstall()` hooks exist for scaffolding
config, versions recorded in `.pillar/plugins.json`. Every hook is
best-effort, on bastet's rule: **a broken plugin must never become
unremovable.**

A plugin's `register(PluginContext $context)` resolves registries and adds to
them. Core registers first, so a registry is always present:

| Registry | For |
|---|---|
| `LiqxExtensions` | filters and globals a *theme* asks for by name |
| `DropRegistry` | site-wide drops |
| `HeadRegistry` | `<head>` tags — ported from bastet near-verbatim |
| `ContentSourceRegistry` | content from somewhere other than `content/` |
| `RouteRegistry` | extra routes: a feed, a tag archive, a redirect |
| `BuildHooks` | `beforeBuild` · `eachPage(html, route)` · `afterBuild(manifest)` |
| `FieldTypeRegistry` | a new schema field type — cast **and** editor component |
| `DeployAdapterRegistry` | a hosting target |
| `CommandRegistry` | CLI commands |
| `EditorSlotRegistry` | dashboard panels and slots |

**Routes that depend on the site's size** — a sitemap split into
`/sitemap-N.xml` chunks — register a *provider* with `routes->provide()`, not
the routes themselves. Plugins register on every `pillar dev` API request, and
the SEO port's first version walked every page at registration to count its
chunks, so every click in the dashboard paid for a sitemap nobody had asked
for. A provider runs when a build writes the files or the preview requests one.

Two ordering rules, taken from bastet's `HeadRegistry` because they are what
make output deterministic regardless of install order:

- contributors run in ascending `priority()`, ties broken by registration
  order — 0–99 core's defaults, 100 a plugin, 900+ last-resort fallbacks;
- **the first contributor to claim a key wins.** Two plugins both wanting the
  canonical URL produce one canonical, and the higher-precedence one wins
  rather than the last installed.

`HeadTag` escapes for you: `title()`, `meta()`, `property()` and `link()`
escape attribute values and text; `jsonLd()` encodes with `JSON_HEX_TAG`, so
a `</script>` inside a description cannot end the block early. `raw()` passes
markup through untouched and the caller owns its safety.

Re-registering a built-in filter name overrides it, because core's extensions
apply first. That is deliberate, and a real footgun — allowed for the same
reason a plugin may run arbitrary PHP: it is your machine and your site.

**Dashboard panels.** A plugin's UI is loaded at runtime, never compiled into
the dashboard. The dashboard's own bundle contains no plugin code at all; it
asks `GET /api/editor/plugins` which bundles the site's *enabled* plugins
ship, and loads those. A disabled plugin's panels therefore do not exist —
there is no flag to check anywhere in the frontend.

The contract a bundle meets, whatever it is built with:

1. It is a classic script (an IIFE), declared as `editor:` in `plugin.yaml`. A
   stylesheet beside it with the same name and `.css` is loaded too.
2. It **takes Solid from the host**: `solid-js`, `solid-js/web`,
   `solid-js/store` and `@pillar/editor` are read from `window.PillarHost`,
   never bundled. A second Solid in the page is a second reactive runtime —
   effects in a plugin's component would never re-run for the dashboard's
   signals, and nothing reports it.
3. It ends by calling `PillarHost.define(slug, { register })`. `register(host)`
   receives a host scoped to that plugin and fills slots:

```ts
export function register(host: ScopedHost) {
  host.registerSlot('settings.panel', MySettingsPanel);        // replaces the generic form for this plugin's panel
  host.registerSlot('content.item.sidebar', MyEntrySidebar);   // beside an entry in the content editor
}
```

`@pillar/editor` (`apps/editor/src/plugins/public.ts`) is the whole public
surface: `Field`, `SettingInput`, `ImagePicker`, `controlClass`, `mediaUrl`,
`api.preview()`, `api.markdown()`, and the slot prop types. It is also what a
plugin's TypeScript resolves the import to, so the dashboard's type-check
compiles bundled plugins against exactly that API. Adding an export is adding
to a public API; removing one breaks plugins.

A plugin ships the CSS utilities it uses — the dashboard is built without ever
seeing plugin source, so it cannot have generated them. Tailwind's theme and
utilities layers only, no reset; the dashboard's `ed-*` and `sam-*` classes
are global and can be used directly.

Bundled plugins are built by `npm run build` in `apps/editor`
(`build-plugins.mjs`: Vite, externals mapped to the host globals, the
`define()` call appended as a footer). A third-party plugin ships its bundle
prebuilt. Every failure is contained to its plugin: a bundle that 404s, never
calls `define()`, or throws in `register()` is reported in the dashboard and
skipped — it cannot blank the page for everyone else.

### 10.2 Theme addons

An addon is a theme layer with no PHP in it, ever. It ships any of
`sections/`, `blocks/`, `snippets/`, `assets/`, `schemas/`, `locales/`, plus
an `addon.yaml`:

```yaml
slug: blog-pack
name: Blog pack
version: 0.3.0
requires: { pillar: '^1.0' }
provides:
  sections: [post-list, post-header, related-posts]
  schemas: [posts]
```

`provides` is documentation *and* a check: `pillar check` fails when a
declared section is missing, and warns when an addon ships a section it did
not declare. That turns "this addon quietly overrode my hero" into a build
error rather than a mystery.

Installation is a directory plus a line in `site.json` — nothing to compile,
nothing to trust. The cascade in §4 does the rest: the site can still override
anything the addon ships by putting a file of the same name in its own
`sections/`, and `--why` says which layer won.

Because an addon is inert data, this is the safe distribution format — the one
to point people at. A plugin is for when PHP is genuinely required.

---

## 11. Sequencing

| | Deliverable | Done when | |
|---|---|---|---|
| **B1** | `Pillar\Render` — `LayeredFileSystem`, `EnvironmentFactory`, drops, `SectionRenderer`, `PageRenderer` | one `.liqx` plus one `.md` render to correct HTML in a unit test | **done** |
| **B2** | `Pillar\Schema` + generated field types + `pillar check` | catches a bad field type, an unknown section in a template JSON, a content file violating its schema | **done** |
| **B3** | `Pillar\Build` — routes, incremental, assets, images; `pillar build` / `serve` | a 500-page site builds; an unchanged rebuild is near-instant | **done** (images and `serve` outstanding) |
| **B4** | `Pillar\Dev` — the §8 API and `/preview` | the editor drops its fixtures and drives real files | **done** |
| **B5** | `Pillar\Plugin` + the registries; core's sitemap/feed/search rewritten onto them; **the SEO plugin ported from bastet** | removing the sitemap plugin removes the sitemap, and nothing else changes | SEO and supporting registries done; remaining registries/feed/search pending |
| **B6** | Theme addons — the cascade, `addon.yaml`, `--why` | an addon adds a section, the site overrides it, and `--why` explains both | cascade + `why` done in B1 |
| **B7** | `Pillar\Git` + `Pillar\Deploy` | `pillar deploy` puts the same `dist/` on Vercel and on Pages | |

B1–B3 are testable with no HTTP at all, which is why they come first. B4 is
mostly wiring, because the frontend already fixed the contract. B5 lands
before B6 because an addon is the *data half* of what a plugin can ship, and
building it second means the cascade only has to be designed once.

The registry seam should exist from B1 even while empty — `EnvironmentFactory`
applying an (initially empty) list of `LiqxExtension`s costs nothing now and
avoids reworking the render path later.

## 12. Decisions to make now

- **Field types must be generated, not hand-kept** (§5). First commit of B2.
- ~~**`pillar dev`'s server model.**~~ Settled: `PHP_CLI_SERVER_WORKERS=4`,
  set by `DevCommand` when it spawns the server. Two further things bit while
  building it, both worth knowing before touching `Dev\Server`:
  - **Take the path from `REQUEST_URI`, not `getPathInfo()`.** PHP's built-in
    server rewrites `SCRIPT_NAME` to the requested file whenever that file
    exists under the document root, and Symfony derives its base URL from
    `SCRIPT_NAME` — so `/assets/base.css` arrived as a path info of `/` and
    the dashboard's HTML was served in place of the stylesheet. Only paths
    that exist on disk were affected, which is exactly the set that looks
    like it must work.
  - **Set content types explicitly.** A module script served as `text/html`
    is refused by the browser's strict MIME check for modules, and the only
    symptom is a blank page with an empty console.
- **Where the sandbox line sits.** liqx's frontmatter is already sandboxed —
  no loops, no `new`, forbidden globals — and `PathPolicy` keeps `.php` out of
  a site or an addon. That is enough for a local tool where plugins are
  trusted PHP. It is *not* enough if hosted mode ever renders someone else's
  site with someone else's plugins; decide that then, explicitly, rather than
  assuming the local answer carries over.
- **Plugin determinism vs. the build cache** (§7). Ship `dependsOn()` and
  `fingerprint()` in the first version of the plugin API. Retrofitting them
  means every existing plugin is silently wrong.
- **Media in git**, unchanged from `plan.md` §5 — decide before the image
  picker ships.
