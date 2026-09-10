<?php
declare( strict_types=1 );

namespace Pillar\Seo;

/**
 * Yoast's replacement variables, rebuilt: `%%title%% %%sep%% %%sitename%%`
 * resolved against whatever page is rendering.
 *
 * Why this exists rather than per-entity fields alone: a author with four
 * hundred pages will not write four hundred meta titles. They write one
 * pattern. Per-entity overrides then matter for the twenty pages that earn
 * the attention, and the other three hundred and eighty still have correct,
 * distinct titles.
 *
 * Unknown variables resolve to empty rather than being left in the output —
 * `%%nonexistent%%` visible in a `<title>` on a live site is worse
 * than a slightly short title. The collapse pass then tidies the separators
 * and doubled spaces that emptying a variable leaves behind, which is the
 * whole reason `%%sep%%` is a variable rather than a literal.
 */
final class Replacements {

	/** @var array<string, string> */
	private array $values;

	/** @param array<string,string> $values */
	public function __construct( array $values = [] ) {
		$this->values = $values;
	}

	public function with( string $name, ?string $value ): self {
		$clone = clone $this;

		$clone->values[ $name ] = (string) ( $value ?? '' );

		return $clone;
	}

	/** @param array<string,?string> $values */
	public function withAll( array $values ): self {
		$clone = clone $this;

		foreach ( $values as $name => $value ) {
			$clone->values[ $name ] = (string) ( $value ?? '' );
		}

		return $clone;
	}

	/** The variable names available on this page, for the editor's help text. */
	public function available(): array {
		$names = array_keys( $this->values );
		sort( $names );

		return $names;
	}

	public function apply( string $template ): string {
		if ( '' === trim( $template ) ) {
			return '';
		}

		$resolved = preg_replace_callback(
			'/%%([a-z0-9_]+)%%/i',
			fn ( array $m ): string => $this->values[ strtolower( $m[1] ) ] ?? '',
			$template
		);

		return self::collapse( (string) $resolved );
	}

	/**
	 * Tidies what emptying a variable leaves: a separator with nothing on
	 * one side of it, doubled spaces, a trailing dash. Without this a
	 * page with no vendor renders "Serum ·  · Shop".
	 *
	 * Separators are recognised by character rather than by knowing which
	 * one `%%sep%%` produced, so a template with a literal `|` in it is
	 * cleaned up the same way.
	 */
	public static function collapse( string $value ): string {
		// `#` delimiters, because the class itself contains `/` — with `/`
		// delimiters that character ends the pattern and every one of these
		// silently becomes a warning instead of a replacement.
		$separators = '\\|\\-–—·•~»<>/';

		// Collapse runs of whitespace first so the separator patterns below
		// only ever have to consider single spaces.
		$value = (string) preg_replace( '#\s+#u', ' ', $value );

		// A separator with nothing before it, or nothing after it.
		$value = (string) preg_replace( '#^\s*[' . $separators . ']\s*#u', '', $value );
		$value = (string) preg_replace( '#\s*[' . $separators . ']\s*$#u', '', $value );

		// Two separators with only space between them.
		$value = (string) preg_replace( '#\s*([' . $separators . '])\s*(?:[' . $separators . ']\s*)+#u', ' $1 ', $value );

		return trim( $value );
	}

	/**
	 * Truncates on a word boundary, appending an ellipsis only when
	 * something was actually cut.
	 *
	 * Meta descriptions are truncated by the search engine anyway; doing it
	 * here means the author sees in the preview what a searcher will see,
	 * rather than discovering it in the SERP.
	 */
	public static function truncate( string $value, int $limit ): string {
		$value = trim( (string) preg_replace( '#\s+#u', ' ', strip_tags( $value ) ) );

		if ( mb_strlen( $value ) <= $limit ) {
			return $value;
		}

		$cut   = mb_substr( $value, 0, $limit - 1 );
		$space = mb_strrpos( $cut, ' ' );

		// A single word longer than the limit has no boundary to break on —
		// a hard cut is the only option left.
		if ( false !== $space && $space > (int) ( $limit * 0.6 ) ) {
			$cut = mb_substr( $cut, 0, $space );
		}

		return rtrim( $cut, " \t\n\r\0\x0B.,;:-" ) . '…';
	}
}
