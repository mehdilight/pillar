---
title: Content types
summary: A content type is a collection with a schema — the fields its entries have — created and edited in the dashboard's field builder, or written by hand in schemas/.
section: content
order: 21
---
## What a content type is

Three files, exactly as you would write them:

| File | Holds |
| --- | --- |
| `schemas/<name>.json` | the fields — what the entry form shows |
| `content/<name>/` | the entries |
| `templates/<singular>.json` | how one entry renders (copied from `page.json` when created) |

A folder of markdown with no schema still lists and still edits; it just has no declared fields beyond the title and body.

## The schema file

```json
{
  "label": "Guides",
  "icon": "book-open",
  "fields": [
    { "id": "title", "type": "text", "label": "Title", "required": true },
    { "id": "summary", "type": "textarea", "label": "Summary", "character_limit": 200 },
    { "id": "level", "type": "select", "label": "Level", "default": "beginner",
      "options": [ { "value": "beginner", "label": "Beginner" }, { "value": "advanced", "label": "Advanced" } ] },
    { "id": "author", "type": "collection_item", "label": "Author", "collections": ["people"] },
    { "id": "draft", "type": "checkbox", "label": "Draft", "default": false }
  ]
}
```

- `label` is what the dashboard calls it; `icon` is a [Phosphor](https://phosphoricons.com) icon name for the sidebar.
- `fields` use the [schema vocabulary](/docs/schema-block/) and any of the [field types](/docs/field-types/).

The dashboard writes schemas one field per line, so adding a field is a one-line diff. `title` and `draft` are drawn by the entry page itself (the big title box and the *Published* switch); every other field appears in the entry's **Details**.

## Creating one

**In the dashboard** — **Content types → New content type**. A drawer asks for a name (plural, lowercase — it becomes the folder and the URL), a label and an icon, and starts with title, date, tags and draft. **Add field** opens the field-type picker; each field is configured in a drawer of its own. **Quick add** chips add the usual fields — summary, cover image, position.

**From the command line**:

```bash
pillar make:collection guides --label "Guides" --fields title,summary,tags,draft
```

Presets: `title`, `date`, `summary`, `tags`, `image`, `order`, `draft`. `--no-template` skips `templates/guide.json`.

**By hand** — write the three files. They are indistinguishable from ones the dashboard made.

## The field builder

- **Drag** a field by its handle, or use the arrows, to reorder.
- **Click** a field to configure it: label, handle (it follows the label until you edit it), instructions, placeholder, default, type-specific settings, [rules and conditions](/docs/rules-and-conditions/).
- **Groups and repeaters** hold their own field lists — three levels deep at most.
- Renaming a field's handle keeps entries' existing values under the old key until they are edited; conditions pointing at the field follow the rename.

Nothing is written until **Save**, and closing with unsaved changes asks first.

## Validation

`pillar check` validates every entry against its schema: wrong types (`"featured" should be a boolean`), values outside a field's options, missing required values, links to entries that do not exist — with the path to the value, into groups and repeater rows (`faq[1].answer`). See [Validation](/docs/validation/).
