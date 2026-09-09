---
title: Themes and addons
order: 4
---
Every lookup resolves through a cascade: your own files, then any addons you
list in `site.json`, then the theme.

```
sections/hero.liqx        ← yours always wins
addons/blog-pack/sections/hero.liqx
themes/basic/sections/hero.liqx
```

So you can override one section of a theme by dropping a file of the same name
into your own `sections/`, with nothing to fork and nothing to eject from.

When it is not obvious which file won:

```bash
pillar why sections/hero.liqx
# wins     site      ./sections/hero.liqx
# shadowed addon:blog-pack  ./addons/blog-pack/sections/hero.liqx
```

An addon is inert data — templates, assets, schemas, locales, no PHP — so
installing one is copying a directory.
