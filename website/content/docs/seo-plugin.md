---
title: The SEO plugin
summary: Titles, descriptions, canonicals, social cards, connected structured data, a sitemap and robots.txt — with a search preview and writing suggestions beside every entry.
section: extending
order: 61
---
The SEO plugin ships with Pillar and the starter enables it. It uses nearly every part of the plugin API, which makes it the reference for writing one.

## Setup

1. Add `"seo"` to `site.json`'s `plugins`.
2. Set `base_url` to your public address — canonicals, structured data and the sitemap are absolute, and are left out without it.
3. Make sure your layout has `{content_for_header}` in `<head>`; the plugin writes there.

## What it outputs

- `<title>`, `meta description`, `robots`, and a canonical link;
- Open Graph and Twitter card tags, including `og:image:alt` from the [media library](/docs/media-library/);
- JSON-LD structured data — one connected graph: the website, the organisation or person behind it, the page, its breadcrumbs and, for posts and docs, the article;
- `sitemap.xml` and `robots.txt`;
- a `seo_breadcrumbs(page, route)` template function and a `breadcrumbs` section, from its theme layer.

The editor's own preview is always `noindex` and never points crawlers or share cards at a preview address.

## Site settings

**Settings → Search & sharing** in the dashboard — website name, a short description, a default sharing image — saved as you type to `config/plugins/seo.json`. **Advanced settings** holds title and description patterns per kind of page, publisher details, and crawler settings.

Patterns use variables:

```text
%%title%%  %%sitename%%  %%sep%%  %%tagline%%  %%excerpt%%  %%page%%  %%currentyear%%  %%currentdate%%
```

This site sets `"title_docs": "%%title%% %%sep%% Pillar docs"` — which is why this tab reads the way it does. A pattern using the date makes the build depend on it, and only then.

## Per entry

An entry's **Search & sharing** panel shows its search result, lets you override the title and description, choose a sharing image and preview the shared link, and offers optional writing suggestions (focus keyphrase, length, readability). They never block saving or publishing.

Overrides are stored with the entry:

```yaml
seo:
  title: A practical guide to static sites
  description: Learn how to publish a blog from markdown files.
  og_image: /assets/uploads/guide.png
  noindex: false
```

Keys: `title`, `description`, `canonical`, `focus_keyphrase`, `noindex`, `nofollow`, `og_title`, `og_description`, `og_image`. Empty fields use the automatic values; removing the plugin leaves the saved metadata alone.

Pages that are not markdown files — `/blog/` — are overridden in the settings' `routes`:

```json
{ "routes": { "/blog/": { "title": "Changelog", "description": "What changed in Pillar." } } }
```
