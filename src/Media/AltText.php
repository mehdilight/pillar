<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Media;

use League\CommonMark\Event\DocumentParsedEvent;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\Node\Inline\Text;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Site\Site;

/**
 * An image's alt text, written once in the media library and used wherever
 * the image appears without one of its own.
 *
 * Kept in `config/media.json`, keyed by the image's path under `assets/` —
 * a versioned file like any other, so alt text is reviewed and published with
 * the site. A theme may ship alt text for its own images in the same file;
 * the site's entries win.
 *
 *     { "uploads/team-4f2a9c1b0e.jpg": { "alt": "The team at the 2026 offsite" } }
 *
 * An alt written where the image is used — `![Our team](…)` in markdown, the
 * second argument of `image_tag` — always wins over the library's.
 */
final class AltText {

	public const FILE = 'config/media.json';

	/** @var array<string, array<string, mixed>>|null */
	private ?array $entries = null;

	public function __construct( private readonly Site $site ) {}

	/**
	 * The library key for an image address — its path under `assets/` — or
	 * null for anything that is not a site asset: an external URL, a data URI.
	 */
	public static function key( string $url ): ?string {
		$path = (string) preg_replace( '/[?#].*$/', '', trim( $url ) );

		if ( '' === $path || preg_match( '~^([a-z][a-z0-9+.-]*:|//)~i', $path ) ) {
			return null;
		}

		$path = ltrim( $path, '/' );

		if ( str_starts_with( $path, 'assets/' ) ) {
			return substr( $path, 7 );
		}

		// Any other rooted path is a page or a public file, not the library's.
		return str_starts_with( ltrim( $url ), '/' ) ? null : $path;
	}

	public function for( string $url ): string {
		$key = self::key( $url );

		return null === $key ? '' : (string) ( $this->entries()[ $key ]['alt'] ?? '' );
	}

	/** @return array<string, string> alt text by key, only for images that have one */
	public function all(): array {
		$alts = [];

		foreach ( $this->entries() as $key => $entry ) {
			if ( '' !== (string) ( $entry['alt'] ?? '' ) ) {
				$alts[ $key ] = (string) $entry['alt'];
			}
		}

		return $alts;
	}

	/** Set, or with an empty string clear, an image's alt text in the site's own file. */
	public function set( string $url, string $alt ): void {
		$key = self::key( $url ) ?? throw new PillarException( 'Only images in the media library have alt text here.' );
		$alt = trim( (string) preg_replace( '/\s+/', ' ', $alt ) );

		$own = $this->read( $this->site->absolute( self::FILE ) );

		if ( '' === $alt ) {
			unset( $own[ $key ]['alt'] );

			if ( [] === ( $own[ $key ] ?? null ) ) {
				unset( $own[ $key ] );
			}
		} else {
			$own[ $key ] = [ 'alt' => $alt ] + ( $own[ $key ] ?? [] );
		}

		$this->write( $own );
	}

	/** Drop a deleted image's entry, so the file does not collect orphans. */
	public function forget( string $url ): void {
		$key = self::key( $url );
		$own = $this->read( $this->site->absolute( self::FILE ) );

		if ( null !== $key && isset( $own[ $key ] ) ) {
			unset( $own[ $key ] );
			$this->write( $own );
		}
	}

	/**
	 * A CommonMark listener: `![](/assets/team.jpg)` — an image with no alt of
	 * its own — takes the library's.
	 */
	public function fillMarkdownImages( DocumentParsedEvent $event ): void {
		foreach ( $event->getDocument()->iterator() as $node ) {
			if ( ! $node instanceof Image || null !== $node->firstChild() ) {
				continue;
			}

			$alt = $this->for( $node->getUrl() );

			if ( '' !== $alt ) {
				$node->appendChild( new Text( $alt ) );
			}
		}
	}

	/** @return array<string, array<string, mixed>> */
	private function entries(): array {
		if ( null === $this->entries ) {
			$this->entries = [];

			// Layers come site first, so the site's entry for a key is kept.
			foreach ( $this->site->layers()->all() as $layer ) {
				$this->entries += $this->read( $layer['root'] . '/' . self::FILE );
			}
		}

		return $this->entries;
	}

	/** @return array<string, array<string, mixed>> */
	private function read( string $path ): array {
		if ( ! is_file( $path ) ) {
			return [];
		}

		$data = json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $data ) ) {
			throw new PillarException( self::FILE . ' is not valid JSON.' );
		}

		return array_filter( $data, 'is_array' );
	}

	/** @param array<string, array<string, mixed>> $own */
	private function write( array $own ): void {
		ksort( $own );

		$path = $this->site->absolute( self::FILE );

		@mkdir( dirname( $path ), 0777, true );

		$written = [] === $own
			? ( ! is_file( $path ) || unlink( $path ) )
			: false !== file_put_contents( $path, json_encode( $own, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n" );

		if ( ! $written ) {
			throw new PillarException( 'Could not save the alt text. Check that the site folder is writable.' );
		}

		$this->entries = null;
	}
}
