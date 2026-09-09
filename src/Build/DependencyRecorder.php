<?php
declare( strict_types=1 );

namespace Pillar\Build;

use Pillar\Render\LayeredFileSystem;

/**
 * Every template a page actually pulled in.
 *
 * Hooked onto the file system rather than asked of the renderer, so a snippet
 * reached through three levels of component nesting is recorded the same way a
 * top-level section is, and no caller has to remember to.
 */
final class DependencyRecorder {

	/** @var array<string, true> */
	private array $paths = [];

	public function __construct( LayeredFileSystem ...$fileSystems ) {
		foreach ( $fileSystems as $fileSystem ) {
			$fileSystem->listen( function ( string $name, string $path ): void {
				$this->paths[ $path ] = true;
			} );
		}
	}

	public function start(): void {
		$this->paths = [];
	}

	/** @return list<string> */
	public function paths(): array {
		return array_keys( $this->paths );
	}

	/** A hash of everything read, so a changed dependency changes the page's hash. */
	public function hash(): string {
		$parts = [];

		foreach ( $this->paths() as $path ) {
			$parts[] = $path . ':' . FileHash::of( $path );
		}

		sort( $parts );

		return md5( implode( '|', $parts ) );
	}
}
