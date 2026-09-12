---
title: Images
summary: Images are resized when the site is built — every JPEG, PNG and WebP gets smaller WebP copies — and pages point browsers at them with srcset, dimensions and lazy loading.
section: media
order: 31
---
## What the build does

For every JPEG, PNG and WebP under `assets/`, the build writes copies at each configured width **narrower than the image**, as WebP by default:

```text
assets/uploads/screenshot.png                     2184 px, 96 KB  (the original)
assets/uploads/screenshot.233a244c23-320w.webp    2.5 KB
assets/uploads/screenshot.2f27776aff-640w.webp    7 KB
assets/uploads/screenshot.f2e5aa5de8-960w.webp    12 KB
assets/uploads/screenshot.912b954db6-1280w.webp   17 KB
assets/uploads/screenshot.14e9ec36b1-1920w.webp   28 KB
assets/uploads/screenshot.9f3653089d-2184w.webp   34 KB
```

- Copies are cached in `.pillar/images/` by content and settings: each is made once, not once per build.
- All copies are made up front rather than as pages ask for them. Which files exist is then a function of the assets alone — incremental builds always have them, and a deleted image takes its copies with it.
- GIFs are left alone (resizing would drop their animation) and SVGs need no copies.
- Without PHP's GD extension, images are served at full size. Nothing breaks.
- A JPEG's EXIF orientation is applied, so photos taken sideways come out upright.

## Configuring it

In `site.json`, every key optional:

```json
{
  "images": {
    "widths": [320, 640, 960, 1280, 1920],
    "quality": 80,
    "format": "webp",
    "sizes": "(min-width: 768px) 720px, calc(100vw - 48px)"
  }
}
```

| Key | |
| --- | --- |
| `widths` | the only widths ever produced |
| `quality` | 1–100 |
| `format` | `webp`, or `original` to keep each image's own format |
| `sizes` | what markdown images tell the browser — only the theme knows how wide its text column is |

## In markdown

Entry images get `srcset`, `sizes`, the original's `width` and `height` (so the page does not jump as they load), `loading="lazy"` and `decoding="async"` — and alt text from the [media library](/docs/media-library/) when they have none. The original stays the `src`.

Themes must give images `height: auto` wherever they constrain their width, or the height attribute stretches them:

```css
.prose img { max-width: 100%; height: auto; }
```

## In templates

```html
{page.image | image_tag('', 'cover', '(min-width: 1200px) 1152px, 100vw', 'eager')}
<img src={page.image | image_url(640)} srcset={page.image | image_srcset} alt={page.image | image_alt}>
```

| Filter | Returns |
| --- | --- |
| `image_url(width)` | the copy at least that wide; the original without a width |
| `image_srcset` | every copy as a `srcset` |
| `image_tag(alt, class, sizes, loading)` | the whole `<img>`: `srcset`, `sizes`, dimensions, `loading` — lazy unless `'eager'` |
| `image_alt` | the library's alt text |

`image_url(700)` rounds **up** to the nearest configured width — here, the 960 copy. Give an image above the fold `loading` `'eager'`.

## In the dev preview

Nothing is built while you edit. A copy is `/assets/uploads/photo.png?w=640`, and the dev server makes it on request — through the same cache, and only at configured widths.
