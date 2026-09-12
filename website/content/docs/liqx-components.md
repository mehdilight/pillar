---
title: "Liqx: Components and slots"
summary: Named templates, snippets, props, children, and named slots.
section: reference
order: 86
---
[Liqx overview](/docs/liqx-templates/) · [Pagination](/docs/pagination/) · [Previous](/docs/liqx-control-flow/) · [Next](/docs/liqx-schema-style-script/)

A PascalCase tag (first letter uppercase) is a **component**. Liqx resolves a
component from the document's own named `<template>` blocks first, then from
the host's snippet file system.

```liqx
<template name="Chip">
  <span class="chip">{props.label}</span>
</template>

<div>
  <Chip label="Sale" />
  <Chip label="New" />
</div>
```

The component receives its attributes as `props` — every named attribute
becomes a property:

```liqx
<template name="ProductCard">
  <article>
    <h3>{props.title}</h3>
    <p>{props.price | money}</p>
  </article>
</template>

<ProductCard title={product.title} price={product.price} />
```

## Props

Inside a component, `props` is the attribute map. In a frontmatter-returning
document, `props` is also the exported object:

```liqx
---
const meta = { label: name };
return { heading: heading, meta: meta };
---
<template name="Box">
  <section>
    <h2>{props.heading}</h2>
    <p>{props.meta.label}</p>
  </section>
</template>

<Box heading={props.heading} meta={props.meta} />
```

Bare attributes become `true`:

```liqx
<template name="Flag">
  <span data-flag={props.active}>x</span>
</template>
<Flag active />
```

`key` is never forwarded as a prop:

```liqx
<ProductCard key={product.id} title={product.title} />
```

## Children and default slot

A non-self-closing component receives its children as `props.children`.
Named `<template slot="...">` children become `props.slots[name]`.

```liqx
<template name="Card">
  <div class="card">
    <header>{props.slots.title}</header>
    <div>{props.children}</div>
  </div>
</template>

<Card>
  <template slot="title"><h2>{title}</h2></template>
  <p>{product.title}</p>
</Card>
```

## `<slot>` element

Inside a component, `<slot>` renders `props.children` (default) or
`props.slots[name]`, with fallback content:

```liqx
<template name="Card">
  <div class="card">
    <h2><slot name="title">Default title</slot></h2>
    <div><slot>Fallback body</slot></div>
  </div>
</template>

<Card>
  <template slot="title">Custom title</template>
  <p>Body content</p>
</Card>
```

## `render()` global

`render(name, props)` renders a snippet by name through the host file system.
It is the function form of `<Snippet />`.

```liqx
<p>{render("Chip", { label: "sale" })}</p>
```

```liqx
<div>
  {render("ProductCard", {
    title: product.title, price: product.price
  })}
</div>
```

Use a component tag for a local named template:

```liqx
<template name="Badge">
  <b>{props.text}</b>
</template>
<p><Badge text="NEW" /></p>
```

## `section()` global

`section(name)` renders a section through the section file system, giving it
the current scope:

```liqx
<p>{section("header")}</p>
```

In Pillar, `section()` selects an instance from `templates/layout.json`. Inside that section, read `section.id`, `section.type`, and `section.settings`:

```liqx
---
const header = section.id;
---
<p>{header}</p>
```

## Components in expressions

A component used inside an expression also renders to its markup:

```liqx
<template name="Chip">
  <span>{props.label}</span>
</template>

<p>{show ? <Chip label="on" /> : <Chip label="off" />}</p>
```

## Resolution order

1. A named `<template name="X">` in the same document.
2. The host's snippet file system. The `render()` function uses this file system directly.

Casing of the lookup is normalized — `ProductCard`, `product-card`, and
`product_card` can all resolve the same source (host filesystem naming
conventions vary; local templates match by case-insensitive name).

## Component lookup in Pillar

Named templates in the current document take precedence. External components resolve through Pillar’s layered `snippets/` directory, then `blocks/`. For example, `<PostCard post={post} />` resolves `snippets/post-card.liqx`; the snippet reads `props.post`. Site overrides take precedence over inherited files. See [Themes and addons](/docs/themes-and-addons/) and [Blocks](/docs/blocks/).


Adapted from Liqx v0.1.0’s syntax reference, copyright © 2026 phpmystic, under the MIT license. See [source and license](https://github.com/mehdilight/liqx/tree/v0.1.0).
