<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Plugin;

use Phpmystic\Pillar\Build\BuildHooks;
use Phpmystic\Pillar\Build\RouteRegistry;
use Phpmystic\Pillar\Content\ContentStore;
use Phpmystic\Pillar\Render\Head\HeadRegistry;
use Phpmystic\Pillar\Render\LiqxExtension;
use Phpmystic\Pillar\Site\Site;

/**
 * What a plugin is handed: the site, the registries, its own settings.
 *
 * Also where a plugin declares what it read. Everything a plugin depends on
 * that the file system did not see — a config file, an environment variable, a
 * remote fetch — has to be named here, or an incremental build will keep
 * serving pages rendered before that input changed. It is in the first version
 * of this API on purpose: retrofitting it means every plugin written before is
 * silently wrong.
 */
final class PluginContext {

	/** @var list<LiqxExtension> */
	private array $extensions = [];

	/** @var list<string> */
	private array $dependencies = [];

	/** @var list<string> */
	private array $fingerprints = [];

	public function __construct(
		public readonly Site $site,
		public readonly PluginManifest $manifest,
		public readonly HeadRegistry $head,
		public readonly RouteRegistry $routes,
		public readonly BuildHooks $build,
		public readonly ContentStore $content,
		public readonly EditorRegistry $editor,
	) {}

	/** Filters and globals a theme asks for by name. */
	public function extend( LiqxExtension $extension ): void {
		$this->extensions[] = $extension;
	}

	/** @return list<LiqxExtension> */
	public function extensions(): array {
		return $this->extensions;
	}

	/**
	 * This plugin's settings: `config/plugins/<slug>.json`.
	 *
	 * A plain file in the site, so it is committed, diffable and editable
	 * without the dashboard — the same terms as everything else here. Reading
	 * it registers it as a dependency, so changing it rebuilds.
	 *
	 * @return array<string, mixed>
	 */
	public function settings(): array {
		$path = $this->site->absolute( 'config/plugins/' . $this->manifest->slug . '.json' );

		$this->dependsOn( $path );

		if ( ! is_file( $path ) ) {
			return [];
		}

		$raw = json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $raw ) ) {
			throw new \Phpmystic\Pillar\PillarException( 'Invalid plugin settings: ' . $path );
		}

		return $raw;
	}

	/** A file this plugin read that the renderer never saw. */
	public function dependsOn( string $path ): void {
		$this->dependencies[] = $path;
	}

	/** Anything else that should invalidate the build when it changes. */
	public function fingerprint( string $value ): void {
		$this->fingerprints[] = $value;
	}

	/** @return list<string> */
	public function dependencies(): array {
		return $this->dependencies;
	}

	/** @return list<string> */
	public function fingerprints(): array {
		return $this->fingerprints;
	}

}
