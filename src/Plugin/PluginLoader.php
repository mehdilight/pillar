<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Plugin;

use Phpmystic\Pillar\Build\BuildHooks;
use Phpmystic\Pillar\Build\RouteRegistry;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Render\Head\HeadRegistry;
use Phpmystic\Pillar\Site\Site;

/**
 * Finding, autoloading and registering a site's plugins.
 *
 * Enablement is `site.json`, not a database: a site is a directory, and which
 * plugins are on belongs in the file committed with it. The order there is the
 * order they register, which is the order they win contested keys.
 *
 * Autoloading is done here rather than through Composer because a plugin lives
 * in the *site*, not in Pillar's own vendor tree — the site author drops a
 * directory in and it works.
 */
final class PluginLoader {

	/** @var list<PluginContext> */
	private array $contexts = [];

	/** @var array<string, string> namespace prefix => source directory */
	private static array $autoloaded = [];

	public function __construct(
		private readonly Site $site,
		private readonly HeadRegistry $head,
		private readonly RouteRegistry $routes,
		private readonly BuildHooks $build,
		private readonly \Phpmystic\Pillar\Content\ContentStore $content,
		private readonly EditorRegistry $editor,
	) {}

	/**
	 * Load every plugin `site.json` lists.
	 *
	 * A plugin that throws while registering is fatal, unlike a section that
	 * throws while rendering: a half-registered plugin means a site that builds
	 * differently depending on how far the failure got, which is worse than a
	 * build that stops and says so.
	 *
	 * @return list<PluginContext>
	 */
	public function load(): array {
		foreach ( $this->site->plugins as $reference ) {
			$root = $this->resolve( $reference );

			if ( null === $root ) {
				throw new PillarException(
					sprintf( 'Plugin "%s" is listed in site.json but was not found.', $reference )
				);
			}

			$manifest = PluginManifest::fromDirectory( $root );
			foreach ( $this->contexts as $loaded ) {
				if ( $loaded->manifest->slug === $manifest->slug ) {
					throw new PillarException( 'Duplicate plugin: ' . $manifest->slug );
				}
			}
			$this->contexts[] = $this->register( $manifest );
		}

		return $this->contexts;
	}

	private function register( PluginManifest $manifest ): PluginContext {
		$context = new PluginContext( $this->site, $manifest, $this->head, $this->routes, $this->build, $this->content, $this->editor );

		// A plugin's version is part of the build fingerprint: upgrading one
		// must invalidate the pages it touched.
		$context->fingerprint( $manifest->fingerprint() );
		$context->dependsOn( $manifest->root . '/plugin.yaml' );
		$source = $manifest->root . '/' . $manifest->src;
		if ( is_dir( $source ) ) {
			$files = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $source, \FilesystemIterator::SKIP_DOTS ) );
			foreach ( $files as $file ) {
				if ( $file->isFile() ) {
					$context->dependsOn( $file->getPathname() );
				}
			}
		}

		if ( null === $manifest->pluginClass ) {
			// A plugin that is only a theme addon — sections and assets, no PHP
			// — is a legitimate thing to ship.
			return $context;
		}

		$this->autoload( (string) $manifest->namespace, $manifest->root . '/' . $manifest->src );

		if ( ! class_exists( $manifest->pluginClass ) ) {
			throw new PillarException( sprintf(
				'Plugin "%s" declares %s, which was not found under %s/.',
				$manifest->slug,
				$manifest->pluginClass,
				$manifest->src
			) );
		}

		$plugin = new ( $manifest->pluginClass )();

		if ( ! $plugin instanceof Plugin ) {
			throw new PillarException( sprintf(
				'%s must implement %s.',
				$manifest->pluginClass,
				Plugin::class
			) );
		}

		$plugin->register( $context );

		return $context;
	}

	/**
	 * PSR-4 for one namespace prefix.
	 *
	 * Registered once per prefix per process: a long-lived `pillar dev` builds
	 * repeatedly, and stacking an autoloader per build would leave hundreds.
	 */
	private function autoload( string $prefix, string $directory ): void {
		$prefix = trim( $prefix, '\\' ) . '\\';

		if ( isset( self::$autoloaded[ $prefix ] ) ) {
			return;
		}

		self::$autoloaded[ $prefix ] = $directory;

		spl_autoload_register( static function ( string $class ) use ( $prefix, $directory ): void {
			if ( ! str_starts_with( $class, $prefix ) ) {
				return;
			}

			$path = $directory . '/' . str_replace( '\\', '/', substr( $class, strlen( $prefix ) ) ) . '.php';

			if ( is_file( $path ) ) {
				require_once $path;
			}
		} );
	}

	/**
	 * Where a listed plugin lives: a path, or a slug under `plugins/`.
	 */
	private function resolve( string $reference ): ?string {
		foreach ( [ $reference, 'plugins/' . $reference ] as $candidate ) {
			$path = $this->site->absolute( $candidate );

			if ( is_dir( $path ) && is_file( $path . '/plugin.yaml' ) ) {
				return $path;
			}
		}

		$bundled = dirname( __DIR__, 2 ) . '/plugins/' . $reference;
		return preg_match( '/^[a-z][a-z0-9-]*$/', $reference ) && is_file( $bundled . '/plugin.yaml' ) ? $bundled : null;
	}

	/**
	 * The theme-addon layers plugins contribute, in registration order.
	 *
	 * A plugin ships the section its own feature needs without asking the site
	 * to install two things that must stay in step.
	 *
	 * @param list<PluginContext> $contexts
	 *
	 * @return list<array{name: string, root: string}>
	 */
	public static function layersOf( array $contexts ): array {
		$layers = [];

		foreach ( $contexts as $context ) {
			$theme = $context->manifest->theme;

			if ( null === $theme ) {
				continue;
			}

			$root = $context->manifest->root . '/' . trim( $theme, '/' );

			if ( is_dir( $root ) ) {
				$layers[] = [ 'name' => 'plugin:' . $context->manifest->slug, 'root' => $root ];
			}
		}

		return $layers;
	}
}
