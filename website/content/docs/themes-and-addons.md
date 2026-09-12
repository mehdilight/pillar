---
title: Themes and addons
summary: Stack folders under your site — a theme at the bottom, addons above — and override any file by putting your own at the same path.
section: sites
order: 15
---
## Layers

A site is looked up as a stack of folders, top first:

1. **the site** itself;
2. its **addons**, in the order `site.json` lists them;
3. **plugins' theme folders**;
4. the **theme**.

Any file under `sections/`, `blocks/`, `snippets/`, `layout/`, `templates/`, `config/`, `schemas/`, `assets/` or `locales/` is taken from the highest layer that has it. The site's `sections/hero.liqx` shadows the theme's; everything the site does not have falls through.

Content (`content/`), navigation (`data/menus.json`) and media uploads are always the site's own.

## Declaring them

```json
{
  "theme": "sana",
  "addons": ["../shared/brand", "vendor-addons/analytics"]
}
```

- `theme` is a folder name under `themes/`.
- `addons` are paths relative to the site.

A missing theme or addon is an error, not a silent fallback.

## Which layer wins?

```bash
pillar why sections/hero.liqx
```

prints the layer that provides the file and every layer it shadows.

## This site is built this way

This documentation lives in the `website/` folder of the Pillar repository, and its `site.json` says:

```json
{ "name": "Pillar", "addons": ["../examples/starter"], "plugins": ["seo"] }
```

The starter provides the design — layout, header, footer, hero, feature grid, post list and stylesheet. The docs site adds only what it needs:

- its own `content/`, `data/menus.json` and `config/settings_data.json`;
- `templates/index.json`, `layout.json`, `blog.json` and `doc.json` — its pages;
- `schemas/docs.json` and `schemas/posts.json` — the docs gain a *Summary* and a *Sidebar group*, the posts become a changelog;
- `sections/docs-layout.liqx` — shadowing the starter's docs layout with a grouped sidebar and previous/next links.

Improve the starter and this site improves with it.

## Media from layers

Images in a theme's or addon's `assets/` show in the media library, marked as theme images: they can be used and given alt text, but not deleted — they belong to their package.
