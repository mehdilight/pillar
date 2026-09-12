<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\Tests\SiteTestCase;

/** Build the actual three-file recipe users copy from the pagination guide. */
final class PaginationDocumentationTest extends SiteTestCase {

	public function test_documented_listing_builds_page_slices_and_navigation(): void {
		$guide = file_get_contents( __DIR__ . '/../../website/content/docs/pagination.md' );
		self::assertIsString( $guide );
		preg_match_all( '/```json\n(.*?)```/s', $guide, $json );
		preg_match_all( '/```liqx\n(.*?)```/s', $guide, $liqx );
		self::assertCount( 1, $json[1] );
		self::assertCount( 3, $liqx[1] );
		file_put_contents( $this->root . '/templates/blog.json', $json[1][0] );
		file_put_contents( $this->root . '/sections/blog-list.liqx', $liqx[1][0] );
		file_put_contents( $this->root . '/snippets/pagination.liqx', $liqx[1][1] );

		for ( $index = 1; $index <= 3; $index++ ) {
			file_put_contents(
				$this->root . '/content/posts/doc-' . $index . '.md',
				sprintf( "---\ntitle: Documentation post %d\ndate: 2026-09-0%d\n---\nBody.\n", $index, $index )
			);
		}

		( new Builder( $this->pillar( compile: true ) ) )->build();
		$first = file_get_contents( $this->root . '/dist/blog/index.html' );
		$second = file_get_contents( $this->root . '/dist/blog/page/2/index.html' );
		$last = file_get_contents( $this->root . '/dist/blog/page/3/index.html' );
		self::assertIsString( $first );
		self::assertIsString( $second );
		self::assertIsString( $last );
		self::assertStringContainsString( 'Page 1 of 3', $first );
		self::assertStringContainsString( 'Documentation post 3', $first );
		self::assertStringNotContainsString( 'Documentation post 1', $first );
		self::assertStringContainsString( 'Documentation post 1', $second );
		self::assertStringContainsString( 'href="/blog/" rel="prev"', $second );
		self::assertStringContainsString( 'href="/blog/page/3/" rel="next"', $second );
		self::assertStringContainsString( 'aria-current="page">2', $second );
		self::assertStringContainsString( 'Page 3 of 3', $last );
		self::assertStringNotContainsString( 'rel="next"', $last );

		// The same documented template handles an empty collection and removes stale routes.
		foreach ( glob( $this->root . '/content/posts/*.md' ) ?: [] as $file ) {
			unlink( $file );
		}
		( new Builder( $this->pillar( compile: true ) ) )->build();
		$empty = file_get_contents( $this->root . '/dist/blog/index.html' );
		self::assertIsString( $empty );
		self::assertStringContainsString( 'No posts yet.', $empty );
		self::assertStringNotContainsString( 'aria-label="Pagination"', $empty );
		self::assertFileDoesNotExist( $this->root . '/dist/blog/page/2/index.html' );
	}
}
