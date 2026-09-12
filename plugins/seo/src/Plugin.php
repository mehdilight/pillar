<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Seo;

use Phpmystic\Pillar\Content\MarkdownFile;
use Phpmystic\Pillar\Plugin\PluginContext;
use Phpmystic\Pillar\Render\Head\HeadContext;
use Phpmystic\Pillar\Schema\ContentSchema;
use Phpmystic\Pillar\Seo\Head\CanonicalUrl;
use Phpmystic\Pillar\Seo\Head\MetaTagsContributor;
use Phpmystic\Pillar\Seo\Head\PageSubject;
use Phpmystic\Pillar\Seo\Head\SchemaContributor;

/**
 * Search and sharing: titles, descriptions, canonicals, social cards, a
 * connected schema.org graph, an XML sitemap and robots.txt — plus the
 * dashboard panels that edit them.
 *
 * Ported from bastet's SEO plugin. It uses most of the plugin surface at once,
 * which is the point of porting it first: `head` for the tags, `routes` for the
 * sitemap and robots.txt, `extend` for a Liqx global, a theme layer for the
 * breadcrumbs section, and `editor` for the panels.
 */
final class Plugin implements \Phpmystic\Pillar\Plugin\Plugin {

	public function register( PluginContext $context ): void {
		$themeSettings = $this->themeSettings( $context );
		$settings      = new SeoSettings( $context->site, $context->settings(), $themeSettings );
		$seo           = new SeoEngine( $settings );

		// `%%currentyear%%` in a pattern makes every title depend on the
		// calendar, and the build has to know that — but only then. Stamping
		// the date unconditionally rebuilt the whole site once a day for sites
		// that never used either variable.
		if ( $settings->uses( 'currentdate' ) ) {
			$context->fingerprint( date( 'Y-m-d' ) );
		} elseif ( $settings->uses( 'currentyear' ) ) {
			$context->fingerprint( date( 'Y' ) );
		}

		$context->extend( $seo );
		$context->head->register( new MetaTagsContributor( $seo ) );
		$context->head->register( new SchemaContributor( $seo ) );

		( new Sitemap( $context, $seo ) )->register();

		$context->routes->add(
			'/robots.txt',
			'text/plain; charset=utf-8',
			static fn (): string => self::robots( $context, $settings )
		);

		$this->registerEditor( $context, $settings, $seo, $themeSettings );
	}

	/** @return array<string, mixed> */
	private function themeSettings( PluginContext $context ): array {
		$path = $context->site->layers()->resolve( 'config/settings_data.json' );

		if ( null === $path ) {
			return [];
		}

		// The site's name and tagline feed every title, so the file they live
		// in is an input to every page this plugin touches.
		$context->dependsOn( $path );

		return (array) json_decode( (string) file_get_contents( $path ), true );
	}

	private static function robots( PluginContext $context, SeoSettings $settings ): string {
		$text    = "User-agent: *\nAllow: /\n";
		$sitemap = CanonicalUrl::absolute( $context->site->baseUrl, '/sitemap.xml' );

		if ( $settings->bool( 'sitemap_enabled' ) && '' !== $sitemap ) {
			$text .= "\nSitemap: " . $sitemap . "\n";
		}

		$extra = $settings->string( 'robots_extra' );

		return '' === $extra ? $text : $text . "\n" . $extra . "\n";
	}

	/** @param array<string, mixed> $themeSettings */
	private function registerEditor( PluginContext $context, SeoSettings $settings, SeoEngine $seo, array $themeSettings ): void {
		$context->editor->settings( $context, 'Search & sharing', $this->fields( $context ), SeoSettings::DEFAULTS );

		$context->editor->contentPanel( 'seo', [
			'name'      => 'Search & sharing',
			'site_name' => $settings->siteName(),
			'base_url'  => $context->site->baseUrl,
		] );

		// The search-result preview in the editor. It resolves through the same
		// PageSubject the build uses, so the snippet shown is the snippet that
		// ships, from the values being typed rather than the saved ones.
		$context->editor->preview( 'seo', function ( array $input ) use ( $context, $seo, $settings, $themeSettings ): array {
			if ( 'home' === ( $input['kind'] ?? '' ) ) {
				return $this->homePreview( $context, $settings, $themeSettings, (array) ( $input['settings'] ?? [] ) );
			}

			return $this->entryPreview( $context, $seo, $settings, $input );
		} );
	}

	/**
	 * @param array<string, mixed> $themeSettings
	 * @param array<string, mixed> $unsaved settings being edited, not yet written
	 *
	 * @return array<string, mixed>
	 */
	private function homePreview( PluginContext $context, SeoSettings $settings, array $themeSettings, array $unsaved ): array {
		$draft = new SeoSettings( $context->site, array_replace( $context->settings(), $unsaved ), $themeSettings );
		$home  = new PageSubject( new HeadContext( $context->site, 'index', '/', [] ), $draft );

		return [
			'title'       => $home->title,
			'description' => $home->description,
			'url'         => $home->canonical,
			'html'        => '',
			'noindex'     => $home->noindex,
		];
	}

	/**
	 * @param array<string, mixed> $input
	 *
	 * @return array<string, mixed>
	 */
	private function entryPreview( PluginContext $context, SeoEngine $seo, SeoSettings $settings, array $input ): array {
		$file = new MarkdownFile(
			(string) ( $input['collection'] ?? 'pages' ),
			(string) ( $input['slug'] ?? 'untitled' ),
			(array) ( $input['frontmatter'] ?? [] ),
			(string) ( $input['body'] ?? '' ),
			''
		);

		$page    = $context->content->unsaved( $file );
		$subject = $seo->subject( new HeadContext(
			$context->site,
			(string) ( $file->frontmatter['template'] ?? 'page' ),
			$file->url(),
			[ 'page' => $page ]
		) );

		return [
			'title'              => $subject->title,
			'description'        => $subject->description,
			'url'                => $subject->canonical,
			'html'               => $page->content(),
			'noindex'            => $subject->noindex,
			'social_title'       => $subject->socialTitle(),
			'social_description' => $subject->socialDescription(),
			'image'              => $subject->image,
			'image_preview'      => $subject->string( 'og_image' ) ?: $page->beforeMethod( 'image' ) ?: $settings->string( 'social_image' ),
		];
	}

	/**
	 * The settings form.
	 *
	 * A title and a description pattern *per collection the site has*, built
	 * from its content folders and declared schemas — not a fixed "post" and
	 * "docs". A collection created in the dashboard gets its own patterns the
	 * next time this panel opens. Found by listing directories rather than
	 * reading content: this runs on every dashboard request.
	 *
	 * @return list<array<string, mixed>>
	 */
	private function fields( PluginContext $context ): array {
		$fields = [];

		foreach ( [
			'site_name'        => 'Website name',
			'tagline'          => 'Tagline',
			'separator'        => 'Title separator',
			'home_description' => 'Home description',
		] as $id => $label ) {
			$fields[] = [ 'id' => $id, 'type' => 'home_description' === $id ? 'textarea' : 'text', 'label' => $label ];
		}

		$fields[] = [ 'id' => 'patterns_head', 'type' => 'header', 'content' => 'Title and description patterns' ];
		$fields[] = [
			'id'      => 'patterns_note',
			'type'    => 'paragraph',
			'content' => 'Variables: %%title%%, %%sitename%%, %%sep%%, %%tagline%%, %%excerpt%%, %%page%%, %%currentyear%%.',
		];

		$fields[] = [ 'id' => 'title_home', 'type' => 'text', 'label' => 'Home title' ];
		$fields[] = [ 'id' => 'title_page', 'type' => 'text', 'label' => 'Page title', 'info' => 'Also used by any collection left empty below.' ];
		$fields[] = [ 'id' => 'description_page', 'type' => 'textarea', 'label' => 'Page description' ];

		foreach ( $this->collections( $context ) as $name => $label ) {
			$fields[] = [ 'id' => 'title_' . $name, 'type' => 'text', 'label' => $label . ' title', 'placeholder' => 'Uses the page pattern' ];
			$fields[] = [ 'id' => 'description_' . $name, 'type' => 'textarea', 'label' => $label . ' description', 'placeholder' => 'Uses the page pattern' ];
		}

		$fields[] = [ 'id' => 'sharing_head', 'type' => 'header', 'content' => 'Publisher and sharing' ];

		foreach ( [
			'organization_name' => 'Publisher name',
			'organization_logo' => 'Publisher logo (URL or asset path)',
			'social_image'      => 'Default sharing image (URL or asset path)',
			'twitter_site'      => 'X / Twitter account',
		] as $id => $label ) {
			$fields[] = [ 'id' => $id, 'type' => 'text', 'label' => $label ];
		}

		$fields[] = [
			'id'      => 'organization_type',
			'type'    => 'select',
			'label'   => 'Publisher type',
			'options' => [ [ 'value' => 'Organization', 'label' => 'Organization' ], [ 'value' => 'Person', 'label' => 'Person' ] ],
		];

		$fields[] = [ 'id' => 'output_head', 'type' => 'header', 'content' => 'Output' ];

		foreach ( [ 'schema_enabled' => 'Structured data', 'breadcrumbs_enabled' => 'Breadcrumbs', 'sitemap_enabled' => 'XML sitemap' ] as $id => $label ) {
			$fields[] = [ 'id' => $id, 'type' => 'checkbox', 'label' => $label ];
		}

		$fields[] = [ 'id' => 'sitemap_page_size', 'type' => 'number', 'label' => 'URLs per sitemap file', 'min' => 1, 'max' => 50000 ];
		$fields[] = [ 'id' => 'robots_extra', 'type' => 'textarea', 'label' => 'Additional robots.txt rules' ];

		return $fields;
	}

	/**
	 * The site's collections, by name, with what the dashboard calls them.
	 *
	 * `pages` is left out: its entries are pages, and the page pattern above is
	 * already theirs.
	 *
	 * @return array<string, string>
	 */
	private function collections( PluginContext $context ): array {
		$labels = [];

		foreach ( ContentSchema::all( $context->site->layers() ) as $name => $schema ) {
			$labels[ (string) $name ] = $schema->label;
		}

		$out = [];

		foreach ( glob( $context->site->absolute( 'content' ) . '/*', GLOB_ONLYDIR ) ?: [] as $directory ) {
			$name         = basename( $directory );
			$out[ $name ] = $labels[ $name ] ?? ucfirst( str_replace( '-', ' ', $name ) );
		}

		foreach ( $labels as $name => $label ) {
			$out[ $name ] ??= $label;
		}

		unset( $out['pages'] );
		ksort( $out );

		return $out;
	}
}
