---
title: Pagination
summary: Build a paginated collection listing with template JSON, a list section, and accessible page links. Includes ordering, drafts, empty states, and rebuild behavior.
section: content
order: 25
---
Pagination is declared in a page's JSON template. Pillar discovers all page URLs before rendering, then supplies each route's entries and links as `paginate`. A `.slice()` in Liqx only trims an array; it does not generate routes.

## 1. Declare the listing template

Create `templates/blog.json`. This complete example displays two posts per page:

```json
{
  "paginate": { "collection": "posts", "per_page": 2 },
  "sections": {
    "list": {
      "section_type": "blog-list",
      "settings": {}
    }
  },
  "order": ["list"]
}
```

With five published posts, the generated pages are:

| URL | Entries | Output file |
| --- | --- | --- |
| `/blog/` | First two | `dist/blog/index.html` |
| `/blog/page/2/` | Next two | `dist/blog/page/2/index.html` |
| `/blog/page/3/` | Last one | `dist/blog/page/3/index.html` |

The first page uses `/blog/`, never `/blog/page/1/`. Declaring pagination in `templates/index.json` instead produces `/`, `/page/2/`, and so on.

`collection` names a content directory, such as `content/posts/`. `per_page` defaults to 10 when omitted; values below 1 are clamped to 1. A missing or empty collection name disables the pagination declaration.

Use a listing template such as `blog.json`. Entry templates such as `post.json` render individual entries and are excluded from standalone listing-route generation. A collection may also declare a different entry template through its content schema.

## 2. Render the current slice

Create `sections/blog-list.liqx`:

```liqx
<section class="blog-list">
  <h1>Blog</h1>
  <if {paginate && paginate.total > 0}>
    <p>Page {paginate.current_page} of {paginate.pages}</p>
    <ul>
      {paginate.items.map((post) =>
        <li><a href={post.url}>{post.title | escape}</a></li>
      )}
    </ul>
    <Pagination paginate={paginate} />
    <else><p>No posts yet.</p></else>
  </if>
</section>
<schema>
{
  "name": "Blog list",
  "settings": [],
  "presets": [{ "name": "Blog list" }]
}
</schema>
```

All sections on this route share the same `paginate` object. Render `paginate.items` to show the current slice; rendering `collections.posts.items` would repeat the entire collection on every page.

This section is intended for a paginated template. For a section that also appears on a homepage without pagination, see the reusable listing below.

## 3. Add the navigation snippet

Create `snippets/pagination.liqx`. `<Pagination paginate={paginate} />` passes the page data to the snippet as `props.paginate`:

```liqx
<if {props.paginate && props.paginate.pages > 1}>
  <nav class="pagination" aria-label="Pagination">
    <if {props.paginate.has_previous}>
      <a href={props.paginate.previous_url} rel="prev">Previous</a>
    </if>
    {props.paginate.parts.map((part) =>
      part.gap
        ? <span class="gap">{part.title}</span>
        : part.current
          ? <span aria-current="page">{part.title}</span>
          : <a href={part.url}>{part.title}</a>
    )}
    <if {props.paginate.has_next}>
      <a href={props.paginate.next_url} rel="next">Next</a>
    </if>
  </nav>
</if>
```

Use Pillar's generated URLs rather than constructing page paths yourself. The current page uses `aria-current="page"`; ellipses and unavailable previous/next links are not clickable. A collection fitting on one page has no navigation bar.

## Pagination fields

| Field | Type | Meaning |
| --- | --- | --- |
| `items` | Array of entries | Only this page's slice, with the same fields as collection entries. |
| `current_page` | Integer | Current page number, starting at 1. |
| `pages` | Integer | Total number of pages, at least 1. |
| `total` | Integer | Entry count across the entire paginated collection. |
| `per_page` | Integer | Configured page size; the last page can contain fewer entries. |
| `has_previous` | Boolean | Whether a previous page exists. |
| `has_next` | Boolean | Whether a next page exists. |
| `previous_url` | String or null | Previous page URL; null on the first page. |
| `next_url` | String or null | Next page URL; null on the last page. |
| `parts` | Array | Numbered links and ellipses; empty when there is only one page. |

Each `parts` entry has `title` (a page number as text or `…`), `url` (null for an ellipsis), `current` (boolean), and `gap` (boolean). The window includes the first and last pages, the current page, and its immediate neighbors. On page 50 of 100, it shows `1 … 49 50 51 … 100`.

## Ordering, filtering, and drafts

Pillar orders the collection before slicing it:

- Entries with an explicit numeric `order` come first, in ascending order.
- Among entries without an explicit order, dated entries sort newest first.
- Undated entries sort by slug.

Set frontmatter `order` for a manual sequence or `date` for a blog. The pagination declaration supports `collection` and `per_page`; it does not provide a query, filter, or sort option.

Calling `.filter()` or applying the `sort` filter to `paginate.items` affects only the already-selected slice. It does not recalculate `total`, `pages`, or routes. For a latest-posts widget without generated pages, use collection methods as shown below. Custom globally filtered pagination requires application changes or a dedicated collection.

Draft entries are omitted from normal builds. The dev preview includes drafts, and `build --drafts` includes them explicitly, so preview page counts can differ from production.

An empty or unknown collection still produces the first listing page: `items` is empty, `total` is 0, `pages` is 1, and the pager has no links. Check the collection name if a populated site displays the empty state.

## A reusable homepage listing

The starter's `post-list` section chooses between a paginated listing and a short homepage list:

```liqx
---
const source = section.settings.source || 'posts';
const limit = section.settings.limit || 3;
const entries = paginate ? paginate.items : collections[source].items.slice(0, limit);
---
<ul>
  {entries.map((post) => <li><a href={post.url}>{post.title | escape}</a></li>)}
</ul>
<if {paginate}><Pagination paginate={paginate} /></if>
```

Declare `source` as a `collection` field and `limit` as a `number` field in your section schema. On a paginated template, the JSON declaration chooses the collection and page size; these section settings only control the non-paginated fallback.

## Preview, build, and rebuild

From the Pillar package root, using a site that contains the three files above:

```bash
./bin/pillar check --site path/to/site
./bin/pillar dev --site path/to/site
```

Visit `http://127.0.0.1:7788/preview/blog/` and, with enough entries, `/preview/blog/page/2/`. The corresponding production URL has no `/preview` prefix.

```bash
./bin/pillar build --site path/to/site
php -S 127.0.0.1:8080 -t path/to/site/dist
```

A paginated route depends on its collection. Adding, removing, editing, or reordering entries invalidates the listing pages. If the collection shrinks, a subsequent build removes obsolete generated pages from `dist/`.

## Related guides

- [Collections and entries](/docs/collections-and-entries/)
- [Liqx expressions](/docs/liqx-expressions/) and [components](/docs/liqx-components/)
- [Templates and sections](/docs/templates-and-sections/)
- [Building](/docs/building/)
