<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Build\Builder;
use Pillar\Pillar;
use Pillar\Schema\Validator;
use Pillar\Tests\SiteTestCase;

/**
 * `examples/starter` is what someone opens first, so it is held to what it
 * promises: it validates, it builds, and the dashboard's settings panels
 * actually restyle it.
 */
final class StarterTest extends SiteTestCase {

	protected function setUp(): void {
		$this->root = sys_get_temp_dir() . '/pillar-starter-' . bin2hex( random_bytes( 6 ) );

		self::copy( dirname( __DIR__, 2 ) . '/examples/starter', $this->root );
		self::remove( $this->root . '/dist' );
		self::remove( $this->root . '/.pillar' );
	}

	public function test_it_validates(): void {
		$pillar    = Pillar::forSite( $this->root, compile: false, drafts: true );
		$validator = new Validator( $pillar->site, $pillar->schemas, $pillar->content );

		self::assertSame( [], $validator->run() );
	}

	public function test_it_builds_without_a_failed_section(): void {
		$pillar = Pillar::forSite( $this->root, compile: false );

		( new Builder( $pillar ) )->build();

		self::assertTrue( $pillar->errors->isEmpty() );
		self::assertFileExists( $this->root . '/dist/sitemap.xml' );
	}

	public function test_the_hero_image_takes_its_alt_from_the_media_library_unless_given_one(): void {
		@mkdir( $this->root . '/assets/uploads', 0777, true );
		file_put_contents( $this->root . '/assets/uploads/team.png', (string) base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', true ) );
		file_put_contents( $this->root . '/config/media.json', '{"uploads/team.png": {"alt": "The team"}}' );

		$template = json_decode( (string) file_get_contents( $this->root . '/templates/index.json' ), true );
		$hero     = $template['order'][0];

		$template['sections'][ $hero ]['settings']['image'] = '/assets/uploads/team.png';
		file_put_contents( $this->root . '/templates/index.json', (string) json_encode( $template ) );

		$html = Pillar::forSite( $this->root, compile: false )->render( 'index' );

		self::assertMatchesRegularExpression( '#<figure class="hero-media"><img src="/assets/uploads/team\.png" alt="The team" class="hero-image"></figure>#', $html );

		$template['sections'][ $hero ]['settings']['image_alt'] = 'Us, in 2026';
		file_put_contents( $this->root . '/templates/index.json', (string) json_encode( $template ) );

		self::assertStringContainsString( 'alt="Us, in 2026"', Pillar::forSite( $this->root, compile: false )->render( 'index' ) );
	}

	public function test_every_color_and_layout_setting_reaches_the_page(): void {
		// A settings panel whose controls change nothing is worse than none —
		// which is what the redesign briefly shipped.
		$values = [
			'color_ink'     => '#101010',
			'color_paper'   => '#fafafa',
			'color_surface' => '#fde7d4',
			'color_muted'   => '#777777',
			'color_accent'  => '#ff00aa',
			'page_max'      => 1100,
			'measure'       => 640,
			'section_gap'   => 96,
			'radius_cards'  => 8,
		];

		$data = json_decode( (string) file_get_contents( $this->root . '/config/settings_data.json' ), true );

		file_put_contents( $this->root . '/config/settings_data.json', (string) json_encode( $values + $data ) );

		$html = Pillar::forSite( $this->root, compile: false )->render( 'index' );

		foreach ( [
			'--color-ink-black: #101010',
			'--color-paper-white: #fafafa',
			'--color-frost-wash: #fde7d4',
			'--color-stone-gray: #777777',
			'--color-electric-lime: #ff00aa',
			'--page-max: 1100px',
			'--measure: 640px',
			'--section-gap: 96px',
			'--radius-cards: 8px',
		] as $declaration ) {
			self::assertStringContainsString( $declaration, $html );
		}
	}

	public function test_every_offered_setting_is_one_the_theme_reads(): void {
		$schema = json_decode( (string) file_get_contents( $this->root . '/config/settings_schema.json' ), true );
		$theme  = (string) file_get_contents( $this->root . '/layout/theme.liqx' );

		foreach ( [ 'Colors', 'Layout' ] as $panel ) {
			$settings = array_values( array_filter( $schema, static fn ( array $p ): bool => $p['name'] === $panel ) )[0]['settings'];

			foreach ( $settings as $setting ) {
				self::assertStringContainsString( 'settings.' . $setting['id'], $theme, $setting['id'] . ' is offered but never read' );
			}
		}
	}

	public function test_the_stylesheet_is_linked(): void {
		self::assertMatchesRegularExpression(
			'#<link rel="stylesheet" href="/assets/base\.css"#',
			Pillar::forSite( $this->root, compile: false )->render( 'index' )
		);
	}
}
