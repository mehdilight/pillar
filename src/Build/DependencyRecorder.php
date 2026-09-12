<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Build;

use Phpmystic\Pillar\Content\ContentStore;
use Phpmystic\Pillar\Render\LayeredFileSystem;

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

	/** The prefix a collection dependency is recorded under, beside file paths. */
	public const COLLECTION = 'collection:';

	public function __construct( ?ContentStore $content, LayeredFileSystem ...$fileSystems ) {
		foreach ( $fileSystems as $fileSystem ) {
			$fileSystem->listen( function ( string $name, string $path ): void {
				$this->paths[ $path ] = true;
			} );
		}

		$content?->listen( function ( string $collection ): void {
			$this->paths[ self::COLLECTION . $collection ] = true;
		} );
	}

	public function start(): void {
		$this->paths = [];
	}

	/** @return list<string> */
	public function paths(): array {
		return array_keys( $this->paths );
	}

}
