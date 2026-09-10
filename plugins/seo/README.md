# SEO for Pillar

Ported from `bastet/plugins/seo`: replacement variables, metadata precedence,
head contributors, connected structured data, sitemap, and the content-analysis
engine. Database rows become local files. Blog posts and documentation replace
commerce-specific entities; the editor uses Solid and the host's existing styles.

## Using it

The starter enables this plugin already. In the dashboard:

- Open **Site settings → Search & sharing**. Set your website name, a short
  description, and an optional default sharing image. Changes save automatically.
- Open a content item. Its **Search & sharing** panel shows the generated search
  result. Override the title or description only when useful; **Use automatic**
  removes an override. Use the content editor's **Save** button to save these changes.
- Expand **When someone shares this page** to choose an image and preview the
  shared link. Every image chooser opens the same media library.
- **Writing suggestions** are optional. They do not gate saving or publishing.
  **Advanced settings** contains search visibility, link following, canonical
  overrides, templates, publisher details and crawler settings.

No save commits or pushes. The existing Publish action performs the git operation.

## Enable in another site

Add `"seo"` to `site.json`'s `plugins` list. Local `plugins/seo/` takes precedence
over the bundled copy. A plugin may also be referenced by its directory path.
Replace your layout's title/description/canonical markup with:

```html
<head>
  <meta charset="utf-8">
  {content_for_header}
</head>
```

The head registry deduplicates contributed tags; handwritten tags outside that
slot remain the theme author's responsibility. Core supplies a fallback title if
SEO is disabled. `site.json`'s `base_url` must be your public URL to emit absolute
canonicals, structured data, and the sitemap. With no public URL, those outputs
are omitted; the local editor still works.

## File format

Site defaults are in `config/plugins/seo.json`:

```json
{
  "site_name": "My notes",
  "home_description": "Essays, guides, and projects from my desk.",
  "social_image": "/assets/uploads/social.png"
}
```

An entry stores its overrides with its other frontmatter:

```yaml
seo:
  title: A practical guide to static sites
  description: Learn how to publish a blog from Markdown files.
  og_image: /assets/uploads/guide.png
  noindex: false
```

Optional keys: `title`, `description`, `canonical`, `focus_keyphrase`, `noindex`,
`nofollow`, `og_title`, `og_description`, `og_image`. Empty text fields use their
automatic defaults. Removing the plugin does not erase saved metadata.

Advanced defaults include `title_home`, `title_page`, `title_post`, `title_docs`,
and their `description_*` equivalents. Variables: `%%title%%`, `%%sitename%%`,
`%%sep%%`, `%%tagline%%`, `%%excerpt%%`, `%%page%%`, `%%currentyear%%`,
`%%currentdate%%`. Explicit titles and descriptions are not truncated; the automatic
excerpt uses a 155-character word-boundary excerpt. Search engines decide how to
display results; the editor preview is illustrative.

Static pages without a Markdown file can be overridden in the config's `routes`:

```json
{"routes":{"/blog/":{"title":"Writing","description":"Recent essays."}}}
```

These route overrides currently use files, rather than their own dashboard form.

## Generated output

- Title, description, canonical, robots, Open Graph and Twitter card tags.
- One JSON-LD graph: Organization or Person → WebSite → WebPage, plus BlogPosting
  for `posts` and TechArticle for `docs`, with optional breadcrumbs.
- `/sitemap.xml`; larger lists split into `/sitemap-1.xml`, etc. The size is
  configurable, capped at 50,000 URLs. Drafts, 404s, noindex entries, and pages
  declaring another canonical are excluded. Dates use authored `updated_at` or
  `date`, not checkout modification times.
- `/robots.txt`, with the sitemap address when enabled.
- A theme-addon `breadcrumbs` section and `{seo_breadcrumbs(page, route)}` global.

Pagination canonicals retain `/page/2/`; tracking queries are removed. Canonical,
Open Graph, graph IDs and sitemap use the same resolver, following Google's
[canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
Sitemap chunking follows the [sitemap protocol](https://www.sitemaps.org/protocol.html).

The local preview sends `X-Robots-Tag: noindex, nofollow`. Its HTML retains a title
and description for editing, but has no public canonical or structured data.
Plugin file routes are available under `/preview/sitemap.xml` and
`/preview/robots.txt`; build output lives at the public root.

Settings, plugin code, manifests, declared file dependencies and fingerprint
values invalidate incremental builds. Disabled plugin outputs and deleted media
are removed when previously tracked by the build manifest.

## Scope

PHP plugins can register head tags, Liqx extensions, file routes, build hooks,
schema settings and editor preview callbacks. SEO's Solid panels are bundled with
the host editor; arbitrary runtime-loaded JavaScript plugin panels, Composer
package discovery, lifecycle commands, feed/search plugins and deploy adapters
remain future work. This is the SEO port and its supporting plugin API, not the
entire B5 roadmap.
