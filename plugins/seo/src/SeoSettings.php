<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Seo;

use Phpmystic\Pillar\Content\ContentType;
use Phpmystic\Pillar\Site\Site;

/**
 * The plugin's settings: `config/plugins/seo.json`, over these defaults.
 *
 * Title and description patterns are keyed by **collection**, not by a fixed
 * list of page kinds. A site's collections are whatever its author created —
 * `posts`, `docs`, `guides`, `changelog` — and a pattern for each is looked up
 * by name, so a collection made yesterday in the dashboard is configurable
 * today without a line of plugin code. See {@see self::pattern()}.
 */
final class SeoSettings {

	public const DEFAULTS = [
		'home_description'    => '',
		'site_name'           => '',
		'separator'           => '·',
		'tagline'             => '',

		'title_home'          => '%%sitename%% %%sep%% %%tagline%%',
		'title_page'          => '%%title%% %%sep%% %%sitename%%',
		'description_home'    => '%%tagline%%',
		'description_page'    => '%%excerpt%%',

		/*
		 * Which schema.org type a collection's entries are. Conventional
		 * defaults for the two names most sites use, and nothing more: any
		 * other collection whose entries carry a `date` is an `Article`, and
		 * one whose entries do not is a plain `WebPage`. Override per site.
		 */
		'article_types'       => [ 'posts' => 'BlogPosting', 'docs' => 'TechArticle' ],

		'organization_name'   => '',
		'organization_logo'   => '',
		'organization_type'   => 'Organization',
		'twitter_site'        => '',
		'social_image'        => '',

		'schema_enabled'      => true,
		'breadcrumbs_enabled' => true,
		'sitemap_enabled'     => true,
		'sitemap_page_size'   => 1000,
		'robots_extra'        => '',
	];

	/**
	 * @param array<string, mixed> $values this plugin's own settings file
	 * @param array<string, mixed> $theme  the site's settings, for the name and tagline
	 */
	public function __construct(
		public readonly Site $site,
		private readonly array $values,
		private readonly array $theme = [],
	) {}

	public function get( string $key, mixed $fallback = null ): mixed {
		return $this->values[ $key ] ?? self::DEFAULTS[ $key ] ?? $fallback;
	}

	public function string( string $key ): string {
		$value = $this->get( $key, '' );

		return is_scalar( $value ) ? trim( (string) $value ) : '';
	}

	public function bool( string $key ): bool {
		return filter_var( $this->get( $key ), FILTER_VALIDATE_BOOLEAN );
	}

	/** The site's name as SEO uses it: this plugin's override, else the site's own. */
	public function siteName(): string {
		return $this->string( 'site_name' ) ?: (string) ( $this->theme['site_title'] ?? $this->site->name );
	}

	public function tagline(): string {
		return $this->string( 'tagline' ) ?: (string) ( $this->theme['tagline'] ?? '' );
	}

	public function organizationName(): string {
		return $this->string( 'organization_name' ) ?: $this->siteName();
	}

	/**
	 * The pattern for a title or description.
	 *
	 * For an entry in collection `C`: `title_C`, then `title_<singular C>` (so a
	 * site configured with `title_post` before patterns were keyed by
	 * collection keeps working), then `title_page`. The home page reads
	 * `title_home`. The first non-empty one wins.
	 *
	 * @param 'title'|'description' $kind
	 */
	public function pattern( string $kind, string $type ): string {
		$candidates = 'home' === $type
			? [ $kind . '_home' ]
			: [ $kind . '_' . $type, $kind . '_' . ContentType::singular( $type ), $kind . '_page' ];

		foreach ( array_unique( $candidates ) as $key ) {
			$pattern = $this->string( $key );

			if ( '' !== $pattern ) {
				return $pattern;
			}
		}

		return '';
	}

	/**
	 * The schema.org type a collection's entries are, or null for a plain page.
	 *
	 * An explicit mapping wins; otherwise a dated entry is an `Article` — a
	 * date is what makes something a piece of writing rather than a page.
	 */
	public function articleType( string $collection, bool $dated ): ?string {
		$types = (array) $this->get( 'article_types', [] );
		$type  = $types[ $collection ] ?? null;

		if ( is_string( $type ) && '' !== $type ) {
			return $type;
		}

		return $dated ? 'Article' : null;
	}

	/**
	 * Whether any pattern reads a variable — so the plugin can fingerprint the
	 * build with the date only when a title can actually change with it.
	 */
	public function uses( string $variable ): bool {
		$needle = '%%' . strtolower( $variable ) . '%%';

		foreach ( $this->values + self::DEFAULTS as $value ) {
			if ( is_string( $value ) && str_contains( strtolower( $value ), $needle ) ) {
				return true;
			}
		}

		return false;
	}

	/** Per-URL overrides for pages that have no frontmatter to put them in. @return array<string, mixed> */
	public function routeMeta( string $url ): array {
		$routes = (array) $this->get( 'routes', [] );

		return (array) ( $routes[ $url ] ?? [] );
	}
}
