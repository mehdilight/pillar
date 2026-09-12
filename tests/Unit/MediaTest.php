<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Dev\Media;
use Phpmystic\Pillar\Dev\Server;
use Phpmystic\Pillar\Media\AltText;
use Symfony\Component\HttpFoundation\Request;
use Phpmystic\Pillar\Tests\SiteTestCase;

/**
 * The media library lists each image with the site files that mention it, so
 * the dashboard can warn before an image in use is deleted, and gives each one
 * alt text that is used wherever the image appears without its own.
 */
final class MediaTest extends SiteTestCase {

	/** A 1×1 PNG. */
	private const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

	public function test_an_image_lists_the_files_that_reference_it_in_any_form(): void {
		$logo = $this->image( 'logo.png' );
		$hero = $this->image( 'uploads/hero.png' );

		file_put_contents( $this->root . '/content/posts/hello-world.md', "\n![Hero](/assets/uploads/hero.png)\n", FILE_APPEND );
		file_put_contents( $this->root . '/config/settings_data.json', '{"image": "uploads/hero.png"}' );
		file_put_contents( $this->root . '/assets/base.css', 'a { background: url(../assets/logo.png); }', FILE_APPEND );

		$images = array_column( ( new Media( $this->pillar()->site ) )->all(), null, 'name' );

		self::assertSame( [ 'assets/base.css' ], $images[ $logo ]['used_in'] );
		self::assertSame( [ 'config/settings_data.json', 'content/posts/hello-world.md' ], $images[ $hero ]['used_in'] );
		self::assertGreaterThan( 0, $images[ $hero ]['modified'] );
	}

	public function test_a_longer_name_ending_in_the_same_text_is_not_a_reference(): void {
		$logo = $this->image( 'logo.png' );

		file_put_contents( $this->root . '/content/pages/about.md', "\n![](/assets/site-logo.png) ![](/assets/logo.png.bak)\n", FILE_APPEND );

		$images = array_column( ( new Media( $this->pillar()->site ) )->all(), null, 'name' );

		self::assertSame( [], $images[ $logo ]['used_in'] );
	}

	public function test_alt_text_is_set_through_the_api_and_kept_in_config(): void {
		$this->image( 'uploads/team.png' );

		$response = ( new Server( $this->root, $this->root . '/no-dashboard' ) )->handle(
			Request::create( '/api/media/alt', 'PUT', [], [], [], [], (string) json_encode( [ 'url' => '/assets/uploads/team.png', 'alt' => "  The team\n at the offsite " ] ) )
		);

		self::assertSame( 200, $response->getStatusCode(), (string) $response->getContent() );
		self::assertSame( 'The team at the offsite', json_decode( (string) $response->getContent(), true )['alt'] );
		self::assertSame(
			[ 'uploads/team.png' => [ 'alt' => 'The team at the offsite' ] ],
			json_decode( (string) file_get_contents( $this->root . '/config/media.json' ), true )
		);

		$images = array_column( ( new Media( $this->pillar()->site ) )->all(), null, 'name' );

		self::assertSame( 'The team at the offsite', $images['team.png']['alt'] );
	}

	public function test_clearing_the_last_alt_or_deleting_the_image_leaves_no_entry(): void {
		$this->image( 'uploads/team.png' );
		$this->image( 'uploads/logo.png' );

		$media = new Media( $this->pillar()->site );
		$media->setAlt( '/assets/uploads/team.png', 'The team' );
		$media->setAlt( '/assets/uploads/logo.png', 'Our logo' );

		$media->setAlt( '/assets/uploads/team.png', '' );
		$media->delete( '/assets/uploads/logo.png' );

		self::assertFileDoesNotExist( $this->root . '/config/media.json' );
	}

	public function test_an_image_without_alt_of_its_own_takes_the_librarys(): void {
		$this->image( 'uploads/team.png' );
		( new AltText( $this->pillar()->site ) )->set( '/assets/uploads/team.png', 'The team' );

		$filters = $this->pillar()->filters->all();

		self::assertStringContainsString( 'alt="The team"', $filters['markdownify']( '![](/assets/uploads/team.png)' ) );
		// An alt written where the image is used wins.
		self::assertStringContainsString( 'alt="Us"', $filters['markdownify']( '![Us](/assets/uploads/team.png)' ) );
		self::assertStringContainsString( 'alt="The team"', $filters['image_tag']( 'uploads/team.png' ) );
		self::assertStringContainsString( 'alt="Us"', $filters['image_tag']( 'uploads/team.png', 'Us' ) );
		self::assertSame( 'The team', $filters['image_alt']( '/assets/uploads/team.png' ) );
		self::assertSame( '', $filters['image_alt']( 'https://example.com/assets/uploads/team.png' ) );
	}

	public function test_a_library_key_is_the_path_under_assets_whatever_the_form(): void {
		self::assertSame( 'uploads/a.png', AltText::key( '/assets/uploads/a.png' ) );
		self::assertSame( 'uploads/a.png', AltText::key( 'assets/uploads/a.png?w=400' ) );
		self::assertSame( 'uploads/a.png', AltText::key( 'uploads/a.png' ) );
		self::assertNull( AltText::key( 'https://cdn.example.com/a.png' ) );
		self::assertNull( AltText::key( '/images/a.png' ) );
		self::assertNull( AltText::key( 'data:image/png;base64,AAAA' ) );
	}

	/** Writes a real image under `assets/` and returns the name the library lists it by. */
	private function image( string $relative ): string {
		@mkdir( dirname( $this->root . '/assets/' . $relative ), 0777, true );
		file_put_contents( $this->root . '/assets/' . $relative, (string) base64_decode( self::PIXEL, true ) );

		return basename( $relative );
	}
}
