<?php
declare( strict_types=1 );

namespace Pillar\Seo\Head;

/**
 * One URL normalisation, shared by the meta tags, the social cards, the graph
 * and the sitemap — so none of them can emit a canonical the others disagree
 * with.
 */
final class CanonicalUrl {

	/**
	 * A page's canonical: the author's override when it is a usable URL, else
	 * the page's own path on the site's base. Query strings and fragments are
	 * dropped — `?utm_source=` is not a different page.
	 */
	public static function resolve( string $base, string $url, ?string $override = null ): string {
		if ( null !== $override && '' !== trim( $override ) ) {
			$safe = self::absolute( $base, $override );

			if ( '' !== $safe ) {
				return explode( '#', $safe, 2 )[0];
			}
		}

		$path = (string) ( parse_url( $url, PHP_URL_PATH ) ?: '/' );

		return self::absolute( $base, $path );
	}

	/**
	 * An absolute http(s) URL, or `''` when there is no honest one.
	 *
	 * Empty rather than relative: a relative canonical is worse than none, and
	 * a site with no `base_url` has nothing absolute to offer. Anything that is
	 * not plainly http(s) — `javascript:`, a protocol-relative `//`, embedded
	 * credentials, control characters — is refused, because this value lands in
	 * attributes and in a graph crawlers follow.
	 */
	public static function absolute( string $base, string $url ): string {
		$url = trim( $url );

		if ( '' === $url || preg_match( '/[\x00-\x20\\\\]/', $url ) || str_starts_with( $url, '//' ) ) {
			return '';
		}

		$scheme = parse_url( $url, PHP_URL_SCHEME );

		if ( null !== $scheme && ! in_array( strtolower( (string) $scheme ), [ 'http', 'https' ], true ) ) {
			return '';
		}

		$absolute = null !== $scheme ? $url : rtrim( $base, '/' ) . '/' . ltrim( $url, '/' );
		$parts    = parse_url( $absolute );

		$usable = is_array( $parts )
			&& isset( $parts['host'], $parts['scheme'] )
			&& ! isset( $parts['user'] )
			&& in_array( strtolower( $parts['scheme'] ), [ 'http', 'https' ], true );

		return $usable ? $absolute : '';
	}
}
