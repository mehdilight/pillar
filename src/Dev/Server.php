<?php
declare( strict_types=1 );

namespace Pillar\Dev;

use Pillar\Build\RouteTable;
use Pillar\Git\LocalGit;
use Pillar\Pillar;
use Pillar\PillarException;
use Pillar\Site\PathPolicy;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * What `pillar dev` serves: the dashboard, the JSON API, and the site itself.
 *
 * The preview renders through `PageRenderer` — the same class `pillar build`
 * calls — so what the editor shows is what the build will write, not a
 * lookalike.
 */
final class Server {

	public function __construct(
		private readonly string $root,
		/** Where the dashboard's built assets live. */
		private readonly string $dashboard,
	) {}

	public function handle( Request $request ): Response {
		$path = $this->pathOf( $request );

		return match ( true ) {
			str_starts_with( $path, '/api/' )     => ( new Api( $this->root, new LocalGit( $this->root ) ) )
				->handle( $request, substr( $path, 4 ) ),
			str_starts_with( $path, '/preview' )  => $this->preview( $request, substr( $path, 8 ) ),
			str_starts_with( $path, '/assets/' )  => $this->asset( substr( $path, 8 ), (int) $request->query->get( 'w', 0 ) ),
			str_starts_with( $path, '/_pillar/plugins/' ) => $this->pluginAsset( substr( $path, 17 ) ),
			str_starts_with( $path, '/_pillar/' ) => $this->dashboardAsset( substr( $path, 9 ) ),
			default                               => $this->dashboardPage(),
		};
	}

	/**
	 * The requested path, taken from the raw request URI.
	 *
	 * Not `getPathInfo()`: PHP's built-in server rewrites `SCRIPT_NAME` to the
	 * requested file whenever that file happens to exist under the document
	 * root, and Symfony derives its base URL from `SCRIPT_NAME`. So
	 * `/assets/base.css` — which does exist in a site — came back as a path
	 * info of `/`, and the dashboard's HTML was served in place of the
	 * stylesheet. Only paths that exist on disk were affected, which is exactly
	 * the set that looks like it should work.
	 */
	private function pathOf( Request $request ): string {
		$uri  = (string) $request->server->get( 'REQUEST_URI', $request->getPathInfo() );
		$path = (string) ( parse_url( $uri, PHP_URL_PATH ) ?: '/' );

		return rawurldecode( $path );
	}

	/** The site, rendered live, with the editor's selection attributes on. */
	private function preview( Request $request, string $path ): Response {
		$url = '' === $path ? '/' : $path;

		try {
			$pillar = Pillar::forSite( $this->root, editor: true, drafts: true, compile: false );
			$extra = $pillar->routes->find( $url );
			if ( null !== $extra ) {
				return new Response( ( $extra['render'] )(), 200, [ 'Content-Type' => $extra['type'], 'X-Robots-Tag' => 'noindex, nofollow' ] );
			}
			$routes = ( new RouteTable( $pillar->site, $pillar->content ) )->all();
			$route  = null;

			foreach ( $routes as $candidate ) {
				if ( $candidate->url === $url || rtrim( $candidate->url, '/' ) === rtrim( $url, '/' ) ) {
					$route = $candidate;

					break;
				}
			}

			if ( null === $route ) {
				return new Response( $this->notFound( $url, $routes ), 404, [ 'Content-Type' => 'text/html' ] );
			}

			$html = $pillar->render( $route->template, $route->url, $route->data );

			// A section that threw rendered as empty; the editor should say so
			// rather than leave a hole nobody can explain.
			if ( ! $pillar->errors->isEmpty() ) {
				$html .= $this->errorOverlay( $pillar->errors->all() );
			}

			$html .= $this->bridge();

			return new Response( $html, 200, [ 'Content-Type' => 'text/html; charset=utf-8', 'X-Robots-Tag' => 'noindex, nofollow' ] );
		} catch ( PillarException $error ) {
			return new Response( $this->fatal( $error ), 500, [ 'Content-Type' => 'text/html' ] );
		}
	}

	/**
	 * Content types, by extension.
	 *
	 * Explicit rather than sniffed: a module script served as `text/html` is
	 * refused outright by the browser's strict MIME check for modules, and the
	 * only symptom is a blank page with nothing in the console. Caught live.
	 */
	private const TYPES = [
		'js'    => 'text/javascript; charset=utf-8',
		'mjs'   => 'text/javascript; charset=utf-8',
		'css'   => 'text/css; charset=utf-8',
		'json'  => 'application/json',
		'map'   => 'application/json',
		'svg'   => 'image/svg+xml',
		'png'   => 'image/png',
		'jpg'   => 'image/jpeg',
		'jpeg'  => 'image/jpeg',
		'gif'   => 'image/gif',
		'webp'  => 'image/webp',
		'avif'  => 'image/avif',
		'ico'   => 'image/x-icon',
		'woff'  => 'font/woff',
		'woff2' => 'font/woff2',
		'ttf'   => 'font/ttf',
		'otf'   => 'font/otf',
		'txt'   => 'text/plain; charset=utf-8',
		'md'    => 'text/markdown; charset=utf-8',
		'html'  => 'text/html; charset=utf-8',
	];

	private function file( string $path ): Response {
		$response = new BinaryFileResponse( $path );
		$extension = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );

		$response->headers->set( 'Content-Type', self::TYPES[ $extension ] ?? 'application/octet-stream' );
		// Everything here is read off disk on every request; a cached asset in
		// a dev loop is a stale asset.
		$response->headers->set( 'Cache-Control', 'no-store' );

		return $response;
	}

	/**
	 * The script that makes the canvas clickable.
	 *
	 * Appended to the preview's HTML rather than served as a file: it belongs
	 * to this response, and a theme should never have to include anything for
	 * the editor to work. Inlined for the same reason the attributes are
	 * emitted by the renderer — a theme author cannot forget it, and cannot
	 * ship it to production by accident, because a built page never goes
	 * through here.
	 */
	private function bridge(): string {
		$script = @file_get_contents( __DIR__ . '/editor-bridge.js' );

		return false === $script ? '' : '<script>' . $script . '</script>';
	}

	/**
	 * Theme assets, straight off disk — the build's hashing is a build concern.
	 * `?w=640` is an image's resized copy, made on request (see Media\Images).
	 */
	private function asset( string $file, int $width = 0 ): Response {
		try {
			$relative = PathPolicy::normalise( 'assets/' . $file );
		} catch ( PillarException ) {
			return new Response( 'Not found', 404 );
		}

		$pillar = Pillar::forSite( $this->root, compile: false );

		if ( $width > 0 ) {
			$copy = $pillar->images->devCopy( substr( $relative, 7 ), $width );

			return null === $copy ? new Response( 'Not found', 404 ) : $this->file( $copy );
		}

		$path = $pillar->site->layers()->resolve( $relative );

		return null === $path ? new Response( 'Not found', 404 ) : $this->file( $path );
	}

	/**
	 * A plugin's dashboard bundle or its stylesheet.
	 *
	 * Only files beside the script the plugin's manifest declares, only `.js`,
	 * `.css` and `.map`, and only for plugins this site enables — a request
	 * cannot name its way to anything else in the plugin's directory.
	 */
	private function pluginAsset( string $rest ): Response {
		[ $slug, $file ] = array_pad( explode( '/', $rest, 2 ), 2, '' );

		$file = basename( $file );

		if ( '' === $file || ! in_array( strtolower( pathinfo( $file, PATHINFO_EXTENSION ) ), [ 'js', 'css', 'map' ], true ) ) {
			return new Response( 'Not found', 404 );
		}

		foreach ( Pillar::forSite( $this->root, compile: false )->plugins as $plugin ) {
			if ( $plugin->manifest->slug !== $slug ) {
				continue;
			}

			$script = $plugin->manifest->editorScript();
			$path   = null === $script ? null : dirname( $script ) . '/' . $file;

			return null !== $path && is_file( $path ) ? $this->file( $path ) : new Response( 'Not found', 404 );
		}

		return new Response( 'Not found', 404 );
	}

	private function dashboardAsset( string $file ): Response {
		$path = $this->dashboard . '/assets/' . basename( $file );

		return is_file( $path ) ? $this->file( $path ) : new Response( 'Not found', 404 );
	}

	/**
	 * The dashboard SPA, with the site's own configuration injected.
	 *
	 * `window.PillarEditor` is what `api/client.ts` reads at module load; with
	 * `live: true` the editor stops using its fixtures.
	 */
	private function dashboardPage(): Response {
		$index = $this->dashboard . '/index.html';

		if ( ! is_file( $index ) ) {
			return new Response( $this->dashboardMissing(), 503, [ 'Content-Type' => 'text/html' ] );
		}

		$config = (string) json_encode( [
			'root'        => '/api',
			'previewRoot' => '/preview',
			'siteName'    => Pillar::forSite( $this->root, compile: false )->site->name,
			'live'        => true,
		] );

		$html = (string) file_get_contents( $index );
		$html = str_replace( '<head>', '<head><script>window.PillarEditor = ' . $config . ';</script>', $html );

		return new Response( $html, 200, [ 'Content-Type' => 'text/html; charset=utf-8' ] );
	}

	/** @param list<\Pillar\Build\Route> $routes */
	private function notFound( string $url, array $routes ): string {
		$known = implode( '', array_map(
			static fn ( $route ): string => sprintf( '<li><a href="/preview%s">%s</a></li>', $route->url, htmlspecialchars( $route->url ) ),
			$routes
		) );

		return sprintf(
			'<!doctype html><meta charset="utf-8"><style>%s</style><h1>No route for %s</h1><p>This site serves:</p><ul>%s</ul>',
			$this->style(),
			htmlspecialchars( $url ),
			$known
		);
	}

	/** @param list<array{route: string, section: string, type: string, error: \Throwable}> $errors */
	private function errorOverlay( array $errors ): string {
		$items = '';

		foreach ( $errors as $failure ) {
			$items .= sprintf(
				'<li><b>%s</b> <code>%s</code><br>%s</li>',
				htmlspecialchars( $failure['type'] ),
				htmlspecialchars( $failure['section'] ),
				htmlspecialchars( $failure['error']->getMessage() )
			);
		}

		return sprintf(
			'<div style="position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;background:#1a1a1a;color:#fff;'
			. 'font:12px/1.5 ui-monospace,monospace;padding:12px 14px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.35)">'
			. '<b style="color:#fca5a5">%d section(s) failed to render</b><ul style="margin:6px 0 0;padding-left:18px">%s</ul></div>',
			count( $errors ),
			$items
		);
	}

	private function fatal( \Throwable $error ): string {
		return sprintf(
			'<!doctype html><meta charset="utf-8"><style>%s</style><h1>The page could not render</h1><pre>%s</pre>',
			$this->style(),
			htmlspecialchars( $error->getMessage() )
		);
	}

	private function dashboardMissing(): string {
		return sprintf(
			'<!doctype html><meta charset="utf-8"><style>%s</style><h1>The dashboard is not built</h1>'
			. '<p>Run <code>npm install &amp;&amp; npm run build</code> in <code>apps/editor</code>.</p>'
			. '<p>The site itself still renders: <a href="/preview/">/preview/</a></p>',
			$this->style()
		);
	}

	private function style(): string {
		return 'body{font:14px/1.6 -apple-system,system-ui,sans-serif;max-width:44rem;margin:4rem auto;padding:0 1rem;color:#202223}'
			. 'code,pre{font-family:ui-monospace,monospace;background:#f1f2f4;padding:2px 5px;border-radius:4px}'
			. 'pre{padding:12px;overflow:auto}a{color:#005bd3}';
	}
}
