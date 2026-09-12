---
title: Rules and conditions
summary: Required fields, character limits, email inputs, hidden fields, and fields shown only when another field has a value — checked when an entry is published.
section: content
order: 23
---
Rules are options on any field, not separate types.

## Rules

| Option | Applies to | Effect |
| --- | --- | --- |
| `required: true` | every type | must have a value; a toggle must be switched on |
| `character_limit: 160` | text, textarea, markdown, richtext | at most that many characters; the form counts as you type |
| `input_type: "email"` | text | the email keyboard, and the address is checked |
| `input_type: "tel"` | text | the phone keyboard |
| `max` | repeater, `collection_item` with `multiple` | at most that many rows or entries |
| `extensions` | file | only those file types |

Required fields show `*` after their label.

## When rules apply

**Rules are enforced when an entry is published.** A draft can be saved half-written — that is what drafts are for — and the dashboard tells you how many fields still need attention. Saving a *published* entry with a problem is refused: each problem appears under its field, the page scrolls to the first, and nothing is written.

The same rules run in three places, so nothing gets past them:

- the **entry form**, before saving;
- the **server**, when the dashboard (or a script) saves — a stale tab cannot slip through;
- **`pillar check`** — errors for published entries, warnings for drafts.

## Conditions

`visible_if` shows a field only when every rule holds for the fields beside it:

```json
{ "id": "format", "type": "radio", "label": "Format", "display": "buttons",
  "options": [ { "value": "article", "label": "Article" }, { "value": "video", "label": "Video" } ] },
{ "id": "video", "type": "video", "label": "Video", "required": true,
  "visible_if": [ { "field": "format", "operator": "equals", "value": "video" } ] }
```

| Operator | Holds when the other field… |
| --- | --- |
| `equals` (the default) | has this value — or, for a list, contains it |
| `not_equals` | does not |
| `contains` | is a list containing the value, or text containing it |
| `empty` | is blank, an empty list, or switched off |
| `not_empty` | has anything |

- A rule names a field **beside** it — a sibling in the same form, group or repeater row. A rule naming a field that does not exist is a schema error: a typo would otherwise hide a field forever.
- A field its conditions hide is **never required**, and **keeps its value** — hiding is not deleting.
- In the field builder, **Conditions** builds the rules from dropdowns; the value is a dropdown too when the other field has options.

## Hidden fields

`hidden: true` keeps a field in the file and in templates, but never shows it in the form. Use it for values a script or plugin manages — an import id, a computed score.
