<?php
declare( strict_types=1 );

namespace Pillar\Render;

use Phpmystic\Liqx\FileSystem;
use Phpmystic\Liqx\FileSystemException;
use Pillar\Site\Layers;
use Pillar\Support\Str;

/**
 * How Liqx resolves a bare name to source, across Pillar's layer cascade.
 *
 * Liqx's own `LocalFileSystem` cannot be used: it rejects any name containing
 * a slash and knows one directory. Pillar needs one file system per folder
 * (`sections`, `snippets`, `blocks`) resolving through site → addons → theme.
 *
 * Names are normalised the way Liqx documents: `<ProductCard />`,
 * `render('product_card')` and `product-card.liqx` are the same component, so
 * a theme's naming convention is its own business.
 */
final class LayeredFileSystem implements FileSystem {

	/** @var list<callable(string, string): void> */
	private array $listeners = [];

	public function __construct(
		private readonly Layers $layers,
		/** The folder this file system serves: `sections`, `snippets`, `blocks`. */
		private readonly string $folder,
		/** Also look here when the folder has no match — snippets falling back to blocks. */
		private readonly ?string $fallbackFolder = null,
	) {}

	/**
	 * Called with (name, absolute path) on every successful load.
	 *
	 * This is the seam the build's dependency recorder hooks: every template a
	 * page actually pulled in is a dependency of that page, and recording it
	 * here means no caller has to remember to.
	 *
	 * @param callable(string, string): void $listener
	 */
	public function listen( callable $listener ): void {
		$this->listeners[] = $listener;
	}

	public function load( string $name ): string {
		$candidates = $this->candidates( $name );

		foreach ( $candidates as $relative ) {
			$path = $this->layers->resolve( $relative );

			if ( null !== $path ) {
				foreach ( $this->listeners as $listener ) {
					$listener( $name, $path );
				}

				$source = file_get_contents( $path );

				if ( false === $source ) {
					throw new FileSystemException( sprintf( 'Could not read %s', $path ) );
				}

				return $source;
			}
		}

		throw new FileSystemException(
			sprintf( '%s "%s" not found (looked for %s)', rtrim( $this->folder, 's' ), $name, implode( ', ', $candidates ) )
		);
	}

	public function has( string $name ): bool {
		foreach ( $this->candidates( $name ) as $relative ) {
			if ( null !== $this->layers->resolve( $relative ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * The relative paths a name could mean, in the order they are tried.
	 *
	 * @return list<string>
	 */
	private function candidates( string $name ): array {
		$handle = Str::handle( basename( $name ) );
		$folders = array_filter( [ $this->folder, $this->fallbackFolder ] );
		$out     = [];

		foreach ( $folders as $folder ) {
			$out[] = $folder . '/' . $handle . '.liqx';

			// A theme that names files `product_card.liqx` resolves too.
			if ( str_contains( $handle, '-' ) ) {
				$out[] = $folder . '/' . str_replace( '-', '_', $handle ) . '.liqx';
			}
		}

		return array_values( array_unique( $out ) );
	}
}
