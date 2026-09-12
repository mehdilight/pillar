---
title: The schema block
summary: How a <schema> block turns into controls in the editor, how stored values are cast and defaulted, and the options every setting shares.
section: sites
order: 11
---
The same setting vocabulary is used everywhere Pillar shows a form: a section's `<schema>`, a block's, a content type's `schemas/<collection>.json`, the theme's `config/settings_schema.json` and a plugin's settings. Learn it once.

## A setting

```json
{ "id": "heading", "type": "text", "label": "Heading", "default": "Hello", "info": "Keep it short." }
```

| Key | Meaning |
| --- | --- |
| `id` | The key the value is stored under, and read by: `section.settings.heading`. Lowercase, starting with a letter: `a-z`, `0-9`, `_`. Unique among its siblings. |
| `type` | One of the [field types](/docs/field-types/). An unknown type is an error — the schema stops parsing rather than showing a control nothing reads. |
| `label` | What the editor shows. |
| `default` | The value when nothing is stored. |
| `info` | Help text under the control. |
| `placeholder` | For text-shaped controls. |

Type-specific keys — `options`, `min`/`max`/`step`/`unit`, `fields`, `collections`, `multiple`, `time`, `extensions` — are listed with each type in [Field types](/docs/field-types/). Rules and conditions — `required`, `character_limit`, `input_type`, `display`, `hidden`, `visible_if` — are in [Rules and conditions](/docs/rules-and-conditions/).

## Organising a long form

Two types carry no value and exist to structure the form:

```json
{ "id": "style_head", "type": "header", "content": "Appearance" },
{ "id": "note", "type": "paragraph", "content": "These apply to the whole section." }
```

A `header` draws a heading with a rule above it; a `paragraph` a line of help.

## Casting and defaults

JSON forgets types once a value has been through a form. Before a template sees a setting, Pillar casts it:

- `number` and `range` become numbers — an integer stays an integer, so `{section.settings.columns}` prints `3`, not `3.0`;
- `checkbox` becomes a boolean;
- `tags`, `checkboxes` and multiple-choice values become lists;
- `group`, `repeater` and `table` are cast all the way down;
- relationship fields become the entries they name — see [Relationships](/docs/relationships/).

A setting with no stored value gets its `default`, or its type's empty value (`''`, `0`, `false`, `[]`, or `null` for images). So adding a setting to a section never requires touching every page that already uses it.

A stored value whose setting has been removed is **kept**, not dropped — renaming a setting in a theme should not silently delete data on every page. `pillar check` reports it instead.

## Live preview through CSS variables

A theme setting can declare the CSS custom property it feeds:

```json
{ "id": "color_accent", "type": "color", "label": "Accent", "css_var": "--color-accent" }
```

The visual editor then updates that variable in the preview as you drag, without re-rendering the page. `css_unit` (`"px"`) is appended when patching.
