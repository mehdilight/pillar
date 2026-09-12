<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Build;

use Phpmystic\Pillar\Pillar;

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
		$this->recorder = new DependencyRecorder( $this->pillar->content, $this->pillar->sections, $this->pillar->snippets );
	}

	/**
	 * @param callable(string, bool): void|null $progress called with (url, rebuilt)
	 *
	 * @return array{written: int, skipped: int, assets: int, images: int, ms: int}
	 */
	public function build( ?callable $progress = null ): array {
		$started = microtime( true );
		$output  = $this->pillar->site->outputDir();

		// A long-lived `pillar dev` builds repeatedly in one process; last
		// build's content hashes describe files that have since been edited.
		FileHash::forget();
		$this->pillar->build->runBefore();

		@mkdir( $output, 0777, true );

		$assets = ( new Assets( $this->pillar->site ) )->copy( $output );

		$this->pillar->filters->setAssetHashes( $assets );

		// Resized copies of every image, before any page asks for one — see
		// Media\Images for why up front rather than on demand.
		$copies = $this->pillar->images->generate( $output, $assets );

		$this->pillar->images->useBuild( $copies );

		$fingerprint = $this->fingerprint( $assets, $copies );
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

			// Every snippet this page renders must be recorded for it — see
			// LayeredFileSystem::fresh() for why the file system is renewed.
			$this->pillar->environment->setSnippetFileSystem( $this->pillar->snippets->fresh() );

			$html = $this->pillar->render( $route->template, $route->url, $route->data );
			$html = $this->pillar->build->runEachPage( $html, $route->url );
			$path = $output . '/' . $route->outputPath();

			@mkdir( dirname( $path ), 0777, true );
			file_put_contents( $path, $html );

			$dependencies = $this->recorder->paths();

			$this->manifest->record( $route->url, $this->hash( $route, $dependencies ), $route->outputPath(), $dependencies );

			$written++;
			$progress && $progress( $route->url, true );
		}

		$outputs = array_map( static fn ( Route $route ): string => $route->outputPath(), $routes );
		$artifacts = [];
		foreach ( $this->pillar->routes->all() as $route ) {
			$relative = ltrim( $route['url'], '/' );
			if ( in_array( $relative, $outputs, true ) ) {
				throw new \Phpmystic\Pillar\PillarException( 'Plugin route conflicts with a page: ' . $route['url'] );
			}
			$contents = ( $route['render'] )();
			@mkdir( dirname( $output . '/' . $relative ), 0777, true );
			file_put_contents( $output . '/' . $relative, $contents );
			$artifacts[] = $relative;
		}
		// Remove only files owned by the previous build. Disabling a plugin
		// must remove its sitemap; deleting a post must remove its public page.
		// Both copies of each asset are the build's: the hashed name and the
		// plain one (see Assets) — so a deleted asset takes both with it, and
		// its resized copies with it too.
		$assetOutputs = array_map(
			static fn ( string $file ): string => 'assets/' . $file,
			array_merge( array_values( $assets ), array_map( 'strval', array_keys( $assets ) ), array_merge( [], ...array_map( 'array_values', array_values( $copies ) ) ) )
		);
		$active = array_merge( $outputs, $artifacts, $assetOutputs );
		$activeUrls = array_fill_keys( array_column( $routes, 'url' ), true );
		foreach ( $this->manifest->pages as $url => $page ) {
			if ( ! isset( $activeUrls[ $url ] ) ) {
				$this->removeOutput( $page['output'], $active, $output );
				unset( $this->manifest->pages[ $url ] );
			}
		}
		foreach ( array_merge( $this->manifest->artifacts, $this->manifest->assets ) as $relative ) {
			$this->removeOutput( $relative, $active, $output );
		}
		$this->manifest->artifacts = $artifacts;
		$this->manifest->assets = $assetOutputs;
		$this->pillar->build->runAfter( $this->manifest );
		$this->manifest->fingerprint = $this->pillar->errors->isEmpty() ? $fingerprint : '';
		$this->manifest->save( $this->manifestPath() );

		return [
			'written' => $written,
			'skipped' => $skipped,
			'assets'  => count( $assets ),
			'images'  => array_sum( array_map( 'count', $copies ) ),
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

		// Collections the route read before rendering (a paginated listing).
		foreach ( $route->collections as $collection ) {
			$parts[] = DependencyRecorder::COLLECTION . $collection . ':' . $this->pillar->content->hash( $collection );
		}

		if ( null !== $route->source ) {
			$parts[] = 'source:' . FileHash::of( $route->source );
		}

		sort( $dependencies );

		foreach ( $dependencies as $dependency ) {
			if ( str_starts_with( $dependency, DependencyRecorder::COLLECTION ) ) {
				// A collection a template read while rendering — `collections.posts`
				// in a home page's list — hashed by membership and content.
				$collection = substr( $dependency, strlen( DependencyRecorder::COLLECTION ) );
				$parts[]    = $dependency . ':' . $this->pillar->content->hash( $collection );

				continue;
			}

			// A deleted dependency hashes as "gone", so it cannot look the same
			// as one that is merely unchanged.
			$parts[] = $dependency . ':' . FileHash::of( $dependency );
		}

		return md5( implode( '|', $parts ) );
	}

	/**
	 * What invalidates every page at once.
	 *
	 * Site settings, the template JSONs, the asset map and its resized copies,
	 * the media library's alt text, and Pillar's own version. Plugins join this list in B5: a plugin that changes output must
	 * change the fingerprint, or an incremental build will keep serving pages
	 * it rendered before the plugin existed.
	 *
	 * @param array<string, string>             $assets
	 * @param array<string, array<int, string>> $copies
	 */
	private function fingerprint( array $assets, array $copies ): string {
		$parts = [
			'pillar:' . \Phpmystic\Pillar\Cli\Application::VERSION,
			'assets:' . md5( (string) json_encode( $assets ) ),
			'images:' . md5( (string) json_encode( $copies ) . '|' . $this->pillar->images->config->sizes ),
		];

		foreach ( [ 'config/settings_data.json', 'config/settings_schema.json', 'config/media.json', 'data/menus.json', 'layout/theme.liqx' ] as $file ) {
			$path    = $this->pillar->site->layers()->resolve( $file );
			$parts[] = $file . ':' . ( null === $path ? 'none' : FileHash::of( $path ) );
		}

		foreach ( $this->pillar->site->layers()->listing( 'templates', 'json' ) as $name => $path ) {
			$parts[] = 'templates/' . (string) $name . ':' . FileHash::of( $path );
		}

		$parts[] = 'site:' . FileHash::of( $this->pillar->site->absolute( 'site.json' ) );
		foreach ( $this->pillar->plugins as $plugin ) {
			array_push( $parts, ...$plugin->fingerprints() );
			$dependencies = $plugin->dependencies();
			sort( $dependencies );
			foreach ( $dependencies as $path ) { $parts[] = $path . ':' . FileHash::of( $path ); }
		}
		return md5( implode( '|', $parts ) );
	}

	/** @param list<string> $active */
	private function removeOutput( string $relative, array $active, string $output ): void {
		if ( str_starts_with( $relative, '/' ) || str_contains( $relative, '..' ) || str_contains( $relative, '\\' ) ) {
			throw new \Phpmystic\Pillar\PillarException( 'Unsafe output in build manifest: ' . $relative );
		}
		if ( ! in_array( $relative, $active, true ) && is_file( $output . '/' . $relative ) ) {
			unlink( $output . '/' . $relative );

			// A deleted post's folder goes with its page — up to, never
			// including, the output directory, and only while it is empty.
			for ( $dir = dirname( $relative ); '.' !== $dir && '' !== $dir; $dir = dirname( $dir ) ) {
				if ( ! @rmdir( $output . '/' . $dir ) ) {
					break;
				}
			}
		}
	}

	private function manifestPath(): string {
		return $this->pillar->site->cacheDir() . '/manifest.json';
	}
}
