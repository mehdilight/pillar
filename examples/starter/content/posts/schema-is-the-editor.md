---
title: The schema block is the editor
date: 2026-09-04
tags: [design, liqx]
---
A section declares what can be changed about it, and nothing else can be:

```json
{
  "name": "Hero",
  "settings": [
    { "id": "heading", "type": "text", "label": "Heading" },
    { "id": "padding", "type": "range", "label": "Padding", "min": 32, "max": 200 }
  ]
}
```

That JSON has two readers. Liqx type-checks a template's props against it at
render time; Pillar reads the same block as the dashboard's control manifest.
One contract, written once, in the file the section already lives in.

The catch is that the two halves of a field type — the PHP cast and the editor
control — can drift apart, and when they do a section stops parsing entirely.
So both are generated from `schema/field-types.json`, and CI fails if either
is stale.
