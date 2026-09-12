<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests;

use PHPUnit\Framework\TestCase;
use Phpmystic\Pillar\Pillar;

/**
 * Renders against `tests/fixtures/site`, copied into a temp directory so a test
 * that writes (settings, content, a build) cannot leave the fixture changed for
 * the next one.
 */
abstract class SiteTestCase extends TestCase {

	protected string $root;

	protected function setUp(): void {
		$this->root = sys_get_temp_dir() . '/pillar-test-' . bin2hex( random_bytes( 6 ) );

		self::copy( __DIR__ . '/fixtures/site', $this->root );
	}

	protected function tearDown(): void {
		self::remove( $this->root );
	}

	/** @param list<string> $addons paths relative to `tests/fixtures` */
	protected function withLayers( ?string $theme = null, array $addons = [] ): void {
		$config = json_decode( (string) file_get_contents( $this->root . '/site.json' ), true );

		foreach ( $addons as $addon ) {
			$target = $this->root . '/vendor-addons/' . basename( $addon );

			self::copy( __DIR__ . '/fixtures/' . $addon, $target );
			$config['addons'][] = 'vendor-addons/' . basename( $addon );
		}

		if ( null !== $theme ) {
			self::copy( __DIR__ . '/fixtures/' . $theme, $this->root . '/themes/fixture' );
			$config['theme'] = 'fixture';
		}

		file_put_contents( $this->root . '/site.json', json_encode( $config, JSON_PRETTY_PRINT ) );
	}

	/** Compiling to disk is the build's path; tests keep it off unless they mean it. */
	protected function pillar( bool $editor = false, bool $drafts = false, bool $compile = false ): Pillar {
		return Pillar::forSite( $this->root, $editor, $drafts, $compile );
	}

	protected static function copy( string $from, string $to ): void {
		mkdir( $to, 0777, true );

		$items = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $from, \FilesystemIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::SELF_FIRST
		);

		foreach ( $items as $item ) {
			$target = $to . '/' . $items->getSubPathname();

			$item->isDir() ? mkdir( $target, 0777, true ) : copy( $item->getPathname(), $target );
		}
	}

	protected static function remove( string $path ): void {
		if ( ! is_dir( $path ) ) {
			return;
		}

		$items = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $path, \FilesystemIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::CHILD_FIRST
		);

		foreach ( $items as $item ) {
			$item->isDir() ? rmdir( $item->getPathname() ) : unlink( $item->getPathname() );
		}

		rmdir( $path );
	}
}
