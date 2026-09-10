# Pillar editor

The dashboard: a SolidJS SPA that reads a site's `<schema>` blocks and writes
`templates/*.json`, `config/settings_data.json` and `content/**/*.md`.

```bash
npm install
npm run dev        # http://localhost:7777
npm run build      # → ../../public/editor (manifest-driven; PHP resolves entries)
npm run typecheck
npm test           # the block-tree unit tests
```

`npm run dev` works with **no backend**: `src/api/client.ts` probes
`/api/health` once and falls through to the fixture site in
`src/api/fixtures.ts` when nothing answers. Edits are held in memory, the
top bar says *Demo data*, and the canvas says *No preview server* instead of
showing an empty iframe. With `pillar dev` up on `127.0.0.1:7788`, the same
code paths hit the real API and the real preview through Vite's proxy.

## Layout

```
src/app.tsx                 entry; mounts on #pillar-editor-root
src/pages/Edit.tsx          the one screen: top bar, a rail, a canvas
src/store/editor.ts         all editor state — sections, history, save debounce
src/api/client.ts           the API, with the fixture fallback
src/api/fixtures.ts         a demo site: the API contract, written down
src/components/             chrome: TopBar, LeftSidebar, Canvas, panels, modals
src/components/ui/          one component per schema field type, plus primitives
src/lib/blocks.ts           block-tree manipulation — the tested part
src/types/index.ts          the data model
src/css/                    samsara.css + editor.css, carried over from bastet
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
| react-router | none yet — one screen; the template lives in the hash |
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

## Two things worth knowing before editing this

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
