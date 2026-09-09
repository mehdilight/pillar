<?php
declare( strict_types=1 );

namespace Pillar\Build;

use Pillar\Pillar;

/**
 * The build: every route rendered, written to `dist/`.
 *
 * Incremental by default. A page is rebuilt when its own content changed, when
 * any template it read changed, or when the site-wide fingerprint (settings,
 * plugins, Pillar's own version) changed. Everything else is left alone — and
 * `--force` exists because a stale page is worse than a slow build.
 */
final class Builder {

	private readonly BuildManifest $manifest;

	private readonly DependencyRecorder $recorder;

	public function __construct(
		private readonly Pillar $pillar,
		private readonly bool $force = false,
	) {
		$this->manifest = BuildManifest::load( $this->manifestPath() );
		$this->recorder = new DependencyRecorder( $this->pillar->sections, $this->pillar->snippets );
	}

	/**
	 * @param callable(string, bool): void|null $progress called with (url, rebuilt)
	 *
	 * @return array{written: int, skipped: int, assets: int, ms: int}
	 */
	public function build( ?callable $progress = null ): array {
		$started = microtime( true );
		$output  = $this->pillar->site->outputDir();

		// A long-lived `pillar dev` builds repeatedly in one process; last
		// build's content hashes describe files that have since been edited.
		FileHash::forget();

		@mkdir( $output, 0777, true );

		$assets = ( new Assets( $this->pillar->site ) )->copy( $output );

		$this->pillar->filters->setAssetHashes( $assets );

		$fingerprint = $this->fingerprint( $assets );
		$stale       = $this->force || $fingerprint !== $this->manifest->fingerprint;

		$routes  = ( new RouteTable( $this->pillar->site, $this->pillar->content ) )->all();
		$written = 0;
		$skipped = 0;

		foreach ( $routes as $route ) {
			if ( ! $stale && $this->isFresh( $route, $output ) ) {
				$skipped++;
				$progress && $progress( $route->url, false );

				continue;
			}

			$this->recorder->start();

			$html = $this->pillar->render( $route->template, $route->url, $route->data );
			$path = $output . '/' . $route->outputPath();

			@mkdir( dirname( $path ), 0777, true );
			file_put_contents( $path, $html );

			$dependencies = $this->recorder->paths();

			$this->manifest->record( $route->url, $this->hash( $route, $dependencies ), $route->outputPath(), $dependencies );

			$written++;
			$progress && $progress( $route->url, true );
		}

		$this->manifest->fingerprint = $fingerprint;
		$this->manifest->save( $this->manifestPath() );

		return [
			'written' => $written,
			'skipped' => $skipped,
			'assets'  => count( $assets ),
			'ms'      => (int) round( ( microtime( true ) - $started ) * 1000 ),
		];
	}

	/**
	 * Whether a route's output can stand.
	 *
	 * The recorded hash covers the route's own source and every template it
	 * read last time; the output file has to still exist, since a cleaned
	 * `dist/` must rebuild even though nothing else changed.
	 */
	private function isFresh( Route $route, string $output ): bool {
		$recorded = $this->manifest->hashFor( $route->url );

		if ( null === $recorded || ! is_file( $output . '/' . $route->outputPath() ) ) {
			return false;
		}

		// Hashed over what the *last* render of this route read. Mixing in what
		// the recorder happens to hold right now would fold the previously
		// rendered route's dependencies into this one's answer, and no page
		// would ever look fresh.
		return $recorded === $this->hash( $route, $this->manifest->depsFor( $route->url ) );
	}

	/**
	 * A route's identity: what it is, plus the state of everything it read.
	 *
	 * @param list<string> $dependencies
	 */
	private function hash( Route $route, array $dependencies ): string {
		$parts = [ $route->template, $route->url ];

		if ( null !== $route->source ) {
			$parts[] = 'source:' . FileHash::of( $route->source );
		}

		sort( $dependencies );

		foreach ( $dependencies as $dependency ) {
			// A deleted dependency hashes as "gone", so it cannot look the same
			// as one that is merely unchanged.
			$parts[] = $dependency . ':' . FileHash::of( $dependency );
		}

		return md5( implode( '|', $parts ) );
	}

	/**
	 * What invalidates every page at once.
	 *
	 * Site settings, the template JSONs, the asset map, and Pillar's own
	 * version. Plugins join this list in B5: a plugin that changes output must
	 * change the fingerprint, or an incremental build will keep serving pages
	 * it rendered before the plugin existed.
	 *
	 * @param array<string, string> $assets
	 */
	private function fingerprint( array $assets ): string {
		$parts = [ 'pillar:' . \Pillar\Cli\Application::VERSION, 'assets:' . md5( (string) json_encode( $assets ) ) ];

		foreach ( [ 'config/settings_data.json', 'config/settings_schema.json' ] as $file ) {
			$path    = $this->pillar->site->layers()->resolve( $file );
			$parts[] = $file . ':' . ( null === $path ? 'none' : FileHash::of( $path ) );
		}

		foreach ( $this->pillar->site->layers()->listing( 'templates', 'json' ) as $name => $path ) {
			$parts[] = 'templates/' . (string) $name . ':' . FileHash::of( $path );
		}

		return md5( implode( '|', $parts ) );
	}

	private function manifestPath(): string {
		return $this->pillar->site->cacheDir() . '/manifest.json';
	}
}
