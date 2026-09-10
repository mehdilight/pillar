<?php
declare( strict_types=1 );

namespace Pillar\Content;

use Pillar\PillarException;
use Pillar\Site\Site;

/**
 * Editor-owned navigation data.
 *
 * A menu is a named, ordered list of links. Keeping it in one plain JSON file
 * makes it available to every template as `menus` and keeps navigation in git
 * beside the content it points at.
 */
final class MenuStore {

	/** @return array<string, array{title: string, items: list<array<string, mixed>>}> */
	public static function load( Site $site ): array {
		$path = $site->absolute( 'data/menus.json' );

		if ( ! is_file( $path ) ) {
			return [];
		}

		$raw = json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $raw ) ) {
			throw new PillarException( 'data/menus.json is not valid JSON.' );
		}

		return self::normalise( $raw );
	}

	/**
	 * @param array<string, mixed> $raw
	 * @return array<string, array{title: string, items: list<array<string, mixed>>}>
	 */
	public static function normalise( array $raw ): array {
		$out = [];

		foreach ( $raw as $handle => $menu ) {
			$handle = (string) $handle;
			if ( ! preg_match( '/^[a-z][a-z0-9-]*$/', $handle ) ) {
				throw new PillarException( sprintf( 'Menu handle "%s" must use lowercase letters, digits and hyphens.', $handle ) );
			}
			if ( ! is_array( $menu ) ) {
				throw new PillarException( sprintf( 'Menu "%s" must be an object.', $handle ) );
			}

			$out[ $handle ] = [
				'title' => trim( (string) ( $menu['title'] ?? $handle ) ),
				'items' => self::items( (array) ( $menu['items'] ?? [] ), $handle ),
			];
		}

		return $out;
	}

	/** @param array<mixed> $items @return list<array<string, mixed>> */
	private static function items( array $items, string $handle ): array {
		$out = [];

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				throw new PillarException( sprintf( 'Every link in menu "%s" must be an object.', $handle ) );
			}

			$title = trim( (string) ( $item['title'] ?? '' ) );
			$url   = trim( (string) ( $item['url'] ?? '' ) );
			if ( '' === $title || '' === $url ) {
				throw new PillarException( sprintf( 'Every link in menu "%s" needs a label and URL.', $handle ) );
			}

			$entry = [ 'title' => $title, 'url' => $url ];
			$children = self::items( (array) ( $item['items'] ?? [] ), $handle );
			if ( [] !== $children ) {
				$entry['items'] = $children;
			}
			$out[] = $entry;
		}

		return $out;
	}
}
