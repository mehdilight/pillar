---
title: Filters and globals
summary: Everything a Pillar template can read — the page scope, and the filters Pillar adds to Liqx's own.
section: reference
order: 72
---
## Globals

| Name | |
| --- | --- |
| `page` | The current entry: `title`, `slug`, `collection`, `url`, `content`, `excerpt`, `date`, `tags`, `draft`, and every frontmatter key (relationships read as entries). |
| `site` | `title`, `name`, `tagline`, `url` (the base URL), `build_time`. |
| `settings` | The theme settings, from `config/settings_data.json`. |
| `collections` | Every collection by name: `collections.posts.items`, `.size`, `.first`. |
| `menus` | Every link list by handle: `menus.main.items`, each link `title`, `url`, `items`. |
| `paginate` | On a paginated template: `items`, `current_page`, `pages`, `total`, `has_previous`, `has_next`, `previous_url`, `next_url`, `parts`. |
| `section` | Inside a section: `settings`, `blocks`, `id`, `type`. |
| `route` | The URL being rendered. |
| `template` | The template's name. |
| `section('name')` | Renders a layout section from `templates/layout.json`. |
| `render('snippet', {…})` | Renders a snippet with props. |
| `content_for_layout`, `content_for_header` | In `layout/theme.liqx`: the page's sections, and the head tags. |

Plugins add more — the SEO plugin adds `seo_breadcrumbs(page, route)`.

## Pillar's filters

| Filter | |
| --- | --- |
| `markdownify` | Markdown to HTML — with the same image treatment as entries. |
| `asset_url` | `'base.css' \| asset_url` → `/assets/base.a1b2c3d4.css` in a build, the plain path in the preview. |
| `image_url(width)` | An image's URL — the resized copy at least `width` wide, when given. |
| `image_srcset` | Every resized copy, as a `srcset` value. |
| `image_tag(alt, class, sizes, loading)` | A complete `<img>`: `srcset`, `sizes`, dimensions, lazy loading; alt from the media library when not given. |
| `image_alt` | An image's alt text from the media library. |
| `video_tag(title, class)` | A player for a video field: YouTube (via youtube-nocookie.com) and Vimeo embeds, or `<video preload="metadata">` for a file. |
| `absolute_url` | Prefixes `base_url`: `'/feed.xml' \| absolute_url`. |
| `excerpt(length)` | Plain text from HTML, cut at `length` characters (200). |

## Liqx's own filters

Liqx ships some sixty: strings (`upcase`, `downcase`, `capitalize`, `truncate`, `truncatewords`, `strip_html`, `escape`, `slugify`, `append`, `replace`, `split`), numbers (`plus`, `minus`, `times`, `divided_by`, `round`, `money`), dates (`date('%Y-%m-%d')`), and lists (`join`, `first`, `last`, `size`, `sort`, `reverse`, `uniq`, `where`, `find`, `find_index`, `map`, `group_by`, `slice`). Arrays also have JavaScript's methods — `map`, `filter`, `find`, `some`, `every`, `includes`, `indexOf`, `slice`, `join`.
