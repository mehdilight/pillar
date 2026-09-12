---
title: Pagination
summary: A template declares which collection it pages through; Pillar makes /blog/, /blog/page/2/ and so on, and hands each page its slice.
section: content
order: 25
---
## Declaring it

Pagination belongs to the template, because the build must know how many pages exist before rendering any of them:

```json
{
  "paginate": { "collection": "posts", "per_page": 10 },
  "sections": { "list": { "section_type": "post-list" } },
  "order": ["list"]
}
```

`templates/blog.json` with that produces `/blog/`, `/blog/page/2/`, `/blog/page/3/`… — the first page is always the bare URL, never `/page/1/`.

## Using it

Every section on a paginated page sees `paginate`:

```html
---
const entries = paginate ? paginate.items : collections[section.settings.source].items.slice(0, 3);
---
<ul>{entries.map((post) => <PostCard post={post} />)}</ul>
<if {paginate}><Pagination paginate={paginate} /></if>
```

The starter's `post-list` section does exactly this: on a paginated template it shows that page's slice, anywhere else the latest few.

| Member | |
| --- | --- |
| `items` | this page's entries |
| `current_page`, `pages`, `total`, `per_page` | numbers |
| `has_previous`, `has_next` | booleans |
| `previous_url`, `next_url` | URLs, or nothing |
| `parts` | windowed links for a pager: each has `title`, `url`, `current`, and `gap` for an ellipsis — a two-hundred-page collection does not draw two hundred links |

## Rebuilds

A paginated page depends on its collection: add, remove, retitle or reorder an entry and every page of the listing rebuilds; pages beyond a shrunk collection are removed from `dist/`.
