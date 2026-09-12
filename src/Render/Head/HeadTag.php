<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render\Head;

/**
 * One element a contributor wants in `<head>`, as data rather than markup.
 *
 * Contributors return these instead of strings for two reasons. Escaping
 * happens once, here, rather than in every plugin that ever emits a meta tag —
 * a title with a quote in it must not be able to break out of an attribute.
 * And a tag carries a `key`, which is what lets `HeadRegistry` notice that two
 * plugins both want to be the canonical URL and keep only the one that won.
 *
 * Ported from bastet, where this shape was already right.
 */
final class HeadTag {

	public const TITLE = 'title';
	public const META  = 'meta';
	public const LINK  = 'link';
	public const JSON  = 'json-ld';
	public const RAW   = 'raw';

	/** @param array<string, string> $attributes */
	private function __construct(
		public readonly string $type,
		public readonly string $key,
		public readonly array $attributes = [],
		public readonly string $content = '',
	) {}

	public static function title( string $title ): self {
		return new self( self::TITLE, 'title', [], $title );
	}

	/** `<meta name="description" content="…">` — the `name` form. */
	public static function meta( string $name, string $content ): self {
		return new self( self::META, 'meta:name:' . $name, [ 'name' => $name, 'content' => $content ] );
	}

	/** `<meta property="og:title" content="…">` — the Open Graph form. */
	public static function property( string $property, string $content ): self {
		return new self( self::META, 'meta:property:' . $property, [ 'property' => $property, 'content' => $content ] );
	}

	/**
	 * `<link rel="canonical" href="…">`.
	 *
	 * Keyed by rel *and* href for the repeatable relations, so a page can carry
	 * many `alternate` links (feeds, hreflang) while still having exactly one
	 * canonical — `alternate` is the relation where repeats are the point
	 * rather than a mistake.
	 *
	 * @param array<string, string> $extra e.g. `[ 'hreflang' => 'fr' ]`
	 */
	public static function link( string $rel, string $href, array $extra = [] ): self {
		$repeatable = in_array( $rel, [ 'alternate', 'preload', 'preconnect', 'dns-prefetch' ], true );

		return new self(
			self::LINK,
			'link:' . $rel . ( $repeatable ? ':' . $href . ':' . implode( ',', $extra ) : '' ),
			[ 'rel' => $rel, 'href' => $href ] + $extra
		);
	}

	/**
	 * `<script type="application/ld+json">`.
	 *
	 * Encoded here rather than taken pre-encoded so it cannot carry
	 * `</script>`; the key distinguishes the graph nodes a page emits.
	 *
	 * @param array<string, mixed> $data
	 */
	public static function jsonLd( string $key, array $data ): self {
		return new self( self::JSON, 'json-ld:' . $key, [], (string) json_encode(
			$data,
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP
		) );
	}

	/**
	 * Markup passed through untouched. The caller owns its safety — this is for
	 * a snippet the site owner pasted into a settings field, trusted the same
	 * way anything else in their own repository is.
	 */
	public static function raw( string $key, string $markup ): self {
		return new self( self::RAW, 'raw:' . $key, [], $markup );
	}

	public function render(): string {
		return match ( $this->type ) {
			self::TITLE => '<title>' . $this->escape( $this->content ) . '</title>',
			self::META, self::LINK => sprintf( '<%s%s>', $this->type, $this->attributeString() ),
			self::JSON => '<script type="application/ld+json">' . $this->content . '</script>',
			default => $this->content,
		};
	}

	private function attributeString(): string {
		$out = '';

		foreach ( $this->attributes as $name => $value ) {
			// A name that is not a plain attribute name is dropped rather than
			// escaped — no legitimate tag needs one.
			if ( 1 !== preg_match( '/^[a-zA-Z][a-zA-Z0-9:_.-]*$/', $name ) ) {
				continue;
			}

			$out .= sprintf( ' %s="%s"', $name, $this->escape( $value ) );
		}

		return $out;
	}

	private function escape( string $value ): string {
		return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
	}
}
