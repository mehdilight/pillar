<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Dev\Media;
use Pillar\Tests\SiteTestCase;

/**
 * The media library lists each image with the site files that mention it, so
 * the dashboard can warn before an image in use is deleted.
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

	/** Writes a real image under `assets/` and returns the name the library lists it by. */
	private function image( string $relative ): string {
		@mkdir( dirname( $this->root . '/assets/' . $relative ), 0777, true );
		file_put_contents( $this->root . '/assets/' . $relative, (string) base64_decode( self::PIXEL, true ) );

		return basename( $relative );
	}
}
