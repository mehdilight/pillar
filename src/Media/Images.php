<?php
declare( strict_types=1 );

namespace Pillar\Media;

use League\CommonMark\Event\DocumentParsedEvent;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use Pillar\PillarException;
use Pillar\Site\Site;

/**
 * Smaller copies of the site's images, and what a page needs to use them.
 *
 * **In a build**, every JPEG, PNG and WebP under `assets/` is copied at each
 * configured width narrower than itself — up front, not as templates ask.
 * Which copies exist is then a function of the assets alone: an incremental
 * build that skips a page still has every copy that page points at, and a
 * deleted image takes its copies with it, with no record of who used what.
 * Copies are cached under `.pillar/images/` by content and settings, so each
 * is made once, not once per build.
 *
 * **In the dev preview** nothing is built: a copy is `/assets/photo.jpg?w=640`
 * and the dev server makes it on request, through the same cache.
 *
 * Either way a page gets `srcset` candidates, widths for `width`/`height`,
 * and a snapped URL for `image_url(640)`.
 */
final class Images {

	/** @var array<string, array<int, string>>|null key => width => copy, set by a build */
	private ?array $copies = null;

	/** @var array<string, array{0: int, 1: int}|null> */
	private array $dimensions = [];

	public function __construct(
		private readonly Site $site,
		public readonly ImageConfig $config,
		private readonly ImageResizer $resizer = new ImageResizer(),
	) {}

	/**
	 * Make every copy the build ships, into `$outputDir/assets/`.
	 *
	 * @param array<string, string> $assets original name => hashed name, from the asset copy
	 *
	 * @return array<string, array<int, string>> original name => width => copy's name
	 */
	public function generate( string $outputDir, array $assets ): array {
		$copies = [];

		foreach ( array_keys( $assets ) as $key ) {
			$key  = (string) $key;
			$path = $this->source( $key );

			if ( null === $path || ! ImageResizer::canResize( $path ) || null === $this->dimensionsOf( $path ) ) {
				continue;
			}

			foreach ( $this->widthsFor( $path ) as $width ) {
				try {
					$cached = $this->copy( $path, $width );
				} catch ( PillarException ) {
					// An image GD cannot read is shipped as it is.
					continue 2;
				}

				$name   = self::copyName( $key, $cached, $width );
				$target = $outputDir . '/assets/' . $name;

				@mkdir( dirname( $target ), 0777, true );
				copy( $cached, $target );

				$copies[ $key ][ $width ] = $name;
			}
		}

		return $copies;
	}

	/**
	 * From here on, URLs point at a build's copies instead of the dev server.
	 *
	 * @param array<string, array<int, string>> $copies
	 */
	public function useBuild( array $copies ): void {
		$this->copies = $copies;
	}

	/**
	 * `srcset` candidates, narrowest first — `[]` for anything without
	 * copies: an SVG, a GIF, an external URL, or an image already narrower
	 * than the smallest width.
	 *
	 * @return list<array{width: int, url: string}>
	 */
	public function candidates( string $url ): array {
		$key = AltText::key( $url );

		if ( null === $key ) {
			return [];
		}

		if ( null !== $this->copies ) {
			$candidates = [];

			foreach ( $this->copies[ $key ] ?? [] as $width => $name ) {
				$candidates[] = [ 'width' => (int) $width, 'url' => '/assets/' . $name ];
			}

			return $candidates;
		}

		$path = $this->source( $key );

		if ( null === $path || ! ImageResizer::canResize( $path ) ) {
			return [];
		}

		return array_map(
			static fn ( int $width ): array => [ 'width' => $width, 'url' => '/assets/' . $key . '?w=' . $width ],
			$this->widthsFor( $path )
		);
	}

	/** The copy at least `$width` wide — or null, and the caller uses the original. */
	public function url( string $url, int $width ): ?string {
		$candidates = $this->candidates( $url );

		foreach ( $candidates as $candidate ) {
			if ( $candidate['width'] >= $width ) {
				return $candidate['url'];
			}
		}

		return [] === $candidates ? null : $candidates[ count( $candidates ) - 1 ]['url'];
	}

	/** @return array{0: int, 1: int}|null the original's width and height */
	public function dimensions( string $url ): ?array {
		$key  = AltText::key( $url );
		$path = null === $key ? null : $this->source( $key );

		return null === $path ? null : $this->dimensionsOf( $path );
	}

	/**
	 * The dev server's side: the cached copy of an asset at `$width`, made if
	 * need be. Only configured widths — a request cannot fill the cache with
	 * every width from 1 to 10,000.
	 */
	public function devCopy( string $key, int $width ): ?string {
		$path = $this->source( $key );

		if ( null === $path || ! ImageResizer::canResize( $path ) || ! in_array( $width, $this->widthsFor( $path ), true ) ) {
			return null;
		}

		try {
			return $this->copy( $path, $width );
		} catch ( PillarException ) {
			return null;
		}
	}

	/**
	 * A CommonMark listener: an entry's images get `srcset`, `sizes`, their
	 * dimensions — so the page does not jump as they load — and lazy loading.
	 */
	public function fillMarkdownImages( DocumentParsedEvent $event ): void {
		foreach ( $event->getDocument()->iterator() as $node ) {
			if ( ! $node instanceof Image ) {
				continue;
			}

			foreach ( $this->attributes( $node->getUrl(), $this->config->sizes ) as $name => $value ) {
				$node->data->set( 'attributes/' . $name, $value );
			}
		}
	}

	/**
	 * The attributes an `<img>` of this image should carry beyond src and alt.
	 *
	 * @return array<string, string>
	 */
	public function attributes( string $url, string $sizes, string $loading = 'lazy' ): array {
		$attributes = [];
		$candidates = $this->candidates( $url );

		if ( [] !== $candidates ) {
			$attributes['srcset'] = self::srcset( $candidates );
			$attributes['sizes']  = $sizes;
		}

		$dimensions = $this->dimensions( $url );

		if ( null !== $dimensions ) {
			$attributes['width']  = (string) $dimensions[0];
			$attributes['height'] = (string) $dimensions[1];
		}

		$attributes['loading']  = 'eager' === $loading ? 'eager' : 'lazy';
		$attributes['decoding'] = 'async';

		return $attributes;
	}

	/** @param list<array{width: int, url: string}> $candidates */
	public static function srcset( array $candidates ): string {
		return implode( ', ', array_map( static fn ( array $candidate ): string => $candidate['url'] . ' ' . $candidate['width'] . 'w', $candidates ) );
	}

	/**
	 * Configured widths narrower than the image — and, when copies change
	 * format, its own width too, so the widest candidate is a WebP rather
	 * than the heavier original.
	 *
	 * @return list<int>
	 */
	private function widthsFor( string $path ): array {
		$dimensions = $this->dimensionsOf( $path );

		if ( null === $dimensions ) {
			return [];
		}

		$widths = array_values( array_filter( $this->config->widths, static fn ( int $width ): bool => $width < $dimensions[0] ) );
		$format = $this->config->formatFor( pathinfo( $path, PATHINFO_EXTENSION ) );

		if ( [] !== $widths && $format !== strtolower( str_replace( 'jpeg', 'jpg', pathinfo( $path, PATHINFO_EXTENSION ) ) ) ) {
			$widths[] = $dimensions[0];
		}

		return $widths;
	}

	/** The cached copy at `$width`, made if it is not there yet. */
	private function copy( string $path, int $width ): string {
		$format = $this->config->formatFor( pathinfo( $path, PATHINFO_EXTENSION ) );
		$hash   = substr( md5( md5_file( $path ) . '|' . $width . '|' . $this->config->signature() ), 0, 10 );
		$cached = $this->site->cacheDir() . '/images/' . $hash . '-' . $width . '.' . $format;

		if ( ! is_file( $cached ) ) {
			$this->resizer->resize( $path, $cached, $width, $format, $this->config->quality );
		}

		return $cached;
	}

	/** `uploads/photo.jpg` + a cached copy → `uploads/photo.3f9a1c2b0e-640w.webp`. */
	private static function copyName( string $key, string $cached, int $width ): string {
		$hash      = substr( basename( $cached ), 0, 10 );
		$extension = pathinfo( $cached, PATHINFO_EXTENSION );
		$stem      = substr( $key, 0, -( strlen( pathinfo( $key, PATHINFO_EXTENSION ) ) + 1 ) );

		return $stem . '.' . $hash . '-' . $width . 'w.' . $extension;
	}

	private function source( string $key ): ?string {
		return $this->site->layers()->resolve( 'assets/' . $key );
	}

	/** @return array{0: int, 1: int}|null */
	private function dimensionsOf( string $path ): ?array {
		return $this->dimensions[ $path ] ??= ImageResizer::dimensions( $path );
	}
}
