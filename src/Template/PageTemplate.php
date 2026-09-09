<?php
declare( strict_types=1 );

namespace Pillar\Template;

use Pillar\PillarException;

/**
 * `templates/<name>.json` — the author's composition of a page.
 *
 * Editor-owned: the dashboard writes this file, never the `.liqx` sources. It
 * is deliberately the same shape the editor's `PageSection` type uses, so the
 * API is a passthrough rather than a translation layer.
 */
final class PageTemplate {

	/** @param list<SectionInstance> $sections */
	private function __construct(
		public readonly string $name,
		public readonly array $sections,
	) {}

	public static function fromArray( string $name, array $raw ): self {
		$sections = [];

		foreach ( (array) ( $raw['sections'] ?? [] ) as $key => $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}

			$sections[] = SectionInstance::fromArray( is_string( $key ) ? $key : (string) ( $entry['section_id'] ?? '' ), $entry );
		}

		// `order` is the editor's own ordering key; an explicit `order` list in
		// the JSON wins over it, matching Shopify-shaped template files.
		$order = array_values( array_map( 'strval', (array) ( $raw['order'] ?? [] ) ) );

		if ( [] !== $order ) {
			usort(
				$sections,
				static function ( SectionInstance $a, SectionInstance $b ) use ( $order ): int {
					$indexA = array_search( $a->id, $order, true );
					$indexB = array_search( $b->id, $order, true );

					return ( false === $indexA ? PHP_INT_MAX : $indexA ) <=> ( false === $indexB ? PHP_INT_MAX : $indexB );
				}
			);
		} else {
			usort( $sections, static fn ( SectionInstance $a, SectionInstance $b ): int => $a->order <=> $b->order );
		}

		return new self( $name, $sections );
	}

	public static function fromFile( string $path, string $name ): self {
		$raw = json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $raw ) ) {
			throw new PillarException( sprintf( '%s is not valid JSON.', $path ) );
		}

		return self::fromArray( $name, $raw );
	}

	/** @return list<SectionInstance> */
	public function enabledSections(): array {
		return array_values( array_filter( $this->sections, static fn ( SectionInstance $s ): bool => $s->enabled ) );
	}
}
