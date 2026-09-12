---
title: The visual editor
summary: Pages as sections and blocks beside a live preview — select, edit, reorder, add — with theme settings, undo, and a mobile preview.
section: editing
order: 41
---
**Customize** in the dashboard opens the visual editor at `/editor/<template>`. The left side is the page tree and the form; the right, the page, rendered live.

## The page tree

- **Layout sections** — the header and footer from `templates/layout.json` — bracket the page's own sections.
- Click a section to edit its settings. Hover for **remove** and **hide**; drag page sections to reorder them. Layout sections do not move.
- Expand a section to see its **blocks**; click a block to edit it; hover a block to add a child, move it, duplicate, hide or remove it. See [Blocks](/docs/blocks/).
- **Add section** offers every section the current template allows, with its presets.

The template switcher in the top bar moves between pages — the home page, the blog, an entry template.

## The form

A section's or block's `<schema>` is its form: every setting, grouped by its headings, with conditions applied and [field types](/docs/field-types/) drawn as their controls. **Custom CSS** at the bottom styles that one instance — `&` is its wrapper.

Changes save on their own, a moment after you stop typing, to the template's JSON, and the preview re-renders.

## The preview

The page as the build will write it — same renderer, same templates, drafts included. Click a section in the preview to select it; the selected section is outlined. The phone icon switches to a mobile width.

## Theme settings

The theme settings tab in the top bar shows the theme's [settings](/docs/theme-settings/): colours, widths, the site's name. Settings declaring `css_var` update the preview as you drag; the rest re-render it.

## Undo, build, publish

- **Undo** and **redo** cover every section and block change.
- **Build** runs `pillar build` from the editor.
- The **status pill** and **Publish** open the commit dialog, with the option to commit without pushing. **More actions → Discard changes** throws the working tree's changes away.

## What it writes

Only `templates/*.json` (sections, blocks, their settings, custom CSS) and, from theme settings, `config/settings_data.json`. The templates themselves — the `.liqx` files — are the developer's.
