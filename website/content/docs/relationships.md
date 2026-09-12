---
title: Relationships
summary: Link entries to entries — related posts, an author, featured docs — stored as references and read by templates as the entries themselves.
section: content
order: 24
---
## Declaring one

```json
{ "id": "related", "type": "collection_item", "label": "Related posts", "collections": ["posts"], "multiple": true, "max": 3 }
{ "id": "featured", "type": "collection_item", "label": "Featured", "collections": ["posts", "docs"] }
{ "id": "parent", "type": "page", "label": "Parent page" }
```

- `collections` lists where entries may come from (`collection: posts` is shorthand for one).
- `multiple` allows several, stored as a list; `max` caps them.
- `page` links an entry of the `pages` collection.

## What is stored

References, readable in the file:

```yaml
related: [hello-pillar, schema-is-the-editor]
featured: docs/getting-started
```

The slug when the field offers one collection; `collection/slug` when it offers several (or none — then every collection is offered).

## What templates read

The entries themselves. No lookup, no slug juggling:

```html
<if {page.related.length}>
  <h2>Related</h2>
  <ul>{page.related.map((post) => <li><a href={post.url}>{post.title}</a></li>)}</ul>
</if>

<if {page.featured}><FeaturedCard entry={page.featured} /></if>
```

This works inside groups and repeater rows too — a repeater of "reading list" rows, each with a note and an entry, gives `row.post.title` directly. A section setting of type `collection_item` resolves the same way.

- A reference to an entry that no longer exists resolves to nothing — the page still builds — and `pillar check` warns about it.
- A **draft** resolves only where drafts render: in the dev preview, not in the production build.
- Reading a relationship records the linked collection as a dependency, so a page showing a related post rebuilds when that post changes.

## In the dashboard

The field shows the linked entries as cards — status dot, title, collection, open in a new tab, reorder, unlink. **Link entries** opens a selection drawer: search by title or slug, filter by collection, page through, tick up to `max`. The entry being edited is never offered as related to itself.
