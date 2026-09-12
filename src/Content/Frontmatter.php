<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Content;

use Phpmystic\Pillar\PillarException;
use Symfony\Component\Yaml\Exception\ParseException;
use Symfony\Component\Yaml\Yaml;

/** Splits a markdown file into its YAML frontmatter and its body. */
final class Frontmatter {

	/**
	 * @return array{0: array<string, mixed>, 1: string}
	 *
	 * @throws PillarException on malformed YAML — a silent empty frontmatter
	 *         would render a page with no title and no explanation.
	 */
	public static function split( string $source, string $origin = '' ): array {
		$source = preg_replace( '/^\xEF\xBB\xBF/', '', $source ) ?? $source;

		if ( ! preg_match( '/\A---\R(.*?)\R---\R?(.*)\z/s', $source, $matches ) ) {
			return [ [], $source ];
		}

		try {
			// PARSE_DATETIME, then normalised back to a string below. Without
			// it Symfony turns `date: 2026-08-01` into a unix timestamp, and a
			// theme printing `{post.date}` renders 1785542400.
			$parsed = Yaml::parse( $matches[1], Yaml::PARSE_DATETIME );
		} catch ( ParseException $error ) {
			throw new PillarException(
				sprintf( 'Invalid frontmatter in %s: %s', $origin ?: 'markdown', $error->getMessage() ),
				0,
				$error
			);
		}

		return [ is_array( $parsed ) ? self::normalise( $parsed ) : [], $matches[2] ];
	}

	/**
	 * Dates come back as strings, in the form they were written.
	 *
	 * YAML dates parse to `DateTimeImmutable`, which a template cannot print
	 * and Liqx's `date` filter does not expect. A bare `2026-08-01` stays
	 * `2026-08-01`; one carrying a time keeps it.
	 *
	 * @param array<mixed> $values
	 *
	 * @return array<mixed>
	 */
	private static function normalise( array $values ): array {
		foreach ( $values as $key => $value ) {
			if ( $value instanceof \DateTimeInterface ) {
				$values[ $key ] = '00:00:00' === $value->format( 'H:i:s' )
					? $value->format( 'Y-m-d' )
					: $value->format( \DateTimeInterface::ATOM );

				continue;
			}

			if ( is_array( $value ) ) {
				$values[ $key ] = self::normalise( $value );
			}
		}

		return $values;
	}
}
