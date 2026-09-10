<?php
declare( strict_types=1 );

namespace Pillar\Plugin;

use Pillar\PillarException;
use Symfony\Component\Yaml\Yaml;

/** `plugin.yaml` — the only file a plugin must have. */
final class PluginManifest {

	private function __construct(
		public readonly string $slug,
		public readonly string $name,
		public readonly string $version,
		public readonly string $description,
		public readonly string $root,
		public readonly ?string $pluginClass,
		public readonly ?string $namespace,
		public readonly string $src,
		/** A theme addon this plugin ships — sections, snippets, assets. */
		public readonly ?string $theme,
	) {}

	public static function fromDirectory( string $root ): self {
		$file = $root . '/plugin.yaml';

		if ( ! is_file( $file ) ) {
			throw new PillarException( sprintf( 'No plugin.yaml in %s', $root ) );
		}

		$raw = Yaml::parseFile( $file );

		if ( ! is_array( $raw ) ) {
			throw new PillarException( sprintf( '%s is not valid YAML.', $file ) );
		}

		$slug = (string) ( $raw['slug'] ?? basename( $root ) );

		if ( ! preg_match( '/^[a-z][a-z0-9-]*$/', $slug ) ) {
			throw new PillarException( sprintf( 'Plugin slug "%s" must be lowercase letters, digits and hyphens.', $slug ) );
		}

		$class     = isset( $raw['plugin_class'] ) ? (string) $raw['plugin_class'] : null;
		$namespace = isset( $raw['namespace'] ) ? (string) $raw['namespace'] : null;

		// All three or none: a namespace with no class autoloads nothing, and
		// a class with no namespace cannot be found.
		if ( null !== $class && null === $namespace ) {
			throw new PillarException( sprintf( 'Plugin "%s" declares plugin_class but no namespace.', $slug ) );
		}

		return new self(
			slug: $slug,
			name: (string) ( $raw['name'] ?? $slug ),
			version: (string) ( $raw['version'] ?? '0.0.0' ),
			description: (string) ( $raw['description'] ?? '' ),
			root: $root,
			pluginClass: $class,
			namespace: $namespace,
			src: (string) ( $raw['src'] ?? 'src' ),
			theme: isset( $raw['theme'] ) ? (string) $raw['theme'] : null,
		);
	}

	/** What the build hashes so a plugin change invalidates the pages it touched. */
	public function fingerprint(): string {
		return $this->slug . '@' . $this->version;
	}
}
