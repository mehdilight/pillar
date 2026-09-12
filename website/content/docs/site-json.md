---
title: site.json
summary: The file that makes a folder a Pillar site — every key it takes.
section: reference
order: 71
---
```json
{
  "name": "Pillar",
  "base_url": "https://example.com",
  "output": "dist",
  "theme": "sana",
  "addons": ["../examples/starter"],
  "plugins": ["seo"],
  "deploy": "static",
  "images": {
    "widths": [320, 640, 960, 1280, 1920],
    "quality": 80,
    "format": "webp",
    "sizes": "(min-width: 768px) 720px, calc(100vw - 48px)"
  }
}
```

| Key | Default | |
| --- | --- | --- |
| `name` | the folder's name | The site's name — `site.name`, and `site.title` when the theme declares no `site_title`. |
| `base_url` | none | The public address, no trailing slash. Needed for canonical URLs, the sitemap and structured data; without it they are left out. |
| `output` | `dist` | Where `pillar build` writes, relative to the site. |
| `theme` | none | A folder under `themes/`, the bottom layer. |
| `addons` | `[]` | Folders layered above the theme, relative to the site. |
| `plugins` | `[]` | Plugins to load: bundled slugs, slugs under `plugins/`, or paths. |
| `deploy` | `static` | Reserved for deploy adapters. |
| `images` | see [Images](/docs/images/) | Resized widths, quality, format, and `sizes` for markdown images. |

`site.json` is the developer's file: the dashboard reads it and never writes it. Changing it rebuilds every page.
