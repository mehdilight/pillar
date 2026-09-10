# Content type icons

Set `icon` in `schemas/<collection>.json` to any regular-weight Phosphor icon's kebab-case name:

```json
{
  "label": "Guides",
  "icon": "book-open",
  "fields": []
}
```

Browse names at https://phosphoricons.com/ (for example `article`, `files`, `users`, or `shopping-bag`). The admin sidebar loads the chosen icon on demand from the bundled Phosphor assets. Missing or unknown names fall back to `file-text`. Icons use the surrounding UI color and size. No external network service or raw SVG in schemas is required.

Content-type edits in the admin preserve the schema's icon and other developer metadata. Collections without schemas continue to use `file-text`.
