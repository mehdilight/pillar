---
title: How Pillar works
summary: Files in, HTML out — with a dashboard that edits the same files you would, a preview rendered by the build's own code, and git as the only history.
section: start
order: 3
---
## Three kinds of file

Everything about a site is one of three things, each in a file you can open:

| What | Where | Format |
| --- | --- | --- |
| **Content** — posts, docs, pages | `content/<collection>/*.md` | Markdown with YAML frontmatter |
| **Structure** — which sections a page has, in what order, with what settings | `templates/*.json` | JSON |
| **Design** — the markup, and what can be edited about it | `layout/`, `sections/`, `blocks/`, `snippets/` | Liqx templates |

Around them sit site-wide settings (`config/settings_data.json`, from the theme's `config/settings_schema.json`), content models (`schemas/*.json`), navigation (`data/menus.json`), media (`assets/`) and the site's own configuration (`site.json`).

## One renderer, three uses

A page is rendered by one class, the same way every time:

1. The **template JSON** for the route is read — say `templates/index.json` — along with `templates/layout.json`, the header and footer every page shares.
2. Each **section** named there is rendered from its `.liqx` file, with its stored settings cast through its `<schema>` (a range becomes a number, an entries field becomes the entries themselves).
3. The **layout** (`layout/theme.liqx`) wraps them: `{content_for_layout}` is the sections, `{content_for_header}` is everything plugins contribute to `<head>`.

The dev server's preview, the visual editor's canvas and `pillar build` all go through that renderer. What you see while editing is what gets written.

## The schema is the contract

A section template ends with a `<schema>` block:

```html
<section class="hero"><h1>{section.settings.heading}</h1></section>
<schema>
{
  "name": "Hero",
  "settings": [
    { "id": "heading", "type": "text", "label": "Heading", "default": "Hello" }
  ]
}
</schema>
```

That block is read twice. The **dashboard** turns it into a form — a text box labelled *Heading*. The **build** uses it to cast and default the stored values. A setting that is not declared cannot be edited; a declared one is always there, defaulted if nothing was stored. Content types work the same way, with the schema in `schemas/<collection>.json`: it becomes an entry's form, and `pillar check` validates every file against it.

## The dashboard writes files

Every save in the dashboard is a file write, done so the diff stays small:

- an entry's frontmatter keeps the lines you did not change byte-for-byte;
- a schema is written one field per line;
- nested values (groups, repeater rows) are written as indented YAML, readable in review.

Nothing is committed on save. The **Publish** screen commits the dashboard's paths — `templates/`, `config/`, `content/`, `assets/` — and nothing else, so a developer's half-finished template is never swept into a content commit.

## Git is the history

| Editor concept | Git |
| --- | --- |
| Draft | the working tree |
| Publish | a commit (and a push, when there is a remote) |
| History | `git log` |
| Discard | `git checkout` + `git clean` over the editor's paths |
| Rollback | `git revert` |

A draft *entry* is different: `draft: true` in its frontmatter keeps it out of production builds while it is still committed and shared.

## Builds are incremental

When `pillar build` renders a page, it records everything that page read: templates, sections, snippets, and which collections it listed. The next build compares those inputs by content hash and skips pages whose inputs did not change. Site-wide inputs — settings, the asset map, plugin configuration, the Pillar version — form a fingerprint; when it changes, everything rebuilds. See [Building](/docs/building/).
