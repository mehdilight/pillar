---
title: Liqx templates
summary: The template language Pillar renders with — expressions, conditionals, loops over collections, components — and the handful of things Pillar adds.
section: sites
order: 13
---
Liqx looks like JSX with Liquid's filters. A template is HTML with `{expressions}`, a few control elements, and an optional frontmatter block of code. Pillar compiles templates to PHP and caches them in `.pillar/compiled/`.

## Complete language reference

These chapters document the syntax of the installed Liqx v0.1.0 release. Examples use illustrative data; in a Pillar site, use the globals described in [Filters and globals](/docs/filters-and-globals/). Liqx is a server-rendered template language, not a browser JavaScript framework.

| Chapter | Covers |
| --- | --- |
| [Document structure](/docs/liqx-structure/) | File layout, frontmatter fences, template wrappers, and verbatim blocks. |
| [Frontmatter](/docs/liqx-frontmatter/) | Declarations, assignments, functions, return values, and restricted statement syntax. |
| [Expressions](/docs/liqx-expressions/) | Literals, operators, interpolation, arrow functions, filters, and escaping. |
| [Elements and attributes](/docs/liqx-elements/) | HTML elements, dynamic attributes, spreads, class modifiers, and components. |
| [Filter reference](/docs/liqx-filters/) | The complete standard Liqx filter reference with examples. |
| [Control flow](/docs/liqx-control-flow/) | Conditional markup, show and fallback, switch and match, and frontmatter branching. |
| [Components and slots](/docs/liqx-components/) | Named templates, snippets, props, children, and named slots. |
| [Schema, styles, and scripts](/docs/liqx-schema-style-script/) | Typed props, styles, scripts, and how these relate to Pillar section schemas. |
| [Methods, globals, and scope](/docs/liqx-methods-globals/) | Supported array and string methods, built-in globals, root data, and scope. |

For a working collection listing, follow [Pagination](/docs/pagination/): template JSON, list section, and reusable pager.

## Expressions

Text interpolation is not automatically HTML-escaped. Use `escape` for untrusted text; output already-rendered HTML such as `page.content` directly.

```html
<h1>{page.title}</h1>
<p>{site.tagline}</p>
<a href={post.url} class="card">{post.title}</a>
<p>{settings.show_date && page.date}</p>
<p>{page.summary ?? 'No summary'}</p>
<p>{`Posted in ${page.collection}`}</p>
```

Member access works on arrays and on Pillar's drops alike; drops answer in `snake_case` (`paginate.has_next`). `?.` short-circuits a missing value: `menus[name]?.items`.

## Filters

Values pipe through filters, with arguments in parentheses:

```html
{page.date | date('%B %e, %Y')}
{section.settings.body | markdownify}
{'base.css' | asset_url}
{image | image_tag('A photo', 'cover', '100vw')}
```

Liqx ships some sixty filters (`date`, `slugify`, `truncatewords`, `where`, `sort`, `group_by`, `join`, …). Pillar adds the ones a static site needs — see [Filters and globals](/docs/filters-and-globals/).

## Conditionals

```html
<if {page.image}>
  <img src={page.image | image_url(960)} alt="">
  <else><div class="placeholder"></div></else>
</if>
```

## Loops

Arrays have JavaScript's methods — `map`, `filter`, `find`, `some`, `every`, `slice`, `includes`, `indexOf`, `join`:

```html
<ul>
  {collections.posts.items.slice(0, 5).map((post) =>
    <li><a href={post.url}>{post.title}</a></li>
  )}
</ul>
{collections.docs.items.filter((doc) => doc.section === 'start').map((doc) => <DocLink doc={doc} />)}
```

## Frontmatter code

A template can start with a block of code between `---` lines; its constants are in scope below:

```html
---
const current = page.url;
const docs = collections.docs.items;
const next = docs[docs.map((d) => d.url).indexOf(current) + 1];
---
<if {next}><a href={next.url}>Next: {next.title}</a></if>
```

## Class toggles

```html
<a href={entry.url} class:current={entry.url === page.url}>{entry.title}</a>
```

## Components

A capitalised element renders a snippet (or block file) with its attributes as `props`:

```html
<PostCard post={post} excerpt={section.settings.show_excerpt} />
```

## Styles

A `<style>` block in a section is emitted with the section. `{expressions}` inside it are evaluated, so a section can style itself from its settings.

## What Pillar adds

| | |
| --- | --- |
| `<schema>` | In a section or block, the editing contract — see [The schema block](/docs/schema-block/). (Liqx's own `<schema>` validates a template's props; Pillar reads the same block as its settings.) |
| `section('name')` | Renders a layout section from `templates/layout.json`. |
| `{content_for_layout}` / `{content_for_header}` | The page's sections, and the head tags, in `layout/theme.liqx`. |
| Globals | `page`, `site`, `settings`, `collections`, `menus`, `paginate`, `route`, `template`. |
| Filters | `markdownify`, `asset_url`, `image_url`, `image_srcset`, `image_tag`, `image_alt`, `video_tag`, `absolute_url`, `excerpt`. |
