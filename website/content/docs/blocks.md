---
title: Blocks
summary: Repeatable, reorderable pieces inside a section — features in a grid, columns in a footer — declared by the section or shared as block files, and nestable.
section: sites
order: 12
---
## Declaring blocks in a section

A section lists the block types it can hold under `blocks`, each with its own settings:

```json
{
  "name": "Feature grid",
  "max_blocks": 6,
  "settings": [ { "id": "heading", "type": "text", "label": "Heading" } ],
  "blocks": [
    { "type": "feature", "name": "Feature", "settings": [
      { "id": "title", "type": "text", "label": "Title", "default": "Fast" },
      { "id": "body", "type": "textarea", "label": "Body" }
    ] }
  ]
}
```

The template iterates them:

```html
<div class="grid">
  {section.blocks.map((block) => <Feature block={block} />)}
</div>
```

Each block has `id`, `type` and `settings` — cast and defaulted exactly like section settings. A block hidden in the editor (`"disabled": true`) is left out of `section.blocks`.

## Block files

A block type used by several sections can live in `blocks/<type>.liqx`, with its own `<schema>`:

```html
<article class="card"><h3>{props.block.settings.title}</h3></article>
<schema>
{ "name": "Card", "settings": [ { "id": "title", "type": "text", "label": "Title" } ] }
</schema>
```

A section takes block files with `accepts`:

```json
{ "name": "Cards", "accepts": ["card", "quote"] }
```

`"accepts": ["@theme"]` means every public block file — any whose type does not start with `_`. Underscore-prefixed types still render; they are simply never offered in *Add block*.

## Nesting

A block file can itself accept blocks, which makes it a container:

```json
{ "name": "Column", "accepts": ["@theme"] }
```

Its children are `block.blocks`. Render them the same way:

```html
<div class="column">{props.block.blocks.map((child) => <Card block={child} />)}</div>
```

## Editing blocks

In the visual editor, expand a section in the page tree to see its blocks — nested ones indented under their container. Click one to edit its settings; the panel shows a **‹ Section** link back. Hover a block for its actions: add a child (containers), move up or down, duplicate, hide, remove. **Add block** offers only the types allowed at that spot, and disappears when `max_blocks` is reached. Every change goes on the editor's undo history.

## Presets

A section's `presets` can include blocks, so *Add section* produces something useful straight away:

```json
"presets": [
  { "name": "Footer", "blocks": [
    { "type": "link_column", "settings": { "menu": "products", "heading": "Products" } },
    { "type": "link_column", "settings": { "menu": "company", "heading": "Company" } }
  ] }
]
```

## Example: the starter's footer

The starter's footer holds up to four `link_column` blocks, each showing one [navigation link list](/docs/navigation/):

```html
<nav class="footer-cols" style={`--footer-columns:${section.blocks.length}`}>
  {section.blocks.map((block) =>
    <div class="footer-col">
      <h4>{block.settings.heading || menus[block.settings.menu]?.title}</h4>
      <ul>
        {(menus[block.settings.menu]?.items ?? []).map((link) =>
          <li><a href={link.url}>{link.title}</a></li>
        )}
      </ul>
    </div>
  )}
</nav>
```

Columns are added, reordered and removed in the page tree; their links are edited under Navigation.
