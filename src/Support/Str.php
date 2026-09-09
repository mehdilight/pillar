<?php
declare( strict_types=1 );

namespace Pillar\Support;

/** The two naming conventions Pillar straddles: PHP's camelCase, templates' snake_case. */
final class Str {

	public static function camel( string $value ): string {
		return lcfirst( str_replace( ' ', '', ucwords( str_replace( [ '-', '_' ], ' ', $value ) ) ) );
	}

	public static function snake( string $value ): string {
		return strtolower( (string) preg_replace( '/(?<!^)[A-Z]/', '_$0', $value ) );
	}

	/** URL-safe, lowercase, hyphenated — what a slug or a handle looks like. */
	public static function slug( string $value ): string {
		$value = (string) preg_replace( '/[^\p{L}\p{N}]+/u', '-', $value );

		return trim( strtolower( $value ), '-' );
	}

	/**
	 * The file-name form of a component name.
	 *
	 * A theme writes `<ProductCard />`; the file is `product-card.liqx`. Casing
	 * conventions vary between themes, so the lookup normalises rather than
	 * insisting on one — matching Liqx's documented resolution behaviour.
	 */
	public static function handle( string $value ): string {
		$value = (string) preg_replace( '/(?<!^)[A-Z]/', '-$0', str_replace( '_', '-', $value ) );

		return strtolower( $value );
	}
}
