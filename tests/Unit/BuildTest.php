<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Build\Builder;
use Pillar\Tests\SiteTestCase;

/** B3: the build writes `dist/`, and rebuilds only what changed. */
final class BuildTest extends SiteTestCase {

	public function test_it_writes_a_page_per_route(): void {
		$result = $this->build();

		self::assertSame( 4, $result['written'] );
		self::assertFileExists( $this->root . '/dist/index.html' );
		self::assertFileExists( $this->root . '/dist/about/index.html' );
		self::assertFileExists( $this->root . '/dist/posts/hello-world/index.html' );
		self::assertFileExists( $this->root . '/dist/posts/why-static/index.html' );
	}

	public function test_a_content_item_renders_through_its_collection_template(): void {
		$this->build();

		$html = (string) file_get_contents( $this->root . '/dist/posts/hello-world/index.html' );

		self::assertStringContainsString( '<h1>Hello world</h1>', $html );
		self::assertStringContainsString( 'The <strong>first</strong> post.', $html, 'markdown is converted' );
		self::assertStringContainsString( '<time datetime="2026-08-01">', $html, 'show_date is on for posts' );
	}

	public function test_page_and_post_templates_differ_where_their_settings_do(): void {
		$this->build();

		// The same section, two templates, one setting apart.
		self::assertStringNotContainsString( '<time', (string) file_get_contents( $this->root . '/dist/about/index.html' ) );
	}

	public function test_assets_are_copied_and_content_hashed(): void {
		$this->build();

		$assets = glob( $this->root . '/dist/assets/base.*.css' ) ?: [];

		self::assertCount( 1, $assets );
		self::assertStringContainsString(
			'/assets/' . basename( $assets[0] ),
			(string) file_get_contents( $this->root . '/dist/index.html' ),
			'asset_url points at the hashed file'
		);
	}

	public function test_a_second_build_rebuilds_nothing(): void {
		$this->build();

		self::assertSame( [ 'written' => 0, 'skipped' => 4 ], $this->counts( $this->build() ) );
	}

	public function test_editing_content_rebuilds_that_page_and_the_listings_showing_it(): void {
		$this->build();

		// Appended without touching mtimes deliberately: within one second, an
		// mtime check cannot see this change, and used not to.
		file_put_contents( $this->root . '/content/posts/hello-world.md', "\nAn edit.\n", FILE_APPEND );

		// The post itself, and the home page, which lists posts — its title,
		// date and excerpt come from this file. The about page reads neither.
		self::assertSame( [ 'written' => 2, 'skipped' => 2 ], $this->counts( $this->build() ) );
		self::assertStringContainsString( 'An edit.', (string) file_get_contents( $this->root . '/dist/posts/hello-world/index.html' ) );
	}

	public function test_editing_a_shared_snippet_rebuilds_the_pages_that_read_it(): void {
		$this->build();

		file_put_contents( $this->root . '/snippets/post-card.liqx', '<li class="edited-card">x</li>' );

		self::assertSame( [ 'written' => 1, 'skipped' => 3 ], $this->counts( $this->build() ) );
		self::assertStringContainsString( 'edited-card', (string) file_get_contents( $this->root . '/dist/index.html' ) );
	}

	public function test_adding_an_entry_rebuilds_the_pages_that_list_its_collection(): void {
		$this->build();

		// The home page lists posts through `collections.posts`. That read is
		// the dependency — not any template file — and the build used to miss
		// it, leaving the home page showing the old list.
		file_put_contents(
			$this->root . '/content/posts/brand-new.md',
			"---\ntitle: Brand new\ndate: 2026-09-10\n---\nFresh.\n"
		);

		$result = $this->build();

		self::assertStringContainsString( 'Brand new', (string) file_get_contents( $this->root . '/dist/index.html' ) );
		self::assertSame( 2, $result['written'], 'the new post and the home page — not the unrelated pages' );
	}

	public function test_editing_an_entry_in_another_collection_leaves_a_listing_alone(): void {
		$this->build();

		// The about page is in `pages`; the home page lists `posts` only, so it
		// must not rebuild — dependency tracking is precise, not "any content
		// changed, rebuild every listing".
		file_put_contents( $this->root . '/content/pages/about.md', "\nEdited.\n", FILE_APPEND );

		self::assertSame( [ 'written' => 1, 'skipped' => 3 ], $this->counts( $this->build() ) );
	}

	public function test_changing_settings_rebuilds_everything(): void {
		$this->build();

		file_put_contents(
			$this->root . '/config/settings_data.json',
			(string) json_encode( [ 'site_title' => 'Renamed' ] )
		);

		self::assertSame( [ 'written' => 4, 'skipped' => 0 ], $this->counts( $this->build() ) );
		self::assertStringContainsString( '<title>Renamed</title>', (string) file_get_contents( $this->root . '/dist/index.html' ) );
	}

	public function test_a_deleted_output_is_rebuilt_even_when_nothing_changed(): void {
		$this->build();
		unlink( $this->root . '/dist/index.html' );

		self::assertSame( [ 'written' => 1, 'skipped' => 3 ], $this->counts( $this->build() ) );
	}

	public function test_a_template_named_404_does_not_crash_the_build(): void {
		// PHP coerces the array key "404" to an integer, and everything that
		// passed a listing key on as a name crashed on a site with a 404 page —
		// which is most sites.
		file_put_contents(
			$this->root . '/templates/404.json',
			(string) json_encode( [ 'sections' => [ 'body' => [ 'section_type' => 'hero', 'settings' => [ 'heading' => 'Not found' ] ] ] ] )
		);

		$this->build();

		self::assertFileExists( $this->root . '/dist/404.html' );
		self::assertStringContainsString( 'Not found', (string) file_get_contents( $this->root . '/dist/404.html' ) );
	}

	public function test_force_rebuilds_everything(): void {
		$this->build();

		self::assertSame( [ 'written' => 4, 'skipped' => 0 ], $this->counts( $this->build( force: true ) ) );
	}

	/** @return array{written: int, skipped: int, assets: int, ms: int} */
	private function build( bool $force = false ): array {
		return ( new Builder( $this->pillar( compile: false ), $force ) )->build();
	}

	/**
	 * @param array{written: int, skipped: int, assets: int, ms: int} $result
	 *
	 * @return array{written: int, skipped: int}
	 */
	private function counts( array $result ): array {
		return [ 'written' => $result['written'], 'skipped' => $result['skipped'] ];
	}
}
