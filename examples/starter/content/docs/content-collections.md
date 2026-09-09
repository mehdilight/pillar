---
title: Content collections
order: 3
---
A folder under `content/` is a collection. `content/posts/*.md` is `posts`,
reachable in any template as `collections.posts`.

Give it a form by declaring `schemas/posts.json`:

```json
{
  "label": "Posts",
  "fields": [
    { "id": "title", "type": "text", "label": "Title" },
    { "id": "date", "type": "date", "label": "Date" },
    { "id": "tags", "type": "tags", "label": "Tags" }
  ]
}
```

The same field vocabulary a section's `<schema>` uses, which is why one
component in the dashboard renders both a section setting and a post's date.

Each item renders through `templates/<singular>.json` — `posts` through
`post.json` — falling back to `page.json`. Set `template:` in a file's
frontmatter to override it for that item.
