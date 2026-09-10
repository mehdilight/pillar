<?php
declare( strict_types=1 );

namespace Pillar\Site;

use Pillar\PillarException;

/**
 * What a site, a theme or an addon is allowed to contain.
 *
 * Allowlisted, never blocklisted — a new dangerous extension should be
 * excluded by default rather than by remembering to add it. `.php` is the
 * point: a theme addon is inert data, and stays inert because nothing outside
 * this list can be read or served.
 */
final class PathPolicy {

	public const FOLDERS = [
		'assets',
		'blocks',
		'config',
		'layout',
		'locales',
		'schemas',
		'sections',
		'snippets',
		'templates',
		'content',
		'data',
	];

	public const EXTENSIONS = [
		'liqx',
		'json',
		'md',
		'yaml',
		'yml',
		'css',
		'js',
		'map',
		'txt',
		'png',
		'jpg',
		'jpeg',
		'gif',
		'webp',
		'avif',
		'svg',
		'ico',
		'woff',
		'woff2',
		'ttf',
		'otf',
	];

	/** Files a site may keep at its root, beside the allowed folders. */
	public const ROOT_FILES = [ 'site.json', 'theme.json', 'addon.yaml', 'readme.md', 'license.md' ];

	public static function allowsExtension( string $path ): bool {
		return in_array( strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), self::EXTENSIONS, true );
	}

	public static function allowsFolder( string $folder ): bool {
		return in_array( $folder, self::FOLDERS, true );
	}

	/**
	 * A relative path that cannot escape its layer.
	 *
	 * Rejects absolute paths, `..` segments, and anything whose first segment
	 * is not an allowed folder. Returns the normalised path.
	 *
	 * @throws PillarException
	 */
	public static function normalise( string $path ): string {
		$path = str_replace( '\\', '/', trim( $path ) );

		if ( '' === $path || str_starts_with( $path, '/' ) || preg_match( '#(^|/)\.\.(/|$)#', $path ) ) {
			throw new PillarException( sprintf( 'Unsafe path: %s', $path ) );
		}

		$segments = array_values( array_filter( explode( '/', $path ), static fn ( string $s ): bool => '' !== $s && '.' !== $s ) );

		if ( [] === $segments ) {
			throw new PillarException( sprintf( 'Unsafe path: %s', $path ) );
		}

		if ( ! self::allowsFolder( $segments[0] ) ) {
			throw new PillarException( sprintf( 'Path is outside the allowed folders: %s', $path ) );
		}

		if ( ! self::allowsExtension( $path ) ) {
			throw new PillarException( sprintf( 'Disallowed file extension: %s', $path ) );
		}

		return implode( '/', $segments );
	}
}
