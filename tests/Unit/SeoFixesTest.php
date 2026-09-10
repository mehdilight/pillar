<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Build\RouteRegistry;
use Pillar\Plugin\PluginContext;
use Pillar\Tests\SiteTestCase;

/**
 * The review fixes to the SEO port: collections are not a fixed list, the
 * build is not invalidated by the calendar, and registering the plugin does
 * not walk the site.
 */
final class SeoFixesTest extends SiteTestCase {

	protected function setUp(): void {
		parent::setUp();

		$config = json_decode( (string) file_get_contents( $this->root . '/site.json' ), true );

		$config['plugins']  = [ 'seo' ];
		$config['base_url'] = 'https://example.test';

		file_put_contents( $this->root . '/site.json', (string) json_encode( $config ) );
		file_put_contents( $this->root . '/layout/theme.liqx', '<html><head>{content_for_header}</head><body>{content_for_layout}</body></html>' );

		// A collection the plugin has never heard of, with a dated entry and an
		// undated one.
		@mkdir( $this->root . '/content/guides', 0777, true );
		file_put_contents( $this->root . '/content/guides/dated.md', "---\ntitle: A dated guide\ndate: 2026-09-01\n---\nBody.\n" );
		file_put_contents( $this->root . '/content/guides/undated.md', "---\ntitle: An undated guide\n---\nBody.\n" );
	}

	public function test_a_dated_entry_in_any_collection_is_an_article(): void {
		$html = $this->render( 'guides', 'dated' );

		self::assertStringContainsString( 'property="og:type" content="article"', $html );
		self::assertStringContainsString( '"@type":"Article"', $html );
		self::assertStringContainsString( 'property="article:published_time" content="2026-09-01"', $html );
	}

	public function test_an_undated_entry_is_a_plain_page(): void {
		$html = $this->render( 'guides', 'undated' );

		self::assertStringContainsString( 'property="og:type" content="website"', $html );
		self::assertStringNotContainsString( '"@type":"Article"', $html );
	}

	public function test_a_collection_can_be_mapped_to_a_schema_type(): void {
		$this->settings( [ 'article_types' => [ 'guides' => 'HowTo' ] ] );

		self::assertStringContainsString( '"@type":"HowTo"', $this->render( 'guides', 'undated' ) );
	}

	public function test_a_collection_gets_its_own_title_pattern_by_name(): void {
		$this->settings( [ 'title_guides' => 'Guide: %%title%%' ] );

		self::assertStringContainsString( '<title>Guide: A dated guide</title>', $this->render( 'guides', 'dated' ) );
	}

	public function test_a_collection_with_no_pattern_falls_back_to_the_page_pattern(): void {
		$this->settings( [ 'title_page' => '%%title%% | Site' ] );

		self::assertStringContainsString( '<title>A dated guide | Site</title>', $this->render( 'guides', 'dated' ) );
	}

	public function test_a_singular_key_from_before_still_works(): void {
		// Sites configured with `title_post` before patterns were keyed by
		// collection keep their titles.
		$this->settings( [ 'title_post' => 'Post: %%title%%' ] );

		self::assertStringContainsString( '<title>Post: Hello world</title>', $this->render( 'posts', 'hello-world' ) );
	}

	public function test_the_settings_panel_offers_patterns_for_every_collection(): void {
		$ids = array_column( $this->pillar()->editor->schema()[0]['settings'], 'id' );

		self::assertContains( 'plugin:seo:title_guides', $ids );
		self::assertContains( 'plugin:seo:title_posts', $ids );
		self::assertNotContains( 'plugin:seo:title_pages', $ids, 'pages use the page pattern' );
	}

	public function test_decorative_fields_are_not_written_to_the_config(): void {
		$values = $this->pillar()->editor->values();

		self::assertArrayNotHasKey( 'plugin:seo:patterns_head', $values );
		self::assertArrayHasKey( 'plugin:seo:title_page', $values );
	}

	public function test_the_build_does_not_depend_on_the_date_unless_a_pattern_does(): void {
		self::assertNotContains( date( 'Y-m-d' ), $this->fingerprints(), 'no daily full rebuild' );
		self::assertNotContains( date( 'Y' ), $this->fingerprints() );

		$this->settings( [ 'title_page' => '%%title%% © %%currentyear%%' ] );

		self::assertContains( date( 'Y' ), $this->fingerprints(), 'a yearly one, because a title now reads the year' );
	}

	public function test_registering_the_plugin_does_not_walk_the_site(): void {
		$pillar = $this->pillar();

		// Plugins register on every `pillar dev` API request. Reading every
		// markdown file to count sitemap chunks made each dashboard click pay
		// for a sitemap nobody asked for.
		$files = new \ReflectionProperty( $pillar->content, 'files' );

		self::assertNull( $files->getValue( $pillar->content ), 'content not loaded by registration' );
		self::assertNotNull( $pillar->routes->find( '/sitemap.xml' ), 'but the sitemap is there when asked for' );
	}

	public function test_a_route_provider_runs_only_when_routes_are_asked_for(): void {
		$registry = new RouteRegistry();
		$calls    = 0;

		$registry->provide( function () use ( &$calls ): array {
			$calls++;

			return [ [ 'url' => '/x.xml', 'type' => 'text/xml', 'render' => static fn (): string => '<x/>' ] ];
		} );

		self::assertSame( 0, $calls );
		self::assertNotNull( $registry->find( '/x.xml' ) );
		$registry->all();
		self::assertSame( 1, $calls, 'and only once' );
	}

	public function test_previewing_an_existing_entry_shows_what_is_being_typed(): void {
		$pillar = $this->pillar();

		// Warm the page cache the way a build or a sitemap would.
		$pillar->content->page( $pillar->content->find( 'posts', 'hello-world' ) );

		$preview = $pillar->editor->resolvePreview( 'seo', [
			'collection'  => 'posts',
			'slug'        => 'hello-world',
			'frontmatter' => [ 'title' => 'Hello world', 'seo' => [ 'description' => 'Being typed right now' ] ],
			'body'        => 'Body.',
		] );

		self::assertSame( 'Being typed right now', $preview['description'] );
	}

	/** @param array<string, mixed> $settings */
	private function settings( array $settings ): void {
		@mkdir( $this->root . '/config/plugins', 0777, true );
		file_put_contents( $this->root . '/config/plugins/seo.json', (string) json_encode( $settings ) );
	}

	private function render( string $collection, string $slug ): string {
		$pillar = $this->pillar();
		$file   = $pillar->content->find( $collection, $slug );

		self::assertNotNull( $file );

		return $pillar->render( 'post', $file->url(), [ 'page' => $pillar->content->page( $file ) ] );
	}

	/** @return list<string> */
	private function fingerprints(): array {
		return array_merge( ...array_map(
			static fn ( PluginContext $plugin ): array => $plugin->fingerprints(),
			$this->pillar()->plugins
		) );
	}
}
