---
title: "Liqx: Schema, styles, and scripts"
summary: Typed props, styles, scripts, and how these relate to Pillar section schemas.
section: reference
order: 87
---
[Liqx overview](/docs/liqx-templates/) · [Pagination](/docs/pagination/) · [Previous](/docs/liqx-components/) · [Next](/docs/liqx-methods-globals/)

## `<schema>` — typed props

A `<schema>` block at the end of a document declares the types of the
frontmatter `return { ... }` props. On every render the evaluated `props` are
checked against it — a mismatch throws a typed error before the body renders.

```liqx
---
return {
  title: title,
  count: count,
  tags: tags
};
---
<schema>
  { "props": { "title": "string", "count": "int", "tags": ["array", "null"] } }
</schema>
<h1>{props.title}</h1>
```

Supported scalar types: `string`, `int`, `number`, `float`, `bool`, `array`,
`object`, `null`. A type may be a union — a JSON array of tokens. Only props
that are *present* are validated; missing props are allowed:

```liqx
---
return { heading: heading, price: price };
---
<schema>
  {
    "props": {
      "heading": "string",
      "price": "number"
    }
  }
</schema>
<h1>{props.heading}</h1>
<p>{props.price}</p>
```

The schema block is captured verbatim and never rendered into the body.

## `<style>` — CSS with interpolation

`<style>` bodies are captured as raw CSS. `{ expression }` interpolation is
supported inside them:

```liqx
<style>
  .hero {
    color: {settings.heading};
    margin: {start}px {end}px;
  }
</style>
<div class="hero">{heading}</div>
```

A `{ ... }` inside the CSS that is *not* a valid expression (for example a
plain CSS block like `{ color: red; }`) is preserved literally:

```liqx
<style>
  .btn {
    color: red;
  }
  .btn:hover {
    color: {settings.heading};
  }
</style>
<button class="btn">{name}</button>
```

The last `<style>` in a document is also collected on the document node, so a
host can extract the CSS. The language itself does not rewrite CSS selectors. Styles render inline where they appear.

## `<script>` — verbatim JS with interpolation

`<script>` bodies are preserved and their `{ expression }` holes evaluate:

```liqx
<script>
  const count = {count};
  console.log(count);
</script>
<p>{title}</p>
```

`<script>` may carry attributes:

```liqx
<script type="module" defer>
  const start = {start};
  console.log(start);
</script>
<p>{title}</p>
```

These examples interpolate numeric values. Browser JavaScript runs after rendering; `JSON.stringify` is not a built-in server-side Liqx function. Keep application scripts in assets when possible. Do not interpolate untrusted strings directly into scripts; the `escape` filter targets HTML, not JavaScript.

## Verbatim blocks inside expressions

`<style>` and `<script>` are also valid *inside* an expression, where they
evaluate to their rendered markup:

```liqx
<div>
  {<script>const x = {count};</script>}
  {<style>.x { color: red; }</style>}
  <p class="x">{title}</p>
</div>
```

## Empty / optional blocks

A document may omit frontmatter, `<style>`, `<script>`, or `<schema>` entirely
— only the render body is required:

```liqx
<p>Just a body, no frontmatter or metas.</p>
```

## Section schemas in Pillar

The typed `props` schema above belongs to Liqx. Pillar also reads editor keys such as `name`, `settings`, `blocks`, and `presets` from a section’s schema. A section’s editable values are available as `section.settings`; theme values are in `settings`. See [The schema block](/docs/schema-block/) for a complete editor schema and [Blocks](/docs/blocks/) for nested content.


Adapted from Liqx v0.1.0’s syntax reference, copyright © 2026 phpmystic, under the MIT license. See [source and license](https://github.com/mehdilight/liqx/tree/v0.1.0).
