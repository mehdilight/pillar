<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Content;

use Symfony\Component\Yaml\Yaml;

/**
 * Writes a markdown file back without rewriting what did not change.
 *
 * Re-dumping frontmatter wholesale restyles it: Symfony's dumper quotes any
 * string containing a space (`title: 'Git is the store'`), quotes dates, and
 * explodes `tags: [design]` into a block list. Every save from the dashboard
 * used to do that to every entry — a diff on lines nobody touched.
 *
 * So the original frontmatter is kept line for line wherever its value is
 * unchanged. Only a key whose value changed is re-written, in place, and a new
 * key is appended. The file keeps the author's formatting for everything the
 * dashboard did not actually edit.
 */
final class FrontmatterWriter {

	/**
	 * @param string               $original    the file as it is on disk, or '' for a new file
	 * @param array<string, mixed> $frontmatter the frontmatter to write
	 */
	public static function write( string $original, array $frontmatter, string $body ): string {
		[ $before ] = '' === $original ? [ [] ] : Frontmatter::split( $original );

		$raw     = self::rawBlocks( $original );
		$written = [];

		foreach ( $raw as $key => $block ) {
			if ( ! array_key_exists( $key, $frontmatter ) ) {
				continue; // removed
			}

			$written[] = self::same( $before[ $key ] ?? null, $frontmatter[ $key ] )
				? $block
				: self::dump( $key, $frontmatter[ $key ] );
		}

		foreach ( $frontmatter as $key => $value ) {
			if ( ! array_key_exists( (string) $key, $raw ) ) {
				$written[] = self::dump( (string) $key, $value );
			}
		}

		$yaml = rtrim( implode( "\n", $written ), "\n" );
		$body = ltrim( $body, "\n" );

		// One trailing newline, as a text file should end — an editor that
		// serialised without one would otherwise put "\ No newline at end of
		// file" in the diff.
		$body = '' === $body ? '' : rtrim( $body, "\n" ) . "\n";

		return "---\n" . ( '' === $yaml ? '' : $yaml . "\n" ) . "---\n" . $body;
	}

	/**
	 * The original frontmatter as raw text per top-level key.
	 *
	 * A top-level key starts at column 0; every following line that does not
	 * (a nested mapping, a list item, a continuation, a blank) belongs to it.
	 *
	 * @return array<string, string>
	 */
	private static function rawBlocks( string $original ): array {
		if ( ! preg_match( '/\A---\R(.*?)\R---\R?/s', preg_replace( '/^\xEF\xBB\xBF/', '', $original ) ?? $original, $matches ) ) {
			return [];
		}

		$blocks  = [];
		$current = null;

		foreach ( preg_split( '/\R/', $matches[1] ) ?: [] as $line ) {
			if ( preg_match( '/^([^\s#][^:]*):(\s|$)/', $line, $key ) ) {
				$current            = trim( $key[1], " '\"" );
				$blocks[ $current ] = $line;

				continue;
			}

			if ( null !== $current ) {
				$blocks[ $current ] .= "\n" . $line;
			}
		}

		return array_map( static fn ( string $block ): string => rtrim( $block ), $blocks );
	}

	/**
	 * Whether a value is unchanged, loosely enough that a YAML round trip does
	 * not count as a change: `7` read back as `"7"` from a form is the same.
	 */
	private static function same( mixed $before, mixed $after ): bool {
		if ( is_array( $before ) || is_array( $after ) ) {
			return json_encode( self::loosen( $before ) ) === json_encode( self::loosen( $after ) );
		}

		if ( is_bool( $before ) || is_bool( $after ) || null === $before || null === $after ) {
			return $before === $after;
		}

		return (string) $before === (string) $after;
	}

	private static function loosen( mixed $value ): mixed {
		if ( is_array( $value ) ) {
			return array_map( self::loosen( ... ), $value );
		}

		return is_int( $value ) || is_float( $value ) ? (string) $value : $value;
	}

	/**
	 * A list of plain values stays on one line — `tags: [design, git]` — and
	 * anything with structure (a group, repeater rows, a table) is written as
	 * indented blocks, which is the only way a person reads it back.
	 */
	private static function dump( string $key, mixed $value ): string {
		$flat = ! is_array( $value ) || [] === array_filter( $value, 'is_array' );

		return rtrim( Yaml::dump( [ $key => $value ], $flat ? 1 : 10, 2, Yaml::DUMP_MULTI_LINE_LITERAL_BLOCK | Yaml::DUMP_COMPACT_NESTED_MAPPING ), "\n" );
	}
}
