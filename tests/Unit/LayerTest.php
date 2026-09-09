<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use Pillar\PillarException;
use Pillar\Site\PathPolicy;
use Pillar\Site\Site;
use Pillar\Tests\SiteTestCase;

/**
 * The cascade: site → addons (in declared order) → theme.
 *
 * This is the mechanism theme addons are built on, so it is tested as a
 * mechanism rather than through a rendered page.
 */
final class LayerTest extends SiteTestCase {

	public function test_the_site_wins_over_an_addon_and_a_theme(): void {
		$this->withLayers( theme: 'theme', addons: [ 'addon' ] );

		$html = $this->pillar()->render( 'index' );

		self::assertStringContainsString( 'class="hero"', $html, "the site's own hero wins" );
		self::assertStringNotContainsString( 'addon-hero', $html );
		self::assertStringNotContainsString( 'theme-hero', $html );
	}

	public function test_an_addon_wins_over_the_theme(): void {
		$this->withLayers( theme: 'theme', addons: [ 'addon' ] );
		unlink( $this->root . '/sections/hero.liqx' );

		self::assertStringContainsString( 'addon-hero', $this->pillar()->render( 'index' ) );
	}

	public function test_the_theme_answers_what_no_one_else_offers(): void {
		$this->withLayers( theme: 'theme', addons: [ 'addon' ] );
		unlink( $this->root . '/sections/hero.liqx' );
		unlink( $this->root . '/vendor-addons/addon/sections/hero.liqx' );

		self::assertStringContainsString( 'theme-hero', $this->pillar()->render( 'index' ) );
	}

	public function test_candidates_explain_which_layer_won(): void {
		$this->withLayers( theme: 'theme', addons: [ 'addon' ] );

		$candidates = Site::load( $this->root )->layers()->candidates( 'sections/hero.liqx' );

		// What `pillar check --why` prints: every layer offering the file,
		// winner first — so an override that does nothing is answerable.
		self::assertSame( [ 'site', 'addon:addon', 'theme:fixture' ], array_column( $candidates, 'layer' ) );
	}

	public function test_a_listing_merges_layers_with_the_higher_one_shadowing(): void {
		$this->withLayers( theme: 'theme', addons: [ 'addon' ] );

		$sections = Site::load( $this->root )->layers()->listing( 'sections' );

		self::assertArrayHasKey( 'related-posts', $sections, 'contributed by the addon' );
		self::assertArrayHasKey( 'announcement', $sections, 'contributed by the theme' );
		self::assertStringContainsString( '/sections/hero.liqx', $sections['hero'] );
		self::assertStringNotContainsString( 'vendor-addons', $sections['hero'], 'the site shadows the addon' );
	}

	public function test_a_declared_addon_that_is_missing_is_an_error(): void {
		file_put_contents(
			$this->root . '/site.json',
			json_encode( [ 'name' => 'x', 'addons' => [ 'vendor-addons/nope' ] ] )
		);

		$this->expectException( PillarException::class );
		$this->expectExceptionMessageMatches( '/Addon "vendor-addons\/nope" is declared/' );

		Site::load( $this->root )->layers();
	}

	#[DataProvider( 'unsafePaths' )]
	public function test_the_path_policy_refuses_what_a_layer_may_not_contain( string $path ): void {
		$this->expectException( PillarException::class );

		PathPolicy::normalise( $path );
	}

	/** @return array<string, array{string}> */
	public static function unsafePaths(): array {
		return [
			'traversal'          => [ 'sections/../../etc/passwd' ],
			'absolute'           => [ '/etc/passwd' ],
			'php'                => [ 'sections/evil.php' ],
			'unlisted folder'    => [ 'src/Kernel.liqx' ],
			'php in a good name' => [ 'snippets/card.php' ],
		];
	}

	public function test_the_path_policy_allows_what_a_theme_really_ships(): void {
		self::assertSame( 'sections/hero.liqx', PathPolicy::normalise( 'sections/hero.liqx' ) );
		self::assertSame( 'assets/base.css', PathPolicy::normalise( './assets/base.css' ) );
		self::assertSame( 'schemas/posts.json', PathPolicy::normalise( 'schemas/posts.json' ) );
	}
}
