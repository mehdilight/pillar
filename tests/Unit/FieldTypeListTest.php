<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * `schema/field-types.json` names the dashboard control that draws each type.
 * Nothing reads that column at runtime, so nothing would notice it going
 * stale — this does.
 */
final class FieldTypeListTest extends TestCase {

	public function test_every_type_names_a_control_that_exists(): void {
		$root  = dirname( __DIR__, 2 );
		$types = json_decode( (string) file_get_contents( $root . '/schema/field-types.json' ), true )['types'];
		$files = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $root . '/apps/editor/src/components', \FilesystemIterator::SKIP_DOTS ) );
		$names = [];

		foreach ( $files as $file ) {
			$names[] = basename( (string) $file, '.tsx' );
		}

		foreach ( $types as $type ) {
			if ( true === ( $type['decorative'] ?? false ) ) {
				continue;
			}

			self::assertContains( $type['editor'], $names, sprintf( '"%s" is drawn by %s, which is not a component.', $type['name'], $type['editor'] ) );
		}
	}
}
