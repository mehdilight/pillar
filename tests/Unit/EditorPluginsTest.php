<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Dev\Server;
use Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Plugin dashboard bundles: listed for enabled plugins, served from beside the
 * script a manifest declares, and nothing else.
 *
 * A stand-in plugin rather than the SEO one, so these hold without building
 * anything — the bundle's contents are the plugin's business; serving it is
 * the host's.
 */
final class EditorPluginsTest extends SiteTestCase {

	protected function setUp(): void {
		parent::setUp();

		$this->plugin( 'hello', "editor: editor/dist/editor.js\n", built: true );
		$this->plugin( 'unbuilt', "editor: editor/dist/editor.js\n", built: false );
		$this->plugin( 'quiet', '', built: false );

		$this->enable( [ 'hello', 'unbuilt', 'quiet' ] );
	}

	public function test_enabled_plugins_with_a_bundle_are_listed_with_a_versioned_url(): void {
		$bundles = array_column( $this->json( '/api/editor/plugins' ), null, 'slug' );

		self::assertMatchesRegularExpression( '#^/editor/plugins/hello/editor\.js\?v=[0-9a-f]{10}$#', $bundles['hello']['script'] );
		self::assertMatchesRegularExpression( '#^/editor/plugins/hello/editor\.css\?v=#', (string) $bundles['hello']['style'] );
	}

	public function test_a_declared_but_unbuilt_bundle_is_listed_so_the_dashboard_can_say_so(): void {
		$bundles = array_column( $this->json( '/api/editor/plugins' ), null, 'slug' );

		self::assertArrayHasKey( 'unbuilt', $bundles );
		self::assertNull( $bundles['unbuilt']['script'] );
	}

	public function test_a_plugin_without_dashboard_ui_is_not_listed(): void {
		self::assertArrayNotHasKey( 'quiet', array_column( $this->json( '/api/editor/plugins' ), null, 'slug' ) );
	}

	public function test_a_disabled_plugin_has_no_panels_and_no_bundle(): void {
		$this->enable( [ 'unbuilt' ] );

		self::assertArrayNotHasKey( 'hello', array_column( $this->json( '/api/editor/plugins' ), null, 'slug' ) );
		self::assertSame( 404, $this->request( '/editor/plugins/hello/editor.js' )->getStatusCode() );
	}

	public function test_the_bundle_and_its_stylesheet_are_served_with_real_types(): void {
		$script = $this->request( '/editor/plugins/hello/editor.js' );
		$style  = $this->request( '/editor/plugins/hello/editor.css' );

		self::assertSame( 200, $script->getStatusCode() );
		self::assertSame( 'text/javascript; charset=utf-8', $script->headers->get( 'Content-Type' ) );
		self::assertSame( 'text/css; charset=utf-8', $style->headers->get( 'Content-Type' ) );
	}

	public function test_nothing_else_in_a_plugin_directory_can_be_fetched(): void {
		file_put_contents( $this->root . '/plugins/hello/editor/dist/secret.php', '<?php echo "no";' );

		foreach ( [
			'/editor/plugins/hello/secret.php',
			'/editor/plugins/hello/..%2F..%2Fplugin.yaml',
			'/editor/plugins/hello/../../plugin.yaml',
			'/editor/plugins/nope/editor.js',
		] as $url ) {
			self::assertSame( 404, $this->request( $url )->getStatusCode(), $url );
		}
	}

	public function test_the_dashboard_source_never_imports_a_plugin(): void {
		// The regression this whole mechanism replaced: the dashboard compiled
		// the SEO panels in by path, so they were not plugins at all. Every
		// relative import and Tailwind @source is resolved and must stay out of
		// the repository's plugins/ — `../plugins/host` is the dashboard's own.
		$repo    = dirname( __DIR__, 2 );
		$plugins = $repo . '/plugins/';
		$files   = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $repo . '/apps/editor/src', \FilesystemIterator::SKIP_DOTS ) );

		foreach ( $files as $file ) {
			if ( ! preg_match( '/\.(tsx?|css)$/', $file->getFilename() ) ) {
				continue;
			}

			preg_match_all(
				'#(?:from\s+|import\s*\(\s*|import\s+|@source\s+)[\'"](\.{1,2}/[^\'"]+)[\'"]#',
				(string) file_get_contents( $file->getPathname() ),
				$matches
			);

			foreach ( $matches[1] as $specifier ) {
				$target = self::normalise( $file->getPath() . '/' . $specifier );

				self::assertStringStartsNotWith( $plugins, $target, $file->getPathname() . ' imports ' . $specifier );
			}
		}
	}

	/** `a/b/../c` → `a/c`, without requiring the path to exist. */
	private static function normalise( string $path ): string {
		$parts = [];

		foreach ( explode( '/', $path ) as $part ) {
			if ( '..' === $part ) {
				array_pop( $parts );
			} elseif ( '.' !== $part && '' !== $part ) {
				$parts[] = $part;
			}
		}

		return '/' . implode( '/', $parts );
	}

	private function plugin( string $slug, string $extra, bool $built ): void {
		$root = $this->root . '/plugins/' . $slug;

		@mkdir( $root, 0777, true );
		file_put_contents( $root . '/plugin.yaml', "slug: {$slug}\nname: {$slug}\nversion: 1.0.0\n" . $extra );

		if ( $built ) {
			@mkdir( $root . '/editor/dist', 0777, true );
			file_put_contents( $root . '/editor/dist/editor.js', 'window.PillarHost.define("' . $slug . '", { register() {} });' );
			file_put_contents( $root . '/editor/dist/editor.css', '.x{}' );
		}
	}

	/** @param list<string> $plugins */
	private function enable( array $plugins ): void {
		$config            = json_decode( (string) file_get_contents( $this->root . '/site.json' ), true );
		$config['plugins'] = $plugins;

		file_put_contents( $this->root . '/site.json', (string) json_encode( $config ) );
	}

	private function request( string $uri ): Response {
		return ( new Server( $this->root, $this->root . '/no-dashboard' ) )->handle( Request::create( $uri ) );
	}

	/** @return array<mixed> */
	private function json( string $uri ): array {
		return (array) json_decode( (string) $this->request( $uri )->getContent(), true );
	}
}
