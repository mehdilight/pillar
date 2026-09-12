---
title: Field types
summary: Every field type Pillar has — what it stores, what it renders as in the editor, and the options each one takes.
section: content
order: 22
---
Field types come from one list, `schema/field-types.json`, from which both PHP's `FieldType` enum and the dashboard's type union are generated — they cannot drift apart. The same types work in section and block schemas, content types, theme settings and plugin settings.

## Text

| Type | Stores | Options |
| --- | --- | --- |
| `text` | a string | `placeholder`, `character_limit`, `input_type` (`email`, `tel`) |
| `textarea` | a string, several lines | `placeholder`, `character_limit` |
| `markdown` | markdown, written in the visual editor | `character_limit` |
| `richtext` | HTML, written in the visual editor | `character_limit` (counts text, not tags) |
| `html` | raw HTML, in a code editor | |
| `code` | a snippet, in a code editor | |
| `url` | a link — pick a page or entry, or type an address | `placeholder` |
| `number` | a number | `min`, `max`, `step`, `placeholder` |
| `range` | a number, on a slider | `min`, `max`, `step`, `unit` |
| `date` | `2026-09-10` | `time: true` stores `2026-09-10T14:30` |

## Choice

| Type | Stores | Options |
| --- | --- | --- |
| `checkbox` | `true` / `false` — shown as a toggle | |
| `select` | one option's value, from a dropdown | `options` |
| `radio` | one option's value, all shown | `options`, `display: "buttons"` for a row of buttons |
| `checkboxes` | a list of option values | `options` |
| `tags` | a list of free-form strings | |
| `color` | `#rrggbb` | `css_var`, `css_unit` |

`options` is a list of `{ "value": "…", "label": "…" }`. Select, radio and checkboxes require it.

## Media

| Type | Stores | Options |
| --- | --- | --- |
| `image` | an image address — `/assets/uploads/photo.png` or a URL | `multiple: true` makes a gallery, stored as a list |
| `video` | an MP4/WebM from the library, or a YouTube or Vimeo link | render with `video_tag` |
| `file` | a download from the library | `extensions: ["pdf"]` limits the types |
| `icon` | a [Phosphor](https://phosphoricons.com) icon name, `rocket-launch` | |

Images and files are chosen from the [media library](/docs/media-library/).

## Relationship

| Type | Stores | Options |
| --- | --- | --- |
| `collection_item` | entries, by reference — templates read the entries themselves | `collections`, `multiple`, `max` |
| `page` | a page of the site (an entry of `pages`) | |
| `collection` | a collection's name — for a listing section | |
| `menu` | a navigation link list's handle | |

See [Relationships](/docs/relationships/).

## Structure

| Type | Stores | Options |
| --- | --- | --- |
| `group` | an object of sub-fields — `author.name`, `author.url` | `fields` |
| `repeater` | a list of rows, each with the same sub-fields | `fields`, `max` (rows) |
| `table` | rows of strings; the first row is the header | |

```json
{ "id": "faq", "type": "repeater", "label": "Questions", "max": 10, "fields": [
  { "id": "question", "type": "text", "label": "Question", "required": true },
  { "id": "answer", "type": "markdown", "label": "Answer" }
] }
```

In frontmatter, nested values are written as indented YAML:

```yaml
faq:
  - question: Do I need a server?
    answer: No — the build is plain files.
```

In a template:

```html
{page.faq.map((row) => <details><summary>{row.question}</summary>{row.answer | markdownify}</details>)}
```

Groups and repeaters nest up to three levels; sub-field ids must be unique within their parent.

## Layout

| Type | Purpose |
| --- | --- |
| `header` | a heading that organises a long form — `content` |
| `paragraph` | a note for whoever fills in the form — `content` |

Neither stores a value.

## Where each type is edited

In an entry, short fields sit two to a row and wide ones — repeaters, groups, tables, galleries, markdown, rich text, code, textareas — take the full width. In the visual editor's sidebar every field is one column. Rows of a repeater fold to one line titled by their first text field.
