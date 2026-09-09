# Pillar — plan

A **local-first static site generator** built on [`phpmystic/liqx`](../phpmystic/liqx),
with a **visual dashboard** you run on your own machine, schema-driven editing,
GitHub as the source of data, and pluggable **deploy adapters** (Vercel,
Netlify, Cloudflare, GitHub Pages).

The whole product in one line: `pillar dev` opens a dashboard, you edit,
`pillar build` writes `dist/` — plain HTML files, no server on the public path.

| Detail | Read |
|---|---|
| Where the backend stands (B1–B3 built) | [docs/backend.md §11](docs/backend.md) |
| The PHP backend — packages, seams, render path, plugins and theme addons | [docs/backend.md](docs/backend.md) |
| The dashboard SPA — SolidJS, ported from bastet's editor | [apps/editor/README.md](apps/editor/README.md) |

---

## 1. Where the pieces come from

### liqx gives us the engine

`phpmystic/liqx` is a complete, host-agnostic render engine and nothing more.
What we build on:

- `Template::parse()` → `render()`; `Environment` with three extension points —
  **filters**, **globals** (`render()`, `section()`, `now`), and two
  `FileSystem`s (snippets, sections).
- `Environment::setCompiledTemplateDir()` compiles templates to native PHP
  closures keyed by a content hash. This is what makes a full-site build fast;
  turn it on from day one.
- `Environment::capabilities()` already exposes registered filters/globals for
  tooling (LSP completion). The VS Code and PhpStorm extensions in
  `liqx/editors/` work for theme developers unchanged.
- `<schema>` today is **only a props type-checker** (`src/SchemaValidator.php`):
  scalar tokens + unions, validates only keys that are present, and
  `validate()` early-returns when frontmatter never did `return {...}`.
  Extra top-level keys in the JSON are ignored — which is the opening we need.

Known friction to handle: `LocalFileSystem` is flat and **rejects `/` in
names**, so we need our own `FileSystem` for `sections/` `blocks/` `snippets/`.

### bastet gives us the editor model

`bastet` (Sworen) already proved the editor half against liqx. What we port:

| From bastet | What it is | Pillar's version |
|---|---|---|
| `Theming/Schema/SchemaParser` | **Regex**-extracts `<schema>` instead of parsing the doc — the dashboard reads every schema on every load | keep the regex, keep the memoization |
| `Schema/SectionSchema`, `Setting`, `FieldType`, `SettingsCaster` | 21 setting types, blocks, presets, `max_blocks`, `enabled_on` | drop commerce types, add SSG types |
| `templates/*.json` → `{ sections, order }` | page composition owned by the *editor*, not the theme source | identical |
| `Contracts/TemplateStore` (draft/live/publish/revisions/revert) | three DB tables | **replaced by git** — see §5 |
| `Editor/EditorPreview` | `?editor=1` query flags turn the site itself into the canvas | same, local preview server |
| `apps/editor` React SPA | one input component per `FieldType`; `lib/blocks.ts` owns the block tree | same shape, shared type list |
| "a broken section renders empty, the page still ships" | `LiqxPageRenderer` | same, plus a build-time error report |

**The key idea we inherit:** the `<schema>` block is read by two different
consumers — liqx validates `props` types at render, Pillar reinterprets the
same JSON as an editor manifest. Bastet proves it works. Keep the engine pure;
Pillar owns the reinterpretation.

### git replaces the store

Bastet needed `theme_templates` / `theme_settings` / `theme_revisions` tables.
Locally, and with GitHub as the source, **git already is that store**:

| `TemplateStore` concept | Git |
|---|---|
| `live` | `main` |
| `draft` | working tree (local) / `pillar/draft` branch (shared) |
| `saveTemplate` | write file, then commit |
| `publish` | commit + push (or merge the draft branch) |
| revisions | `git log -- templates/ content/` |
| `revert` | `git revert` |
| `hasDraft` | `git status --porcelain` non-empty |

Local-first consequence: **saving is just writing a file.** Nothing needs a
network, a token, or a database. Git and GitHub are the *sync* layer, not the
storage layer.

---

## 2. Local-first: what actually runs on your machine

```
pillar new mysite        scaffold site.json, layout/, sections/, content/, config/
pillar dev               dashboard + live preview at http://127.0.0.1:7777
pillar build             render everything → dist/
pillar serve             static file server over dist/ (verify the real output)
pillar check             validate schemas, templates, content against schemas/
pillar deploy [target]   run a deploy adapter (§6)
```

`pillar dev` boots one small PHP process serving three things:

1. **`/` — the dashboard** (React SPA, built assets shipped with Pillar).
2. **`/preview/*` — the live site**, rendered on demand through liqx with
   `?editor=1`, sections wrapped in `data-pillar-section-id` for
   click-to-select. Rendering one route with the compiled-template cache warm
   is milliseconds; never serve the dashboard preview from `dist/`.
3. **`/api/*` — a JSON API over the working tree**, listed in §4.

No database, no queue, no auth in local mode. The site under edit is just a
directory. `dist/` is the deliverable and can be opened with `file://` for a
site with relative URLs.

---

## 3. Site layout

```
site.json                     name, base_url, output dir, collections, deploy target
layout/theme.liqx             required
templates/*.json              { "sections": {...}, "order": [...] }   ← editor-owned
templates/post.json           the template every item in `posts` renders through
sections/*.liqx               <schema> = settings manifest
blocks/*.liqx
snippets/*.liqx
config/settings_schema.json   site-wide setting panels
config/settings_data.json     current values                          ← editor-owned
schemas/*.json                CONTENT model — post.json, author.json
content/posts/*.md            YAML frontmatter + body                 ← editor-owned
content/pages/*.md
data/*.json                   menus, redirects                        ← editor-owned
assets/*
plugins/<slug>/               PHP extensions — see docs/backend.md §10.1
dist/                         build output (gitignored)
.pillar/                      compiled-template cache, image cache, build manifest
```

A site may also layer in **theme addons** — liqx sections, blocks, snippets,
assets and schemas with no PHP in them, listed in `site.json` and resolved
site → addon → theme (docs/backend.md §4, §10.2).

Allowlist extensions the way bastet's `ThemePackage` does — **no `.php`, ever,
allowlisted not blocklisted**. The four *editor-owned* paths are the only
things the dashboard writes; everything else is developer territory, edited in
an IDE with the existing liqx extensions.

---

## 4. The schema contract — write this down before writing code

Two flavors, one vocabulary.

**Presentation schema** — the `<schema>` block inside a `.liqx` section/block:

```json
{
  "name": "Hero",
  "props":    { "title": "string" },        // liqx SchemaValidator, unchanged
  "settings": [ { "id": "heading", "type": "text", "label": "Heading" } ],
  "blocks":   [ { "type": "slide", "name": "Slide", "settings": [] } ],
  "presets":  [ { "name": "Default", "settings": {} } ],
  "max_blocks": 6,
  "enabled_on": ["index"]
}
```

Verified safe: liqx's `SchemaValidator::validate()` returns early unless
frontmatter returned `props`, so a settings-only schema never trips it, and
unknown top-level keys are ignored.

**Content schema** — `schemas/post.json`, a plain field list in the *same*
setting-type vocabulary. This is what turns a markdown file's frontmatter into
a CMS form. The same React inputs render both.

**Field types.** Start from bastet's `FieldType` (21 cases), drop the commerce
ones (`offer`, `courier`, `city_list`), add SSG ones:

```
text textarea richtext markdown number range checkbox select radio color
url image video html code header paragraph
page collection_item collection menu date tags
```

**One shared list, generated both ways.** Bastet's own `apps/editor/CLAUDE.md`
records the failure mode: `SettingInput.tsx` switches on ~15 types PHP rejects,
and `Setting::fromArray()` **throws** on an unknown type, so one stale type
kills the whole section. Pillar defines the list once
(`schema/field-types.json`) and generates the PHP enum and the TS union from
it, so they cannot drift.

Adding a field type stays a three-sided change — parse/cast, input component,
render-side value — but the first side becomes mechanical.

**Dashboard API** (all over the working tree, all local):

```
GET  /api/schemas                    sections + blocks + settings + content models
GET  /api/templates                  names + section trees
GET  /api/templates/{name}           { sections, order }
PUT  /api/templates/{name}
GET  /api/settings   PUT /api/settings
GET  /api/content/{collection}       list
GET  /api/content/{collection}/{slug}   PUT / POST / DELETE
POST /api/media                      upload → assets/, returns the built URL
GET  /api/history                    git log over editor-owned paths
POST /api/publish                    commit (+ push, if a remote is configured)
POST /api/build                      run a build, stream progress
```

---

## 5. GitHub as the source of data

Optional in local mode, load-bearing for teams and for hosted builds.

`GitSource` behind one interface, two drivers:

- **local** — a real clone. The default. Read = filesystem, write = file + git
  commands. Fast, offline, no tokens.
- **api** — GitHub App installation token. Read the whole tree in one Trees API
  call with an ETag; write via the **Git Data API** (blobs → tree → commit →
  update ref) so a multi-file publish is *one atomic commit*. Contents API only
  for single-file writes. Used by the hosted dashboard and CI.

**Draft strategy.** Solo/local: the working tree *is* the draft; publish =
commit + push. Shared: branch-per-draft (`pillar/draft/<slug>`), publish = PR
or merge — that also gets you review and concurrent editors for free.

**Rebuild on push** is a GitHub Action running `pillar build` and handing
`dist/` to the deploy adapter. That is the entire production path — no server
anywhere.

**Media caveat, decide early:** image uploads through the Git Data API are
base64 blobs and grow the repo permanently. Either accept it (simple,
versioned, fine for most sites) or push media to object storage and commit only
URLs. Pick before the image picker ships.

---

## 6. Deploy adapters

`dist/` is portable HTML, but hosts differ in ways that must be *emitted*, not
assumed: clean URLs vs. `.html`, trailing-slash policy, 404 wiring, redirect
and header syntax, cache-control on hashed assets.

```php
interface DeployAdapter {
    public function name(): string;
    public function detect(): bool;                   // vercel.json present, VERCEL env, …
    public function emitConfig(BuildManifest $b): void; // write host config into dist/
    public function deploy(BuildManifest $b): int;      // shell out to the host CLI
}
```

| Adapter | Emits | Deploy |
|---|---|---|
| `static` (default) | nothing; directory-index `index.html` per route | copy / rsync |
| `vercel` | `vercel.json` — `cleanUrls`, `trailingSlash`, `redirects`, `headers` | `vercel deploy --prebuilt` |
| `netlify` | `_redirects`, `_headers`, `netlify.toml` | `netlify deploy --dir=dist` |
| `cloudflare` | `_redirects`, `_headers`, `_routes.json` | `wrangler pages deploy dist` |
| `github-pages` | `.nojekyll`, `CNAME`, workflow file | Actions artifact upload |

Two rules keep this honest:

1. **The renderer never asks which host it's on.** Routes are emitted one way
   (`about/index.html`); the adapter's config file reconciles the host's URL
   policy with that. `redirects` come from `data/redirects.json`, one source,
   translated per host.
2. **`pillar serve` mimics the default adapter's URL policy**, so what you see
   locally is what the host serves.

`site.json` names the target; `pillar deploy` uses it, `pillar deploy netlify`
overrides. Adapters are the last thing built and the easiest to add — a new one
is one class and one config template.

---

## 7. Milestones

**M1 — Render one page.**
`PillarFileSystem implements Liqx\FileSystem` resolving `sections/`, `blocks/`,
`snippets/` subdirectories (liqx's `LocalFileSystem` bans `/`). `ContentStore`
reads markdown + YAML frontmatter, validates against `schemas/*.json`, wraps
rows in `Drop`s (`SiteDrop`, `PageDrop`, `PostDrop`, `CollectionDrop`,
`MenuDrop`). Port bastet's page-render composition: template JSON → ordered
sections → layout. `setCompiledTemplateDir('.pillar/compiled')` on.
*Done when:* one `.liqx` template + one markdown file render to a correct HTML
string.

**M2 — `pillar build` + `pillar serve`.**
Route table = static templates + one route per content item per collection.
Render all → `dist/`. Add the SSG filters liqx doesn't ship (it already has 60+
including `date`, `slugify`, `truncatewords`, `strip_html`, `money`):
`markdownify`, `asset_url` (content-hashed), `image_url`/`image_tag`
(build-time resize, cached by source hash), `absolute_url`, `excerpt`, `t`.
Emit `sitemap.xml`, RSS, and a client-side search index.
**Incremental builds:** hash (content item + template JSON + every `.liqx` in
its dependency set + settings) → skip unchanged routes; capture the dependency
set by instrumenting the `FileSystem` during render. Write `.pillar/manifest.json`.
*Done when:* a 500-page site builds, and an unchanged rebuild is near-instant.

**M3 — Schema layer.**
`schema/field-types.json` + codegen. Regex `SchemaParser` (memoized),
`SectionSchema`, `Setting`, `SettingsCaster`, content-model parsing,
`pillar check` validating all of it. One broken section is *skipped and
reported*, never fatal.
*Done when:* `pillar check` catches a bad setting type, an unknown section in a
template JSON, and a content file that violates its schema.

**M4 — The dashboard.** *(frontend built — `apps/editor`, SolidJS)*
`pillar dev`: preview server + JSON API + the SPA. Canvas = iframe with
`?editor=1` and `data-pillar-section-id`, postMessage for select/reorder/scroll.
Left sidebar = section tree (port `lib/blocks.ts` **with its tests** — bastet
flags it as the one place a bug corrupts saved data). Right sidebar =
`SettingInput` switch. Content editor = form from `schemas/*.json` + markdown
body. Save = write file. History/revert = git.
*Done when:* a non-developer can add a section, fill its settings, write a
post, and hit build — never touching a text editor.
*Where it stands:* the SPA runs against fixtures (`npm run dev` in
`apps/editor`) with the section tree, the schema-driven settings form, the
content editor, publish and history all working. What remains is the PHP side
of §4's API, the real preview, and block add/reorder inside a section.

**M5 — GitHub + deploy adapters.**
`GitSource` (local + api drivers), publish/push, the Actions workflow, and the
five adapters in §6.
*Done when:* `pillar deploy` puts a real site on Vercel and on Pages from the
same `dist/`.

**M6 (optional) — hosted dashboard.**
Same SPA, GitHub OAuth, repo picker, api driver instead of a clone, webhook
rebuild. Nothing from M4 changes.

---

## 8. Risks and open decisions

- **The dual-consumer `<schema>`** is the load-bearing trick of the whole
  design. Write the contract down in one file before writing the parser, and
  generate both sides of the field-type list from it.
- **Editor-owned vs. developer-owned files.** If the dashboard ever rewrites a
  `.liqx`, formatting fights with git begin. Hold the line: the dashboard
  writes JSON, markdown, and assets — never templates.
- **Incremental-build correctness** is easy to get subtly wrong; a stale page
  is worse than a slow build. Ship `pillar build --force` and make CI use it.
- **Media in git** (§5) — decide before the image picker.
- **Draft model** — working tree vs. branch-per-draft. Choose branch-per-draft
  now if more than one person will ever edit; retrofitting is painful.
- **Trailing slashes** — pick one policy in M2 and make every adapter conform.
  Changing it later invalidates every URL you've published.
