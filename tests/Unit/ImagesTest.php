<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Build\Builder;
use Pillar\Dev\Server;
use Pillar\Media\ImageResizer;
use Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;

/**
 * Images are resized by the build: every image gets copies at the configured
 * widths, and pages point the browser at them through `srcset`.
 */
final class ImagesTest extends SiteTestCase {

	protected function setUp(): void {
		parent::setUp();

		if ( ! ImageResizer::available() || ! ImageResizer::canWrite( 'webp' ) ) {
			self::markTestSkipped( 'GD with WebP support is needed to resize images.' );
		}

		$this->config( [ 'widths' => [ 320, 640, 960, 1920 ] ] );
		$this->png( 'uploads/photo.png', 1500, 1000 );
		file_put_contents( $this->root . '/content/posts/hello-world.md', "\n![A photo](/assets/uploads/photo.png)\n", FILE_APPEND );
	}

	public function test_a_build_writes_a_copy_at_each_width_narrower_than_the_image(): void {
		( new Builder( $this->pillar() ) )->build();

		$copies = $this->copies( 'photo' );

		// 1920 is wider than the image, so it is not made; the image's own width
		// is, as a WebP, so the widest candidate is not the heavier original.
		$made = array_map( static fn ( string $file ): string => substr( $file, strrpos( $file, '-' ) + 1 ), $copies );
		sort( $made, SORT_NATURAL );
		self::assertSame( [ '320w.webp', '640w.webp', '960w.webp', '1500w.webp' ], $made );

		$size = getimagesize( $this->root . '/dist/assets/uploads/' . $this->copyAt( 640 ) );
		self::assertSame( [ 640, 427 ], [ $size[0], $size[1] ] );
		self::assertSame( 'image/webp', $size['mime'] );
	}

	public function test_a_markdown_image_carries_srcset_sizes_and_its_dimensions(): void {
		$this->config( [ 'widths' => [ 320, 640, 960, 1920 ], 'sizes' => '(min-width: 800px) 720px, 100vw' ] );

		( new Builder( $this->pillar() ) )->build();

		$html = (string) file_get_contents( $this->root . '/dist/posts/hello-world/index.html' );

		self::assertStringContainsString( 'srcset="/assets/uploads/' . $this->copyAt( 320 ) . ' 320w, /assets/uploads/' . $this->copyAt( 640 ) . ' 640w,', $html );
		self::assertStringContainsString( 'sizes="(min-width: 800px) 720px, 100vw"', $html );
		self::assertStringContainsString( 'width="1500" height="1000" loading="lazy" decoding="async"', $html );
		// The original stays the src: a browser without srcset still gets the image.
		self::assertStringContainsString( 'src="/assets/uploads/photo.png"', $html );
	}

	public function test_image_url_snaps_up_to_the_nearest_width_and_image_tag_lists_every_copy(): void {
		$pillar = $this->pillar();

		( new Builder( $pillar ) )->build();

		$filters = $pillar->filters->all();

		self::assertSame( '/assets/uploads/' . $this->copyAt( 960 ), $filters['image_url']( 'uploads/photo.png', 700 ) );
		// Wider than every copy: the widest there is, not an upscale.
		self::assertSame( '/assets/uploads/' . $this->copyAt( 1500 ), $filters['image_url']( 'uploads/photo.png', 4000 ) );
		self::assertStringStartsWith( '/assets/uploads/photo.', $filters['image_url']( 'uploads/photo.png' ) );

		$tag = $filters['image_tag']( 'uploads/photo.png', 'A photo', 'cover', '50vw', 'eager' );
		self::assertStringContainsString( ' class="cover" srcset="', $tag );
		self::assertStringContainsString( ' 1500w" sizes="50vw" width="1500" height="1000" loading="eager"', $tag );
	}

	public function test_images_without_copies_are_left_as_they_are(): void {
		file_put_contents( $this->root . '/assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' );
		$this->png( 'icon.png', 200, 200 );

		$pillar = $this->pillar();

		( new Builder( $pillar ) )->build();

		$filters = $pillar->filters->all();

		self::assertSame( [], glob( $this->root . '/dist/assets/icon.*-*w.*' ) );
		self::assertStringNotContainsString( 'srcset', $filters['image_tag']( 'logo.svg' ) );
		self::assertStringContainsString( 'width="200" height="200"', $filters['image_tag']( 'icon.png' ) );
		self::assertSame( 'https://cdn.example.com/a.jpg', $filters['image_url']( 'https://cdn.example.com/a.jpg', 640 ) );
	}

	public function test_an_incremental_build_keeps_copies_and_a_deleted_image_takes_them_with_it(): void {
		( new Builder( $this->pillar() ) )->build();

		$result = ( new Builder( $this->pillar() ) )->build();
		self::assertSame( 0, $result['written'] );
		self::assertCount( 4, $this->copies( 'photo' ) );

		unlink( $this->root . '/assets/uploads/photo.png' );
		( new Builder( $this->pillar() ) )->build();

		self::assertSame( [], $this->copies( 'photo' ) );
	}

	public function test_copies_are_made_once_and_reused_from_the_cache(): void {
		( new Builder( $this->pillar() ) )->build();

		$cached = glob( $this->root . '/.pillar/images/*' );
		$times  = array_map( 'filemtime', $cached );

		touch( $this->root . '/content/posts/hello-world.md', time() + 5 );
		( new Builder( $this->pillar(), force: true ) )->build();

		clearstatcache();
		self::assertSame( $times, array_map( 'filemtime', $cached ) );
	}

	public function test_copies_can_keep_the_original_format(): void {
		$this->config( [ 'widths' => [ 640 ], 'format' => 'original' ] );

		( new Builder( $this->pillar() ) )->build();

		// Same format, so there is no full-width copy: the original is that.
		self::assertSame( [ $this->root . '/dist/assets/uploads/' . $this->copyAt( 640 ) ], $this->copies( 'photo' ) );
		self::assertStringEndsWith( '-640w.png', $this->copyAt( 640 ) );
	}

	public function test_the_dev_preview_resizes_on_request_and_only_to_configured_widths(): void {
		$html = $this->pillar()->filters->all()['image_tag']( 'uploads/photo.png' );

		self::assertStringContainsString( 'srcset="/assets/uploads/photo.png?w=320 320w, /assets/uploads/photo.png?w=640 640w', $html );

		$server = new Server( $this->root, $this->root . '/no-dashboard' );

		$response = $server->handle( Request::create( '/assets/uploads/photo.png?w=640' ) );
		self::assertSame( 200, $response->getStatusCode() );
		self::assertSame( 'image/webp', $response->headers->get( 'Content-Type' ) );

		self::assertSame( 404, $server->handle( Request::create( '/assets/uploads/photo.png?w=641' ) )->getStatusCode() );
	}

	/** @param array<string, mixed> $images */
	private function config( array $images ): void {
		$site           = json_decode( (string) file_get_contents( $this->root . '/site.json' ), true );
		$site['images'] = $images;

		file_put_contents( $this->root . '/site.json', (string) json_encode( $site ) );
	}

	private function png( string $relative, int $width, int $height ): void {
		$image = imagecreatetruecolor( $width, $height );
		imagefill( $image, 0, 0, (int) imagecolorallocate( $image, 40, 120, 200 ) );

		@mkdir( dirname( $this->root . '/assets/' . $relative ), 0777, true );
		imagepng( $image, $this->root . '/assets/' . $relative );
	}

	/** @return list<string> the built copies of `uploads/<stem>.png`, sorted */
	private function copies( string $stem ): array {
		$files = glob( $this->root . '/dist/assets/uploads/' . $stem . '.*-*w.*' ) ?: [];
		sort( $files );

		return $files;
	}

	private function copyAt( int $width ): string {
		foreach ( $this->copies( 'photo' ) as $file ) {
			if ( preg_match( '/-' . $width . 'w\.\w+$/', $file ) ) {
				return basename( $file );
			}
		}

		self::fail( 'No copy at ' . $width . 'px.' );
	}
}
