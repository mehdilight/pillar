<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Build;

/**
 * A file's identity, by content.
 *
 * Not by mtime. Modification times have one-second granularity, and the whole
 * point of the dev loop is that a save and a rebuild happen inside the same
 * second — so an mtime check silently serves the previous render, which is the
 * one failure mode an incremental build must not have. Caught live: editing a
 * post and rebuilding immediately skipped every page.
 *
 * Memoized per path for the length of one build: thirty templates read once
 * each, however many of five hundred pages depend on them.
 */
final class FileHash {

	/** @var array<string, string> */
	private static array $memo = [];

	public static function of( string $path ): string {
		return self::$memo[ $path ] ??= is_file( $path ) ? (string) md5_file( $path ) : 'gone';
	}

	/** Called at the start of every build — a long-lived `pillar dev` reuses the process. */
	public static function forget(): void {
		self::$memo = [];
	}
}
