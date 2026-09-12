<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Dev\Server;
use Phpmystic\Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The dashboard is a client-routed app: every path it owns — /content/posts,
 * /editor/about — must serve its page, while its own files live under
 * /_pillar/ where no route or site path would collide with them.
 */
final class DashboardRoutesTest extends SiteTestCase {

	private string $dashboard;

	protected function setUp(): void {
		parent::setUp();

		// A stand-in build: what `npm run build` writes into public/editor.
		$this->dashboard = $this->root . '/built-dashboard';

		mkdir( $this->dashboard . '/assets', 0777, true );
		file_put_contents( $this->dashboard . '/index.html', '<html><head></head><body><div id="pillar-root"></div></body></html>' );
		file_put_contents( $this->dashboard . '/assets/app-abc123.js', 'console.log("app");' );
	}

	public function test_every_route_the_router_owns_serves_the_dashboard(): void {
		foreach ( [ '/', '/content/posts', '/content/posts/hello-world', '/content/posts/new', '/types', '/media', '/settings', '/publish', '/editor', '/editor/about' ] as $path ) {
			$response = $this->request( $path );

			self::assertSame( 200, $response->getStatusCode(), $path );
			self::assertStringContainsString( 'id="pillar-root"', (string) $response->getContent(), $path );
		}
	}

	public function test_the_site_configuration_is_injected_for_the_client(): void {
		self::assertStringContainsString( 'window.PillarEditor', (string) $this->request( '/content/posts' )->getContent() );
	}

	public function test_the_dashboards_own_files_are_served_under_pillar(): void {
		$response = $this->request( '/_pillar/assets/app-abc123.js' );

		self::assertSame( 200, $response->getStatusCode() );
		self::assertSame( 'text/javascript; charset=utf-8', $response->headers->get( 'Content-Type' ) );
	}

	public function test_editor_is_a_route_now_not_an_asset_prefix(): void {
		// It used to be where the built files lived; a file path under it must
		// now fall through to the app, not to an asset lookup.
		self::assertStringContainsString( 'id="pillar-root"', (string) $this->request( '/editor/assets/app-abc123.js' )->getContent() );
	}

	public function test_api_preview_and_site_assets_keep_their_own_paths(): void {
		self::assertSame( 'application/json', $this->request( '/api/health' )->headers->get( 'Content-Type' ) );
		self::assertStringContainsString( 'data-pillar-section-id', (string) $this->request( '/preview/' )->getContent() );
		self::assertSame( 'text/css; charset=utf-8', $this->request( '/assets/base.css' )->headers->get( 'Content-Type' ) );
	}

	public function test_preview_only_injects_editor_bridge_when_editor_param_is_present(): void {
		$standalonePreview = (string) $this->request( '/preview/' )->getContent();
		self::assertStringNotContainsString( 'pillar-hover-outline', $standalonePreview );

		$editorPreview = (string) $this->request( '/preview/?editor=1' )->getContent();
		self::assertStringContainsString( 'pillar-hover-outline', $editorPreview );
	}


	private function request( string $uri ): Response {
		return ( new Server( $this->root, $this->dashboard ) )->handle( Request::create( $uri ) );
	}
}
