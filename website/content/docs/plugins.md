---
title: Plugins
summary: PHP that runs inside the build and the dev server — head tags, routes, template functions, build steps and dashboard panels — with an optional theme folder and dashboard bundle.
section: extending
order: 60
---
## Enabling one

List it in `site.json`:

```json
{ "plugins": ["seo", "plugins/my-plugin"] }
```

A name is looked up as a path, then under the site's `plugins/`, then among the plugins bundled with Pillar. A disabled plugin leaves no trace: its routes, tags and panels simply do not exist.

## A plugin's folder

```text
plugins/reading-time/
├── plugin.yaml
├── src/Plugin.php
├── theme/                  optional: a layer of sections, snippets, assets
└── editor/dist/editor.js   optional: a dashboard bundle
```

`plugin.yaml`:

```yaml
slug: reading-time
name: Reading time
version: 0.1.0
description: Minutes to read, on every entry.
namespace: Acme\ReadingTime
plugin_class: Acme\ReadingTime\Plugin
src: src
theme: theme
editor: editor/dist/editor.js
```

`src/` is autoloaded (PSR-4) under `namespace`. `theme/` joins the site's [layers](/docs/themes-and-addons/), above the theme and below the site — so a plugin can ship a section, and the site can still override it.

## The plugin class

One method:

```php
namespace Acme\ReadingTime;

use Phpmystic\Liqx\Environment;
use Phpmystic\Pillar\Plugin\PluginContext;
use Phpmystic\Pillar\Render\LiqxExtension;

final class Plugin implements \Phpmystic\Pillar\Plugin\Plugin, LiqxExtension {

	public function register( PluginContext $context ): void {
		$context->extend( $this );
	}

	public function extend( Environment $environment ): void {
		$environment->registerFilter( 'reading_time', static fn ( mixed $html ): int =>
			max( 1, (int) round( str_word_count( strip_tags( (string) $html ) ) / 220 ) )
		);
	}
}
```

Now `{page.content | reading_time} min read` works in any template.

## What the context offers

| | |
| --- | --- |
| `$context->site` | the site: root, name, base URL, layers |
| `$context->content` | the content store: collections and entries |
| `$context->settings()` | this plugin's settings, from `config/plugins/<slug>.json` |
| `$context->extend( $extension )` | add Liqx filters and globals (a `LiqxExtension`) |
| `$context->head->register( $contributor )` | add tags to `{content_for_header}` |
| `$context->routes->add( $url, $type, $render )` | add a file to the build — a sitemap, a feed, `robots.txt` |
| `$context->build->before( fn )`, `eachPage( fn )`, `after( fn )` | run code around the build; `eachPage` may rewrite each page's HTML |
| `$context->editor->settings( $context, $name, $fields )` | a settings panel in the dashboard, in the schema vocabulary |
| `$context->editor->preview( $slug, $resolver )` | a live preview endpoint for your dashboard panels |
| `$context->dependsOn( $path )`, `fingerprint( $value )` | declare inputs the build could not see |

### Head tags

A head contributor returns tags and a priority. Lower priorities win: when two contributors emit the same key (the `<title>`, a `meta` name), the first by priority is kept, so a specific plugin can override a general one and the site's own defaults come last.

### Declare what you read

Incremental builds only rebuild a page when an input changes. Anything a plugin reads that the file system did not see — a config file, an environment variable, the date — must be declared, or builds keep serving pages rendered before it changed:

```php
$context->dependsOn( $context->site->absolute( 'data/authors.json' ) );
$context->fingerprint( getenv( 'ANALYTICS_ID' ) ?: '' );
```

## Dashboard bundles

`editor:` points at a script the dashboard loads at runtime — never compiled in, so a plugin is installed by listing it, not by rebuilding the dashboard. The bundle calls `PillarHost.define(slug, { register })`; `register(host)` receives Solid, the dashboard's API client, and `registerSlot`:

| Slot | Where it appears |
| --- | --- |
| `settings.panel` | replaces the generic form for this plugin's settings panel |
| `content.item.sidebar` | beside every entry — gets the entry's collection, slug, frontmatter, body, and `setFrontmatter` |

Build bundles as an IIFE with Solid and `@pillar/editor` as externals (the SEO plugin's build in `apps/editor/build-plugins.mjs` is the reference). A plugin's CSS is scoped to its own panels. A bundle that fails to load is reported and skipped — it never breaks the dashboard.
