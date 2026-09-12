<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Site;

use Phpmystic\Pillar\PillarException;

/**
 * The lookup cascade: the site's own files, then theme addons in the order
 * `site.json` declares them, then the theme.
 *
 * The site can override anything without forking; an addon can ship a section
 * a theme never had; the theme is a normal layer rather than a special case.
 *
 * Order is *declared*, never discovered. Resolution that depended on directory
 * iteration or install sequence would make an override that silently does
 * nothing impossible to explain.
 */
final class Layers {

	/** @param list<array{name: string, root: string}> $layers highest precedence first */
	private function __construct( private readonly array $layers ) {}

	/**
	 * @param list<array{name: string, root: string}> $layers
	 */
	public static function of( array $layers ): self {
		return new self( $layers );
	}

	/** @return list<array{name: string, root: string}> */
	public function all(): array {
		return $this->layers;
	}

	/**
	 * Every layer offering a file, highest precedence first. The first entry is
	 * the winner; the rest are what `pillar check --why` prints so an override
	 * that does nothing is answerable.
	 *
	 * @return list<array{layer: string, path: string}>
	 */
	public function candidates( string $relative ): array {
		$relative = PathPolicy::normalise( $relative );
		$found    = [];

		foreach ( $this->layers as $layer ) {
			$path = $layer['root'] . '/' . $relative;

			if ( is_file( $path ) ) {
				$found[] = [ 'layer' => $layer['name'], 'path' => $path ];
			}
		}

		return $found;
	}

	/** The winning absolute path, or null when no layer offers the file. */
	public function resolve( string $relative ): ?string {
		return $this->candidates( $relative )[0]['path'] ?? null;
	}

	/** @throws PillarException when nothing offers the file */
	public function read( string $relative ): string {
		$path = $this->resolve( $relative );

		if ( null === $path ) {
			throw new PillarException( sprintf( '%s not found in any layer', $relative ) );
		}

		$source = file_get_contents( $path );

		if ( false === $source ) {
			throw new PillarException( sprintf( 'Could not read %s', $path ) );
		}

		return $source;
	}

	/**
	 * Every file in a folder across all layers, keyed by name without its
	 * extension — a higher layer's file shadowing a lower one's, as `resolve()`
	 * would. This is what "every section this site has" means.
	 *
	 * **Keys are not always strings.** PHP coerces a numeric-string array key
	 * to an integer, so `templates/404.json` comes back keyed `404` as an int.
	 * Callers that pass a key on as a name must cast it — a `404` template is
	 * an ordinary thing for a site to have, and it crashed everything that
	 * assumed otherwise.
	 *
	 * @return array<array-key, string> name => absolute path
	 */
	public function listing( string $folder, string $extension = 'liqx' ): array {
		$found = [];

		// Walked lowest-precedence first so a higher layer overwrites the entry.
		foreach ( array_reverse( $this->layers ) as $layer ) {
			foreach ( glob( $layer['root'] . '/' . $folder . '/*.' . $extension ) ?: [] as $path ) {
				$found[ basename( $path, '.' . $extension ) ] = $path;
			}
		}

		ksort( $found );

		return $found;
	}
}
