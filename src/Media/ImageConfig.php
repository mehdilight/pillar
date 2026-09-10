<?php
declare( strict_types=1 );

namespace Pillar\Media;

use Pillar\Site\Site;

/**
 * How images are resized — `images` in `site.json`, every key optional:
 *
 *     "images": {
 *       "widths": [320, 640, 960, 1280, 1920],
 *       "quality": 80,
 *       "format": "webp",
 *       "sizes": "(min-width: 760px) 720px, 100vw"
 *     }
 *
 * `widths` are the only sizes ever produced: a template asking for 700px gets
 * the 960px copy. A fixed set is what lets the build make every copy once, up
 * front, and know exactly which files it owns. `format` is `webp` or
 * `original`; `sizes` is what markdown images tell the browser, since only
 * the theme knows how wide its content column is.
 */
final class ImageConfig {

	public const DEFAULT_WIDTHS = [ 320, 640, 960, 1280, 1920 ];

	/**
	 * @param list<int> $widths ascending
	 */
	public function __construct(
		public readonly array $widths = self::DEFAULT_WIDTHS,
		public readonly int $quality = 80,
		public readonly string $format = 'webp',
		public readonly string $sizes = '100vw',
	) {}

	public static function fromSite( Site $site ): self {
		$raw = is_array( $site->raw['images'] ?? null ) ? $site->raw['images'] : [];

		$widths = array_values( array_unique( array_filter(
			array_map( 'intval', is_array( $raw['widths'] ?? null ) ? $raw['widths'] : self::DEFAULT_WIDTHS ),
			static fn ( int $width ): bool => $width >= 16 && $width <= 8192
		) ) );
		sort( $widths );

		$format = 'original' === ( $raw['format'] ?? 'webp' ) || ! ImageResizer::canWrite( 'webp' ) ? 'original' : 'webp';

		return new self(
			[] === $widths ? self::DEFAULT_WIDTHS : $widths,
			max( 1, min( 100, (int) ( $raw['quality'] ?? 80 ) ) ),
			$format,
			trim( (string) ( $raw['sizes'] ?? '' ) ) ?: '100vw',
		);
	}

	/** What a copy of an image in `$extension` is written as. */
	public function formatFor( string $extension ): string {
		$extension = strtolower( $extension );

		return 'webp' === $this->format ? 'webp' : ( 'jpeg' === $extension ? 'jpg' : $extension );
	}

	/** Changes whenever a copy made under this configuration would differ. */
	public function signature(): string {
		return implode( ',', $this->widths ) . '|' . $this->quality . '|' . $this->format;
	}
}
