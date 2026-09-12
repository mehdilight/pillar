---
title: Templates and sections
summary: A page is a template — a JSON list of sections — rendered inside the layout. Sections are Liqx files that declare what can be edited about them.
section: sites
order: 10
---
## The layout

`layout/theme.liqx` is the shell every page shares:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {content_for_header}
  <link rel="stylesheet" href={'base.css' | asset_url}>
</head>
<body>
  {section('header')}
  <main id="main">{content_for_layout}</main>
  {section('footer')}
</body>
</html>
```

- `{content_for_header}` is where the head registry writes — the title, meta tags, canonical, structured data. Leave it in; plugins depend on it.
- `{content_for_layout}` is the page's sections, rendered in order.
- `section('header')` renders a **layout section** — one configured in `templates/layout.json` rather than in the page's own template, so it appears on every page and is edited once.

## Templates

A template is a page's structure: which sections it has, in what order, with which settings. `templates/index.json`:

```json
{
  "sections": {
    "hero": {
      "section_type": "hero",
      "settings": { "heading": "Edit it visually. Keep it as files.", "align": "center" }
    },
    "features": {
      "section_type": "feature-grid",
      "settings": { "heading": "What you get", "columns": 3 },
      "blocks": [
        { "id": "f_files", "type": "feature", "settings": { "title": "Files, not a database" } }
      ]
    }
  },
  "order": ["hero", "features"]
}
```

Each key under `sections` is an **instance id**; `section_type` names the file in `sections/`. A section instance may also carry `"enabled": false` (kept, not rendered) and `"custom_css"` (see below). The visual editor reads and writes these files — you rarely write one by hand, but you always can.

### Which template renders which URL

| Template | URL |
| --- | --- |
| `index.json` | `/` |
| `404.json` | `/404.html` |
| `blog.json`, `about.json`, … | `/blog/`, `/about/` |
| `post.json` | each entry of the `posts` collection, at `/posts/<slug>/` |
| `page.json` | each entry of `pages` (at `/<slug>/`), and any collection without its own template |
| `layout.json` | not a page: the sections `section('…')` renders on every page |

A collection's entries render through the template named after its **singular** — `posts` → `post.json`, `docs` → `doc.json` — falling back to `page.json`. An entry can choose another with `template: wide` in its frontmatter. An entry template is never a page of its own, even before its collection has entries.

A template can **paginate** a collection — see [Pagination](/docs/pagination/).

## Sections

A section is a Liqx file in `sections/` with a `<schema>` block at the end:

```html
<div class="wrap hero" style={`text-align:${section.settings.align}`}>
  <h1>{section.settings.heading}</h1>
  <if {section.settings.cta_label}>
    <a class="button" href={section.settings.cta_url}>{section.settings.cta_label}</a>
  </if>
</div>
<schema>
{
  "name": "Hero",
  "description": "A heading, a line of copy and a call to action.",
  "settings": [
    { "id": "heading", "type": "text", "label": "Heading", "default": "Hello" },
    { "id": "cta_label", "type": "text", "label": "Button label" },
    { "id": "cta_url", "type": "url", "label": "Button link", "default": "/" },
    { "id": "align", "type": "radio", "label": "Alignment", "default": "center",
      "options": [ { "value": "left", "label": "Left" }, { "value": "center", "label": "Center" } ] }
  ],
  "presets": [ { "name": "Hero" } ]
}
</schema>
```

Inside a section, `section.settings` holds the instance's values — cast to their types and defaulted from the schema — and `section.blocks` its blocks. The whole page scope is available too: `page`, `site`, `settings`, `collections`, `menus`, `route`. See [Filters and globals](/docs/filters-and-globals/).

Pillar wraps every section in an element with an id (`pillar-section-<instance>`) and classes (`pillar-section pillar-section--hero`), which the visual editor uses to outline and select it.

### Schema keys

| Key | Meaning |
| --- | --- |
| `name` | What the visual editor calls the section. |
| `description` | Shown when adding a section. |
| `settings` | The controls — see [The schema block](/docs/schema-block/) and [Field types](/docs/field-types/). |
| `blocks` | Block types this section can hold — see [Blocks](/docs/blocks/). |
| `accepts` | Block files (`blocks/*.liqx`) it takes too: type names, or `"@theme"` for every public one. |
| `max_blocks` | The most blocks the section can hold. |
| `presets` | Named starting points offered by *Add section*: `{ "name", "settings", "blocks" }`. |
| `enabled_on` | Templates the section may be added to, e.g. `["doc"]`. Empty means all. |
| `static` | A section the site owner may not remove or reorder. |

A section with no `<schema>` still renders; it simply has nothing to edit.

### Custom CSS

Every section instance has a **Custom CSS** box in the visual editor, stored as `custom_css` in the template. Write `&` for the section's own wrapper:

```css
& { background: #111; color: #fff; }
& h1 { letter-spacing: -0.03em; }
```

It is scoped to that one instance, so two hero sections on a page can look different.

## Snippets and components

`snippets/` holds partials. Render one with `render('name', { … })`, or use it as a component — the file name, capitalised:

```html
{collections.posts.items.map((post) => <PostCard post={post} excerpt={true} />)}
```

Inside `snippets/post-card.liqx`, the attributes arrive as `props`: `{props.post.title}`. A component name resolves to a snippet first, then to a block file — which is how `<Feature block={block} />` renders `blocks/feature.liqx`.
