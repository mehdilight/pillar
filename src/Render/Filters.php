<?php
declare( strict_types=1 );

namespace Pillar\Render;

use League\CommonMark\CommonMarkConverter;
use Pillar\Media\AltText;
use Pillar\Media\Images;
use Pillar\Site\Site;

/**
 * The filters a static site needs that Liqx does not ship.
 *
 * Liqx already provides some sixty — `date`, `slugify`, `truncatewords`,
 * `strip_html`, `where`, `sort`, `money` — so this is only the gap: markdown,
 * URLs, assets, and images at the size a page needs (see `Media\Images`).
 */
final class Filters {

	public function __construct(
		private readonly Site $site,
		private readonly CommonMarkConverter $markdown,
		private readonly AltText $alt,
		private readonly Images $images,
		/** Content hashes for built assets, filled by the asset pipeline. */
		private array $assetHashes = [],
	) {}

	/** @param array<string, string> $hashes */
	public function setAssetHashes( array $hashes ): void {
		$this->assetHashes = $hashes;
	}

	/** @return array<string, callable> */
	public function all(): array {
		return [
			'markdownify'  => fn ( mixed $value ): string => $this->markdown->convert( (string) $value )->getContent(),
			'asset_url'    => fn ( mixed $value ): string => $this->assetUrl( (string) $value ),
			'image_url'    => fn ( mixed $value, mixed $width = null ): string => $this->imageUrl( $value, $width ),
			'image_tag'    => fn ( mixed $value, mixed $alt = '', mixed $class = '', mixed $sizes = '', mixed $loading = 'lazy' ): string => $this->imageTag( $value, $alt, $class, $sizes, $loading ),
			'image_srcset' => fn ( mixed $value ): string => Images::srcset( $this->images->candidates( self::source( $value ) ) ),
			'image_alt'    => fn ( mixed $value ): string => $this->alt->for( self::source( $value ) ),
			'video_tag'    => fn ( mixed $value, mixed $title = '', mixed $class = '' ): string => $this->videoTag( self::source( $value ), (string) $title, (string) $class ),
			'absolute_url' => fn ( mixed $value ): string => $this->absoluteUrl( (string) $value ),
			'excerpt'      => fn ( mixed $value, mixed $length = 200 ): string => $this->excerpt( (string) $value, (int) $length ),
			't'            => static fn ( mixed $value ): string => (string) $value,
		];
	}

	/**
	 * `{'base.css' | asset_url}` → `/assets/base.a1b2c3.css`.
	 *
	 * The hash is content-derived and injected by the build, so a changed file
	 * gets a new URL and an unchanged one keeps its cache. Before the asset
	 * pipeline has run — in the dev preview — the plain path is correct.
	 */
	public function assetUrl( string $file ): string {
		$file = ltrim( $file, '/' );
		$file = str_starts_with( $file, 'assets/' ) ? substr( $file, 7 ) : $file;

		return '/assets/' . ( $this->assetHashes[ $file ] ?? $file );
	}

	/** An image value as stored: a path or URL, or a drop that knows its `url`. */
	private static function source( mixed $value ): string {
		return is_object( $value ) && method_exists( $value, 'beforeMethod' )
			? (string) $value->beforeMethod( 'url' )
			: (string) $value;
	}

	/**
	 * `{image | image_url(640)}` → the resized copy at least 640px wide, or
	 * the original when there is none (an SVG, a small image, no GD).
	 */
	private function imageUrl( mixed $value, mixed $width ): string {
		$url = self::source( $value );

		if ( '' === $url ) {
			return '';
		}

		$resized = null === $width || '' === $width ? null : $this->images->url( $url, (int) $width );

		if ( null !== $resized ) {
			return $resized;
		}

		return str_starts_with( $url, '/assets/' ) || str_starts_with( $url, 'assets/' ) || ( ! str_starts_with( $url, 'http' ) && ! str_starts_with( $url, '/' ) ) ? $this->assetUrl( $url ) : $url;
	}

	/**
	 * `{image | image_tag(alt, class, sizes, loading)}` — every argument optional.
	 *
	 * The browser gets every resized copy in `srcset` and picks by `sizes`
	 * (the full viewport unless the theme says how wide the image is shown),
	 * plus the original's width and height so the page does not jump as it
	 * loads. `alt` falls back to the media library's, so an image described
	 * once is described everywhere. Lazy unless `loading` is `eager` — which
	 * an image at the top of the page should be.
	 */
	private function imageTag( mixed $value, mixed $alt, mixed $class, mixed $sizes, mixed $loading ): string {
		$url = $this->imageUrl( $value, null );

		if ( '' === $url ) {
			return '';
		}

		$source     = self::source( $value );
		$attributes = [ 'src' => $url, 'alt' => '' === (string) $alt ? $this->alt->for( $source ) : (string) $alt ];

		if ( '' !== (string) $class ) {
			$attributes['class'] = (string) $class;
		}

		$attributes += $this->images->attributes( $source, '' === (string) $sizes ? '100vw' : (string) $sizes, (string) $loading );

		$html = '<img';

		foreach ( $attributes as $name => $attribute ) {
			$html .= sprintf( ' %s="%s"', $name, htmlspecialchars( $attribute, ENT_QUOTES ) );
		}

		return $html . '>';
	}

	/**
	 * `{video | video_tag('Launch', 'hero-video')}` — a player for whatever a
	 * `video` field holds: YouTube and Vimeo links as embeds (YouTube through
	 * its no-cookie domain), a file as a `<video>` that loads only its
	 * metadata until played.
	 */
	private function videoTag( string $url, string $title, string $class ): string {
		if ( '' === trim( $url ) ) {
			return '';
		}

		$attributes = '' === $class ? '' : sprintf( ' class="%s"', htmlspecialchars( $class, ENT_QUOTES ) );
		$label      = htmlspecialchars( '' === $title ? 'Video' : $title, ENT_QUOTES );

		if ( 1 === preg_match( '~(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/)|youtu\.be/)([\w-]{11})~', $url, $youtube ) ) {
			$embed = 'https://www.youtube-nocookie.com/embed/' . $youtube[1];
		} elseif ( 1 === preg_match( '~vimeo\.com/(?:video/)?(\d+)~', $url, $vimeo ) ) {
			$embed = 'https://player.vimeo.com/video/' . $vimeo[1];
		}

		if ( isset( $embed ) ) {
			return sprintf(
				'<iframe src="%s" title="%s" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen%s></iframe>',
				htmlspecialchars( $embed, ENT_QUOTES ),
				$label,
				$attributes
			);
		}

		$source = str_starts_with( $url, 'http' ) ? $url : $this->assetUrl( $url );

		return sprintf( '<video src="%s" controls preload="metadata" playsinline aria-label="%s"%s></video>', htmlspecialchars( $source, ENT_QUOTES ), $label, $attributes );
	}

	private function absoluteUrl( string $path ): string {
		if ( str_starts_with( $path, 'http://' ) || str_starts_with( $path, 'https://' ) ) {
			return $path;
		}

		return $this->site->baseUrl . '/' . ltrim( $path, '/' );
	}

	private function excerpt( string $html, int $length ): string {
		$text = trim( (string) preg_replace( '/\s+/', ' ', strip_tags( $html ) ) );

		return mb_strlen( $text ) > $length ? mb_substr( $text, 0, $length ) . '…' : $text;
	}
}
