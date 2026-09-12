---
title: Theme settings
summary: Site-wide settings — colours, widths, the site's name — declared by the theme in config/settings_schema.json and edited in the dashboard.
section: sites
order: 14
---
## Declaring settings

`config/settings_schema.json` is a list of panels, each a list of settings in the usual [schema vocabulary](/docs/schema-block/):

```json
[
  {
    "name": "Brand",
    "settings": [
      { "id": "site_title", "type": "text", "label": "Site title", "default": "Pillar starter" },
      { "id": "tagline", "type": "text", "label": "Tagline" }
    ]
  },
  {
    "name": "Colors",
    "settings": [
      { "id": "color_accent", "type": "color", "label": "Accent", "default": "#cdfe00", "css_var": "--color-accent" }
    ]
  }
]
```

The values live in `config/settings_data.json`, a flat object keyed by id.

## Using them

Every template sees them as `settings`:

```html
<style>
  :root {
    --color-accent: {settings.color_accent || '#cdfe00'};
    --page-max: {settings.page_max ?? 1200}px;
  }
</style>
```

Put the design tokens in custom properties once, in the layout, and have the stylesheet read the properties. Then every colour and width is a setting, and — with `css_var` declared — the visual editor updates the preview live as you drag a colour.

`site.title` and `site.tagline` read `site_title` and `tagline` when the theme declares them, falling back to `site.json`'s `name`.

## Where they are edited

In the visual editor — **Customize**, then the theme settings tab — with the preview beside them, because colours and widths are judged by eye. The CMS's **Settings** screen links there.

Plugins add their own panels to the same schema; those appear on the CMS's Settings screen instead — see [Plugins](/docs/plugins/).

## Keeping settings honest

A setting that the theme offers but never reads is worse than none: someone changes it and nothing happens. The starter's test suite checks that every colour and layout setting reaches the page; do the same for your theme.
