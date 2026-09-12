<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\Build\RouteTable;
use Phpmystic\Pillar\Render\Drops\PaginateDrop;
use Phpmystic\Pillar\Tests\SiteTestCase;

/** A template that paginates is not one page but N, known before rendering. */
final class PaginationTest extends SiteTestCase {

	protected function setUp(): void {
		parent::setUp();

		// Five posts, two per page: three pages, the last one short.
		for ( $index = 1; $index <= 3; $index++ ) {
			file_put_contents(
				$this->root . '/content/posts/extra-' . $index . '.md',
				sprintf( "---\ntitle: Extra %d\ndate: 2026-07-0%d\n---\nBody.\n", $index, $index )
			);
		}

		file_put_contents(
			$this->root . '/templates/blog.json',
			(string) json_encode( [
				'paginate' => [ 'collection' => 'posts', 'per_page' => 2 ],
				'sections' => [ 'list' => [ 'section_type' => 'post-list', 'settings' => [] ] ],
			] )
		);
	}

	public function test_a_route_exists_for_every_page(): void {
		$urls = array_column( $this->routes(), 'url' );

		self::assertContains( '/blog/', $urls );
		self::assertContains( '/blog/page/2/', $urls );
		self::assertContains( '/blog/page/3/', $urls );
		self::assertNotContains( '/blog/page/1/', $urls, 'page one is the collection itself' );
		self::assertNotContains( '/blog/page/4/', $urls );
	}

	public function test_each_page_carries_only_its_own_slice(): void {
		$pages = $this->pageDrops();

		self::assertCount( 2, $pages['/blog/']->items() );
		self::assertCount( 2, $pages['/blog/page/2/']->items() );
		self::assertCount( 1, $pages['/blog/page/3/']->items(), 'the last page is short' );
		self::assertSame( 5, $pages['/blog/']->total() );
		self::assertSame( 3, $pages['/blog/']->pages() );
	}

	public function test_the_links_point_where_they_should(): void {
		$pages  = $this->pageDrops();
		$second = $pages['/blog/page/2/'];

		self::assertSame( '/blog/', $second->previousUrl(), 'back to page one is the bare URL' );
		self::assertSame( '/blog/page/3/', $second->nextUrl() );
		self::assertNull( $pages['/blog/']->previousUrl() );
		self::assertNull( $pages['/blog/page/3/']->nextUrl() );
	}

	public function test_paginate_drop_provides_previous_and_next_aliases(): void {
		$pages  = $this->pageDrops();
		$second = $pages['/blog/page/2/'];

		self::assertSame( '/blog/', $second->previous() );
		self::assertSame( '/blog/page/3/', $second->next() );
		self::assertNull( $pages['/blog/']->previous() );
		self::assertNull( $pages['/blog/page/3/']->next() );
	}


	public function test_parts_mark_the_current_page(): void {
		$parts = $this->pageDrops()['/blog/page/2/']->parts();

		self::assertSame( [ '1', '2', '3' ], array_column( $parts, 'title' ) );
		self::assertSame( [ false, true, false ], array_column( $parts, 'current' ) );
	}

	public function test_a_long_collection_windows_its_links(): void {
		// Two hundred links is not a pagination bar, and every theme working
		// that out again is two hundred chances to get it wrong.
		$drop  = new PaginateDrop( [], 50, 100, 200, 2, '/blog/' );
		$parts = $drop->parts();

		self::assertSame( [ '1', '…', '49', '50', '51', '…', '100' ], array_column( $parts, 'title' ) );
		self::assertNull( $parts[1]['url'], 'a gap is not a link' );
	}

	public function test_a_collection_that_fits_on_one_page_shows_no_links(): void {
		$drop = new PaginateDrop( [], 1, 1, 2, 10, '/blog/' );

		self::assertSame( [], $drop->parts() );
		self::assertFalse( $drop->hasNext() );
	}

	public function test_the_pages_are_built(): void {
		( new Builder( $this->pillar( compile: false ) ) )->build();

		self::assertFileExists( $this->root . '/dist/blog/index.html' );
		self::assertFileExists( $this->root . '/dist/blog/page/2/index.html' );
		self::assertFileExists( $this->root . '/dist/blog/page/3/index.html' );
	}

	/** @return list<\Phpmystic\Pillar\Build\Route> */
	private function routes(): array {
		$pillar = $this->pillar( compile: false );

		return ( new RouteTable( $pillar->site, $pillar->content ) )->all();
	}

	/** @return array<string, PaginateDrop> */
	private function pageDrops(): array {
		$out = [];

		foreach ( $this->routes() as $route ) {
			if ( isset( $route->data['paginate'] ) && $route->data['paginate'] instanceof PaginateDrop ) {
				$out[ $route->url ] = $route->data['paginate'];
			}
		}

		return $out;
	}
}
