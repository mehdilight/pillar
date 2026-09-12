# Pillar documentation

[Project overview](../README.md)

## Setup guides

1. [Installation](installation.md): install the release with Composer or clone the source, then build the dashboard.
2. [Creating your own site](creating-a-site.md): copy the example into an independent site, configure it, and generate static output.
3. [Development](development.md): run the frontend development server and contribute changes.

## Product guides

The full documentation lives in [website/content/docs](../website/content/docs/):

- [How it works](../website/content/docs/how-it-works.md)
- [Project structure](../website/content/docs/project-structure.md)
- [Site configuration](../website/content/docs/site-json.md)
- [Collections and entries](../website/content/docs/collections-and-entries.md)
- [Templates and sections](../website/content/docs/templates-and-sections.md)
- [Publishing with Git](../website/content/docs/publishing.md)
- [Building](../website/content/docs/building.md) and [deploying](../website/content/docs/deploying.md)
- [CLI reference](../website/content/docs/cli.md)

After installation, serve these docs from the Pillar package root:

```bash
./bin/pillar dev --site website --port 7790
```

Open http://127.0.0.1:7790/preview/docs/introduction/.

## Internals and extensions

- [Backend architecture](backend.md)
- [Dashboard development](../apps/editor/README.md)
- [Plugin API](../website/content/docs/plugins.md)
- [SEO plugin](../plugins/seo/README.md)

## Template language reference

Start with [Liqx templates](../website/content/docs/liqx-templates.md) or the complete [pagination recipe](../website/content/docs/pagination.md).

- [Document structure](../website/content/docs/liqx-structure.md)
- [Frontmatter](../website/content/docs/liqx-frontmatter.md)
- [Expressions](../website/content/docs/liqx-expressions.md)
- [Elements and attributes](../website/content/docs/liqx-elements.md)
- [Filter reference](../website/content/docs/liqx-filters.md)
- [Control flow](../website/content/docs/liqx-control-flow.md)
- [Components and slots](../website/content/docs/liqx-components.md)
- [Schema, styles, and scripts](../website/content/docs/liqx-schema-style-script.md)
- [Methods, globals, and scope](../website/content/docs/liqx-methods-globals.md)
