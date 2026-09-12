---
title: Project structure
summary: Every folder a Pillar site can have, what reads it, and which ones the dashboard writes to.
section: start
order: 4
---
```text
my-site/
├── site.json                 the site: name, URL, theme, addons, plugins, images
├── layout/
│   └── theme.liqx            the page shell: <head>, header, main, footer
├── sections/*.liqx           the building blocks of a page, each with a <schema>
├── blocks/*.liqx             block types any section may accept
├── snippets/*.liqx           partials and components (<PostCard post={…} />)
├── templates/
│   ├── layout.json           the sections every page shares (header, footer)
│   ├── index.json            the home page: its sections, in order, with settings
│   ├── blog.json             another page, at /blog/ — may paginate a collection
│   ├── post.json             how one entry of `posts` renders
│   └── 404.json              written to /404.html
├── schemas/*.json            content types: the fields each collection's entries have
├── content/<collection>/*.md the entries, markdown with frontmatter
├── config/
│   ├── settings_schema.json  the theme's settings panels (Colors, Layout…)
│   ├── settings_data.json    their values
│   ├── media.json            alt text for images in the media library
│   └── plugins/<slug>.json   each plugin's settings
├── data/menus.json           navigation link lists
├── assets/                   CSS, JS, fonts, images; uploads land in assets/uploads/
├── locales/                  reserved for translations
├── plugins/<slug>/           plugins local to this site
├── themes/<name>/            a theme, when site.json names one
└── dist/                     the build output (ignore it in git)
```

A `.pillar/` folder holds caches — compiled templates, resized images, the build manifest. Ignore it in git too.

## Who writes what

| Path | Written by the dashboard when you… |
| --- | --- |
| `content/` | save an entry, create or delete one |
| `schemas/` | edit a content type's fields |
| `templates/` | change sections, blocks or their settings in the visual editor |
| `config/settings_data.json` | change theme settings (Customize → Theme settings, or Settings) |
| `config/plugins/` | change a plugin's settings |
| `config/media.json` | edit an image's alt text |
| `data/menus.json` | edit navigation |
| `assets/uploads/` | upload an image or file |

Everything else — `layout/`, `sections/`, `blocks/`, `snippets/`, `site.json` — is the developer's. The dashboard never touches it.

## Allowed files

Pillar serves and copies only known folders and extensions: templates (`.liqx`), data (`.json`, `.yaml`, `.md`, `.txt`), styles and scripts (`.css`, `.js`, `.map`), fonts, images (`png`, `jpg`, `gif`, `webp`, `avif`, `svg`, `ico`) and downloads (`pdf`, `zip`, `csv`, `docx`, `xlsx`, `pptx`, `mp3`, `mp4`, `webm`). A path with `..`, or a folder outside that list, is refused — by the dev server and by the build.

## Layers

A site can stack other folders under itself: a **theme** at the bottom, **addons** above it, then plugins' theme folders, then the site. A file is looked up top-down — the site's `sections/hero.liqx` shadows the theme's. `pillar why sections/hero.liqx` tells you which layer a file comes from. See [Themes and addons](/docs/themes-and-addons/).
