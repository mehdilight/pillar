<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Support;

/**
 * JSON written the way a person writes a schema file: two-space indent, a
 * list of objects one per line, and each object on a single line when it
 * fits —
 *
 *     {
 *       "label": "Posts",
 *       "fields": [
 *         { "id": "title", "type": "text", "label": "Title" },
 *         { "id": "date", "type": "date", "label": "Date" }
 *       ]
 *     }
 *
 * — rather than PHP's pretty print, which spreads every key over its own line
 * and turns adding one field into a diff of the whole file.
 */
final class CompactJson {

	private const FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;

	public static function encode( mixed $value, int $width = 100 ): string {
		return self::block( $value, '', $width ) . "\n";
	}

	private static function block( mixed $value, string $indent, int $width ): string {
		if ( ! is_array( $value ) || [] === $value ) {
			return self::inline( $value );
		}

		$inline = self::inline( $value );

		// The top level always opens up; below it, anything that fits and
		// holds no list of objects stays on one line.
		if ( '' !== $indent && ! self::holdsObjectList( $value ) && strlen( $indent ) + strlen( $inline ) <= $width ) {
			return $inline;
		}

		$inner = $indent . '  ';
		$lines = [];

		foreach ( $value as $key => $item ) {
			$lines[] = $inner . ( array_is_list( $value ) ? '' : json_encode( (string) $key, self::FLAGS ) . ': ' ) . self::block( $item, $inner, $width );
		}

		[ $open, $close ] = array_is_list( $value ) ? [ '[', ']' ] : [ '{', '}' ];

		return $open . "\n" . implode( ",\n", $lines ) . "\n" . $indent . $close;
	}

	private static function inline( mixed $value ): string {
		if ( ! is_array( $value ) ) {
			return json_encode( $value, self::FLAGS );
		}

		if ( [] === $value ) {
			return '[]';
		}

		if ( array_is_list( $value ) ) {
			return '[ ' . implode( ', ', array_map( self::inline( ... ), $value ) ) . ' ]';
		}

		$pairs = [];

		foreach ( $value as $key => $item ) {
			$pairs[] = json_encode( (string) $key, self::FLAGS ) . ': ' . self::inline( $item );
		}

		return '{ ' . implode( ', ', $pairs ) . ' }';
	}

	/** A list of objects — a schema's fields — is always one object per line. */
	private static function holdsObjectList( array $value ): bool {
		if ( array_is_list( $value ) && [] !== array_filter( $value, static fn ( mixed $item ): bool => is_array( $item ) && [] !== $item && ! array_is_list( $item ) ) ) {
			return true;
		}

		foreach ( $value as $item ) {
			if ( is_array( $item ) && self::holdsObjectList( $item ) ) {
				return true;
			}
		}

		return false;
	}
}
