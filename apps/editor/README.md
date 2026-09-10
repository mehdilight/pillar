# Pillar dashboard

A SolidJS SPA with two parts: a CMS for content, media, settings and
publishing, and a visual editor for how the site looks. It reads a site's
`<schema>` blocks and writes `templates/*.json`, `config/settings_data.json`,
`config/plugins/*.json` and `content/**/*.md`.

```bash
npm install
npm run dev        # http://localhost:7777
npm run build      # → ../../public/editor (served under /_pillar/), plus bundled plugins
npm run typecheck
npm test           # the block-tree unit tests
```

`npm run dev` works with **no backend**: `src/api/client.ts` probes
`/api/health` once and falls through to the fixture site in
`src/api/fixtures.ts` when nothing answers. Edits are held in memory, the
top bar says *Demo data*, and the canvas says *No preview server* instead of
showing an empty iframe. With `pillar dev` up on `127.0.0.1:7788`, the same
code paths hit the real API and the real preview through Vite's proxy.

## Two apps, one router

The dashboard is two applications behind `@solidjs/router`:

| Path | What |
|---|---|
| `/` | CMS overview |
| `/content/:collection` | a collection's entries, as a table |
| `/content/:collection/new`, `/content/:collection/:slug` | the entry editor |
| `/types` | content types and their fields |
| `/media` | the media library |
| `/settings` | plugin settings (SEO…) and site facts |
| `/publish` | uncommitted changes, commit, history, discard |
| `/editor/:template?` | **the visual editor** — full screen, its own chrome |

The **CMS** (`src/cms/`) is bastet's admin, ported: its shell (dark header,
grey rail), its `Page` title bar, and its design-system primitives in
`cms/ui/ds.tsx` with the class strings unchanged. It owns content, media,
plugin settings and publishing.

The **visual editor** (`src/editor/`) is bastet's theme editor, ported
earlier. It is only for how the site *looks*: a page's sections beside a live
preview, and the theme's settings. It is reached from "Customize" and left by
its exit button; the page being edited is the route, so it can be linked and
reloaded.

`pillar dev` serves the built files under `/_pillar/` — a prefix no route or
site path would choose — and every other path the router owns gets the app.

## Layout

```
src/app.tsx                 the router; plugins load here, once, for both apps
src/cms/                    the CMS
  Layout.tsx                header + rail
  ui/ds.tsx, ui/Page.tsx    bastet's design-system primitives, in Solid
  pages/                    Overview, Collection, Entry, Types, Media, Settings, Publish
src/editor/                 the visual editor: screen, top bar, sections, canvas
src/components/             shared by both: SettingInput, MediaLibrary, ui/*
src/store/                  editor.ts (sections, undo), status.ts, content.ts
src/plugins/                host.ts + public.ts — see "Plugin panels"
src/api/                    the client, with its fixture fallback
src/css/                    app.css (both token sets), samsara.css, editor.css
```

## Ported from bastet, deliberately

The visual language, the class names and the markup are bastet's theme editor
(`apps/editor` there), so both editors stay one product. `css/samsara.css` and
`css/editor.css` are copied verbatim — only the mount-point class changed
(`.lithos-editor-root` → `.pillar-editor-root`). `lib/blocks.ts` and its tests
are copied unchanged; they are framework-agnostic.

What is not React here, and what replaced it:

| bastet | here |
|---|---|
| React 18 + hooks | Solid signals; `props.x` read directly, never destructured |
| Radix dialog/popover/tooltip | local `ui/Modal`, `ui/Dropdown`, `ui/Tooltip` — same markup, no Solid port of Radix exists |
| dnd-kit | native HTML5 drag on the section rows |
| TanStack Query | `createResource` + the module-level store |
| react-router | `@solidjs/router` — path routing for both apps |
| i18next | none yet — English strings inline |

## Plugin panels

Plugins' dashboard UI is loaded at runtime from their own bundles, never
compiled in — `src/plugins/host.ts` publishes `window.PillarHost`, loads the
bundles the site's enabled plugins ship, and collects the slots they register;
`src/plugins/public.ts` is `@pillar/editor`, the only thing a plugin may
import. `npm run build` builds the bundled plugins too (`build-plugins.mjs`).
The contract is in `docs/backend.md` §10.1.

Nothing under `src/` may import from `plugins/`. `grep -r "plugins/" src` should
only find `src/plugins/`.

## Worth knowing before editing this

**Two Tailwind builds in one page collide.** A plugin ships its own
utilities, and without scoping its `.hidden` beat the dashboard's `md:block`
— the CMS rail vanished the moment the SEO bundle loaded. Plugin utilities
are wrapped in `@scope ([data-pillar-plugin=…])` by `build-plugins.mjs`, and
every slot renders inside that attribute. Relatedly, never define a colour
token whose name is also a size (`--color-base` made `text-base` near-white).

**Never read a `<Show>` accessor inside a nested `<Show>`'s condition.**
Doing it hangs the tab outright — no error, no console output, the page simply
stops answering. Both `Canvas.tsx` and `LeftSidebar.tsx` hit this and now read
`editor.activeSection()` from the store instead; the comments there say so.

**Field types are a contract, not a UI choice.** Every `case` in
`SettingInput.tsx` must exist in PHP's `FieldType` too — `Setting::fromArray()`
throws on an unknown type, so a type this app offers and PHP rejects stops the
whole section from parsing. bastet drifted ~15 types this way. Generate both
sides from `schema/field-types.json` (see `plan.md` §4) rather than keeping two
lists in step by hand.
