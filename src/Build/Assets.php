<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Build;

use Phpmystic\Pillar\Site\PathPolicy;
use Phpmystic\Pillar\Site\Site;

/**
 * Copies `assets/` from every layer into `dist/assets/`, content-hashing each
 * file so `asset_url` can hand out a URL that changes when the file does and
 * never otherwise.
 *
 * Each file is also written under its own name. A template goes through
 * `asset_url` and gets the hashed file, but markdown cannot: an image inserted
 * into an entry is `![](/assets/uploads/photo.png)`, and with only the hashed
 * copy written, every such image was a broken link on the built site while
 * working fine in the preview.
 *
 * Lower layers are copied first, so the site's own asset shadows an addon's of
 * the same name — the same precedence templates get.
 */
final class Assets {

	public function __construct( private readonly Site $site ) {}

	/** @return array<string, string> original name => hashed name */
	public function copy( string $outputDir ): array {
		$hashes = [];
		$target = $outputDir . '/assets';

		@mkdir( $target, 0777, true );

		foreach ( array_reverse( $this->site->layers()->all() ) as $layer ) {
			$root = $layer['root'] . '/assets';

			if ( ! is_dir( $root ) ) {
				continue;
			}

			$files = new \RecursiveIteratorIterator(
				new \RecursiveDirectoryIterator( $root, \FilesystemIterator::SKIP_DOTS )
			);

			foreach ( $files as $file ) {
				/** @var \SplFileInfo $file */
				if ( ! $file->isFile() || ! PathPolicy::allowsExtension( $file->getFilename() ) ) {
					continue;
				}

				$relative = substr( $file->getPathname(), strlen( $root ) + 1 );
				$hashed   = $this->hashedName( $relative, (string) file_get_contents( $file->getPathname() ) );

				@mkdir( dirname( $target . '/' . $hashed ), 0777, true );
				copy( $file->getPathname(), $target . '/' . $hashed );
				copy( $file->getPathname(), $target . '/' . $relative );

				$hashes[ $relative ] = $hashed;
			}
		}

		return $hashes;
	}

	private function hashedName( string $relative, string $contents ): string {
		$hash      = substr( md5( $contents ), 0, 8 );
		$extension = pathinfo( $relative, PATHINFO_EXTENSION );
		$stem      = '' === $extension ? $relative : substr( $relative, 0, -( strlen( $extension ) + 1 ) );

		return '' === $extension ? $stem . '.' . $hash : $stem . '.' . $hash . '.' . $extension;
	}
}
