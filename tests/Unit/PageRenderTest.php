<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\PillarException;
use Pillar\Tests\SiteTestCase;

/** B1's contract: a template JSON, some `.liqx` and some markdown become HTML. */
final class PageRenderTest extends SiteTestCase {

	public function test_it_renders_a_page_through_its_layout(): void {
		$html = $this->pillar()->render( 'index' );

		self::assertStringContainsString( '<title>Fixture site</title>', $html );
		self::assertStringContainsString( 'class="template-index"', $html );
		self::assertStringContainsString( '<main>', $html );
	}

	public function test_layout_sections_render_with_their_settings(): void {
		$html = $this->pillar()->render( 'index' );

		// `section('header')` resolves to the configured instance in
		// templates/layout.json, not to a bare file with no settings.
		self::assertStringContainsString( 'Static, but not static', $html );
		self::assertStringContainsString( '© Fixture', $html );
	}

	public function test_section_settings_reach_the_template(): void {
		$html = $this->pillar()->render( 'index' );

		self::assertStringContainsString( 'Build sites that outlive their tools', $html );
		self::assertStringContainsString( 'padding:120px', $html );
	}

	public function test_liqx_emits_the_section_wrapper(): void {
		$html = $this->pillar()->render( 'index' );

		self::assertStringContainsString( 'id="pillar-section-hero_a1"', $html );
		self::assertStringContainsString( 'class="pillar-section pillar-section--hero"', $html );
	}

	public function test_editor_attributes_are_preview_only(): void {
		self::assertStringNotContainsString( 'data-pillar-section-id', $this->pillar()->render( 'index' ) );
		self::assertStringContainsString( 'data-pillar-section-id="hero_a1"', $this->pillar( editor: true )->render( 'index' ) );
	}

	public function test_disabled_sections_and_blocks_are_skipped(): void {
		$html = $this->pillar()->render( 'index' );

		self::assertStringNotContainsString( 'Not rendered', $html );
		self::assertStringContainsString( 'Local first', $html );
		self::assertStringNotContainsString( 'Git is the store', $html );
	}

	public function test_sections_render_in_the_declared_order(): void {
		$html = $this->pillar()->render( 'index' );

		self::assertLessThan( strpos( $html, 'pillar-section--feature-grid' ), strpos( $html, 'pillar-section--hero' ) );
		self::assertLessThan( strpos( $html, 'pillar-section--post-list' ), strpos( $html, 'pillar-section--feature-grid' ) );
	}

	public function test_content_reaches_a_section_through_a_snippet(): void {
		$html = $this->pillar()->render( 'index' );

		// post-list maps over collections.posts and renders <PostCard />,
		// which resolves through the snippet file system.
		self::assertStringContainsString( 'class="post-card"', $html );
		self::assertStringContainsString( 'href="/posts/hello-world/"', $html );
		self::assertStringContainsString( 'Why static', $html );
	}

	public function test_an_explicit_order_beats_the_date(): void {
		// Documentation is a sequence; alphabetical puts "Getting started" in
		// the middle of it.
		foreach ( [ 'zebra' => 1, 'alpha' => 2 ] as $slug => $order ) {
			file_put_contents(
				$this->root . '/content/posts/' . $slug . '.md',
				"---\ntitle: {$slug}\norder: {$order}\n---\nBody.\n"
			);
		}

		$titles = array_map(
			static fn ( $post ): mixed => $post->beforeMethod( 'title' ),
			$this->pillar()->content->collection( 'posts' )->items()
		);

		self::assertSame( [ 'zebra', 'alpha' ], array_slice( $titles, 0, 2 ) );
		self::assertContains( 'Hello world', $titles, 'entries with no position still appear, after' );
	}

	public function test_drafts_are_excluded_unless_asked_for(): void {
		self::assertStringNotContainsString( 'Unfinished', $this->pillar()->render( 'index' ) );
		self::assertStringContainsString( 'Unfinished', $this->pillar( drafts: true )->render( 'index' ) );
	}

	public function test_a_broken_section_renders_empty_and_the_page_still_ships(): void {
		file_put_contents( $this->root . '/sections/hero.liqx', '<div>{ this is not valid liqx' );

		$pillar = $this->pillar();
		$html   = $pillar->render( 'index' );

		self::assertStringContainsString( '© Fixture', $html, 'the rest of the page still renders' );
		self::assertSame( 1, $pillar->errors->count() );
		self::assertSame( 'hero', $pillar->errors->all()[0]['type'] );
	}

	public function test_a_broken_layout_is_fatal(): void {
		file_put_contents( $this->root . '/layout/theme.liqx', '<html>{ nope' );

		$this->expectException( PillarException::class );
		$this->expectExceptionMessageMatches( '/layout\/theme\.liqx failed to render/' );

		$this->pillar()->render( 'index' );
	}

	public function test_a_missing_template_names_itself(): void {
		$this->expectException( PillarException::class );
		$this->expectExceptionMessageMatches( '/templates\/nope\.json/' );

		$this->pillar()->render( 'nope' );
	}
}
