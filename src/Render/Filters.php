<?php
declare( strict_types=1 );

namespace Pillar\Render;

use League\CommonMark\CommonMarkConverter;
use Pillar\Site\Site;

/**
 * The filters a static site needs that Liqx does not ship.
 *
 * Liqx already provides some sixty — `date`, `slugify`, `truncatewords`,
 * `strip_html`, `where`, `sort`, `money` — so this is only the gap: markdown,
 * URLs, and assets.
 */
final class Filters {

	public function __construct(
		private readonly Site $site,
		private readonly CommonMarkConverter $markdown,
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
			'image_tag'    => fn ( mixed $value, mixed $alt = '', mixed $class = '' ): string => $this->imageTag( $value, $alt, $class ),
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

	private function imageUrl( mixed $value, mixed $width ): string {
		$url = is_object( $value ) && method_exists( $value, 'beforeMethod' )
			? (string) $value->beforeMethod( 'url' )
			: (string) $value;

		if ( '' === $url ) {
			return '';
		}

		$url = str_starts_with( $url, 'http' ) || str_starts_with( $url, '/' ) ? $url : $this->assetUrl( $url );

		return null === $width || '' === $width ? $url : $url . '?w=' . (int) $width;
	}

	private function imageTag( mixed $value, mixed $alt, mixed $class ): string {
		$url = $this->imageUrl( $value, null );

		if ( '' === $url ) {
			return '';
		}

		return sprintf(
			'<img src="%s" alt="%s"%s>',
			htmlspecialchars( $url, ENT_QUOTES ),
			htmlspecialchars( (string) $alt, ENT_QUOTES ),
			'' === (string) $class ? '' : sprintf( ' class="%s"', htmlspecialchars( (string) $class, ENT_QUOTES ) )
		);
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
