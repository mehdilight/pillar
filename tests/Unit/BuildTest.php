<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\Tests\SiteTestCase;

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

	public function test_every_page_using_a_snippet_is_rebuilt_when_it_changes(): void {
		// Two pages render <PostCard>. Liqx caches a parsed snippet, so without
		// care only the first page to render it records it as a dependency.
		copy( $this->root . '/templates/index.json', $this->root . '/templates/archive.json' );

		( new Builder( $this->pillar() ) )->build();

		$manifest = json_decode( (string) file_get_contents( $this->root . '/.pillar/manifest.json' ), true );

		foreach ( [ '/', '/archive/' ] as $url ) {
			self::assertNotEmpty(
				array_filter( $manifest['pages'][ $url ]['deps'], static fn ( string $dep ): bool => str_ends_with( $dep, 'snippets/post-card.liqx' ) ),
				$url . ' does not record the snippet it renders'
			);
		}

		file_put_contents( $this->root . '/snippets/post-card.liqx', "<li class=\"changed\">{props.post.title}</li>" );
		( new Builder( $this->pillar() ) )->build();

		self::assertStringContainsString( 'class="changed"', (string) file_get_contents( $this->root . '/dist/index.html' ) );
		self::assertStringContainsString( 'class="changed"', (string) file_get_contents( $this->root . '/dist/archive/index.html' ) );
	}

	public function test_a_deleted_entry_takes_its_folder_with_it(): void {
		( new Builder( $this->pillar() ) )->build();
		self::assertDirectoryExists( $this->root . '/dist/posts/why-static' );

		unlink( $this->root . '/content/posts/why-static.md' );
		( new Builder( $this->pillar() ) )->build();

		self::assertDirectoryDoesNotExist( $this->root . '/dist/posts/why-static' );
		self::assertDirectoryExists( $this->root . '/dist/posts' );
	}

	public function test_an_empty_declared_collection_does_not_make_its_entry_template_a_page(): void {
		file_put_contents( $this->root . '/schemas/guides.json', '{"label": "Guides", "fields": [{"id": "title", "type": "text"}]}' );
		copy( $this->root . '/templates/post.json', $this->root . '/templates/guide.json' );

		$urls = array_map( static fn ( $route ): string => $route->url, ( new \Phpmystic\Pillar\Build\RouteTable( $this->pillar()->site, $this->pillar()->content ) )->all() );

		self::assertNotContains( '/guide/', $urls );
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

	public function test_an_image_referenced_from_markdown_by_its_plain_path_exists_in_the_build(): void {
		// What the rich editor's image button writes. Only the hashed copy used
		// to be built, so this was a broken image on every built page.
		@mkdir( $this->root . '/assets/uploads', 0777, true );
		file_put_contents( $this->root . '/assets/uploads/photo.png', "\x89PNG\r\n\x1a\n" );
		file_put_contents( $this->root . '/content/posts/pictured.md', "---\ntitle: Pictured\n---\n![A photo](/assets/uploads/photo.png)\n" );

		$this->build();

		self::assertStringContainsString( 'src="/assets/uploads/photo.png"', (string) file_get_contents( $this->root . '/dist/posts/pictured/index.html' ) );
		self::assertFileExists( $this->root . '/dist/assets/uploads/photo.png' );
		self::assertCount( 1, glob( $this->root . '/dist/assets/uploads/photo.*.png' ) ?: [], 'the hashed copy is still there for asset_url' );

		unlink( $this->root . '/assets/uploads/photo.png' );
		$this->build();

		self::assertFileDoesNotExist( $this->root . '/dist/assets/uploads/photo.png', 'a deleted asset takes both copies with it' );
		self::assertSame( [], glob( $this->root . '/dist/assets/uploads/photo.*.png' ) ?: [] );
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
