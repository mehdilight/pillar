<?php
declare( strict_types=1 );

namespace Pillar\Media;

use Pillar\PillarException;

/**
 * Resizes one raster image with GD.
 *
 * GD because it ships with nearly every PHP; with it missing, images are
 * simply served at their original size — nothing breaks, nothing is smaller.
 * JPEG, PNG and WebP are resized. GIF is left alone (resizing would drop its
 * animation) and SVG needs no smaller copy.
 */
final class ImageResizer {

	public const RESIZABLE = [ 'jpg', 'jpeg', 'png', 'webp' ];

	public static function available(): bool {
		return function_exists( 'imagecreatefromstring' ) && function_exists( 'imagecopyresampled' );
	}

	public static function canResize( string $path ): bool {
		return self::available() && in_array( strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), self::RESIZABLE, true );
	}

	public static function canWrite( string $format ): bool {
		if ( ! self::available() || ! function_exists( 'imagetypes' ) ) {
			return false;
		}

		return match ( $format ) {
			'webp'        => function_exists( 'imagewebp' ) && ( imagetypes() & IMG_WEBP ) !== 0,
			'jpg', 'jpeg' => function_exists( 'imagejpeg' ),
			'png'         => function_exists( 'imagepng' ),
			default       => false,
		};
	}

	/**
	 * Width and height as the image is seen — a phone photo stored sideways
	 * with an EXIF rotation reports the rotated size, as browsers draw it.
	 *
	 * @return array{0: int, 1: int}|null
	 */
	public static function dimensions( string $path ): ?array {
		$size = @getimagesize( $path );

		if ( false === $size || $size[0] < 1 || $size[1] < 1 ) {
			return null;
		}

		return in_array( self::orientation( $path ), [ 5, 6, 7, 8 ], true ) ? [ $size[1], $size[0] ] : [ $size[0], $size[1] ];
	}

	/**
	 * Write `$source` scaled to `$width` (aspect kept) as `$format` to
	 * `$target` — through a temporary file, so a failed or interrupted resize
	 * never leaves a half-written image where a build will find it.
	 */
	public function resize( string $source, string $target, int $width, string $format, int $quality ): void {
		$image = @imagecreatefromstring( (string) file_get_contents( $source ) );

		if ( false === $image ) {
			throw new PillarException( sprintf( 'Could not read %s as an image.', basename( $source ) ) );
		}

		$image  = $this->orient( $image, self::orientation( $source ) );
		$height = max( 1, (int) round( imagesy( $image ) * $width / imagesx( $image ) ) );
		$copy   = imagecreatetruecolor( $width, $height );

		// Transparency survives: PNG and WebP keep their alpha channel.
		imagealphablending( $copy, false );
		imagesavealpha( $copy, true );
		imagefill( $copy, 0, 0, (int) imagecolorallocatealpha( $copy, 0, 0, 0, 127 ) );
		imagecopyresampled( $copy, $image, 0, 0, 0, 0, $width, $height, imagesx( $image ), imagesy( $image ) );

		@mkdir( dirname( $target ), 0777, true );

		$temporary = $target . '.' . bin2hex( random_bytes( 4 ) ) . '.tmp';
		$written   = match ( $format ) {
			'webp'  => imagewebp( $copy, $temporary, $quality ),
			'png'   => imagepng( $copy, $temporary, 6 ),
			default => $this->jpeg( $copy, $temporary, $quality ),
		};

		if ( ! $written || ! rename( $temporary, $target ) ) {
			@unlink( $temporary );

			throw new PillarException( sprintf( 'Could not write a resized copy of %s.', basename( $source ) ) );
		}
	}

	private function jpeg( \GdImage $image, string $path, int $quality ): bool {
		imageinterlace( $image, true );

		return imagejpeg( $image, $path, $quality );
	}

	private static function orientation( string $path ): int {
		if ( ! function_exists( 'exif_read_data' ) || ! in_array( strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), [ 'jpg', 'jpeg' ], true ) ) {
			return 1;
		}

		$exif = @exif_read_data( $path );

		return is_array( $exif ) ? (int) ( $exif['Orientation'] ?? 1 ) : 1;
	}

	/** Undo an EXIF orientation, so the copy needs none. */
	private function orient( \GdImage $image, int $orientation ): \GdImage {
		if ( in_array( $orientation, [ 2, 4, 5, 7 ], true ) ) {
			imageflip( $image, IMG_FLIP_HORIZONTAL );
		}

		// Counter-clockwise, as imagerotate turns: 6 is "rotate 90° clockwise".
		$angle = match ( $orientation ) {
			3, 4    => 180,
			6, 7    => 270,
			5, 8    => 90,
			default => 0,
		};

		return 0 === $angle ? $image : ( imagerotate( $image, $angle, 0 ) ?: $image );
	}
}
