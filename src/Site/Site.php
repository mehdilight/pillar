<?php
declare( strict_types=1 );

namespace Pillar\Site;

use Pillar\PillarException;

/**
 * `site.json` — everything the build needs to know that is not a template.
 *
 * A site is a directory, so this is also where the layer cascade is declared:
 * which theme, which addons, in what order.
 */
final class Site {

	/**
	 * @param list<string> $addons  paths, relative to the site root, highest precedence first
	 * @param list<string> $plugins slugs or paths
	 * @param array<string, mixed> $raw
	 */
	private function __construct(
		public readonly string $root,
		public readonly string $name,
		public readonly string $baseUrl,
		public readonly string $output,
		public readonly ?string $theme,
		public readonly array $addons,
		public readonly array $plugins,
		public readonly string $deploy,
		public readonly array $raw,
	) {}

	public static function load( string $root ): self {
		$root = rtrim( realpath( $root ) ?: $root, '/' );
		$file = $root . '/site.json';

		if ( ! is_file( $file ) ) {
			throw new PillarException( sprintf( 'No site.json in %s — is this a Pillar site?', $root ) );
		}

		$raw = json_decode( (string) file_get_contents( $file ), true );

		if ( ! is_array( $raw ) ) {
			throw new PillarException( 'site.json is not valid JSON.' );
		}

		return new self(
			root: $root,
			name: (string) ( $raw['name'] ?? basename( $root ) ),
			baseUrl: rtrim( (string) ( $raw['base_url'] ?? '' ), '/' ),
			output: (string) ( $raw['output'] ?? 'dist' ),
			theme: isset( $raw['theme'] ) ? (string) $raw['theme'] : null,
			addons: array_values( array_map( 'strval', (array) ( $raw['addons'] ?? [] ) ) ),
			plugins: array_values( array_map( 'strval', (array) ( $raw['plugins'] ?? [] ) ) ),
			deploy: (string) ( $raw['deploy'] ?? 'static' ),
			raw: $raw,
		);
	}

	/**
	 * The cascade, built from what `site.json` declares.
	 *
	 * The site itself always wins; a missing theme is not an error, since a
	 * site may simply keep its own `sections/` and never install one.
	 */
	public function layers(): Layers {
		$layers = [ [ 'name' => 'site', 'root' => $this->root ] ];

		foreach ( $this->addons as $addon ) {
			$path = $this->absolute( $addon );

			if ( ! is_dir( $path ) ) {
				throw new PillarException( sprintf( 'Addon "%s" is declared in site.json but %s does not exist.', $addon, $path ) );
			}

			$layers[] = [ 'name' => 'addon:' . basename( $addon ), 'root' => $path ];
		}

		if ( null !== $this->theme ) {
			$path = $this->absolute( 'themes/' . $this->theme );

			if ( ! is_dir( $path ) ) {
				throw new PillarException( sprintf( 'Theme "%s" is declared in site.json but %s does not exist.', $this->theme, $path ) );
			}

			$layers[] = [ 'name' => 'theme:' . $this->theme, 'root' => $path ];
		}

		return Layers::of( $layers );
	}

	public function absolute( string $relative ): string {
		return str_starts_with( $relative, '/' ) ? $relative : $this->root . '/' . trim( $relative, '/' );
	}

	public function outputDir(): string {
		return $this->absolute( $this->output );
	}

	/** Build artefacts: the compiled-template cache, image cache, build manifest. */
	public function cacheDir(): string {
		return $this->absolute( '.pillar' );
	}
}
