<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Render\Drops\PageDrop;
use Phpmystic\Pillar\Schema\Setting;
use Phpmystic\Pillar\Schema\SettingsCaster;
use Phpmystic\Pillar\Schema\Validator;
use Phpmystic\Pillar\Tests\SiteTestCase;

/**
 * A relationship is stored as references and read as entries: a template
 * loops over `page.related` and gets posts, not slugs.
 */
final class RelationshipsTest extends SiteTestCase {

	protected function setUp(): void {
		parent::setUp();

		$schema = json_decode( (string) file_get_contents( $this->root . '/schemas/posts.json' ), true );

		$schema['fields'][] = [ 'id' => 'related', 'type' => 'collection_item', 'collection' => 'posts', 'multiple' => true ];
		$schema['fields'][] = [ 'id' => 'featured', 'type' => 'collection_item', 'collections' => [ 'posts', 'pages' ] ];
		$schema['fields'][] = [ 'id' => 'parent', 'type' => 'page' ];
		$schema['fields'][] = [
			'id'     => 'reading',
			'type'   => 'repeater',
			'fields' => [ [ 'id' => 'note', 'type' => 'text' ], [ 'id' => 'post', 'type' => 'collection_item', 'collection' => 'posts' ] ],
		];

		file_put_contents( $this->root . '/schemas/posts.json', (string) json_encode( $schema ) );
	}

	public function test_references_read_as_the_entries_they_name(): void {
		$page = $this->post( "related: [why-static, gone, unfinished]\nfeatured: pages/about\nparent: /about/" );

		$related = $page->beforeMethod( 'related' );

		// A missing entry is dropped, and so is a draft in a production build.
		self::assertSame( [ 'Why static' ], array_map( static fn ( PageDrop $entry ): string => $entry->title(), $related ) );
		self::assertInstanceOf( PageDrop::class, $page->beforeMethod( 'featured' ) );
		self::assertSame( 'About', $page->beforeMethod( 'featured' )->title() );
		self::assertSame( '/about/', $page->beforeMethod( 'parent' )->url() );
	}

	public function test_a_template_loops_over_related_entries_like_any_list_of_posts(): void {
		$page     = $this->post( "related: [why-static]\nreading:\n  - note: Then\n    post: why-static" );
		$template = \Phpmystic\Liqx\Template::parse(
			'<ul>{page.related.map((post) => <li><a href={post.url}>{post.title}</a></li>)}</ul>{page.reading.map((row) => <p>{row.note}: {row.post.title}</p>)}',
			$this->pillar()->environment
		);

		self::assertSame(
			'<ul><li><a href="/posts/why-static/">Why static</a></li></ul><p>Then: Why static</p>',
			$template->render( [ 'page' => $page ] )
		);
	}

	public function test_drafts_are_found_where_drafts_render(): void {
		$page = $this->post( 'related: [unfinished]', drafts: true );

		self::assertSame( [ 'Unfinished' ], array_map( static fn ( PageDrop $entry ): string => $entry->title(), $page->beforeMethod( 'related' ) ) );
	}

	public function test_references_inside_repeater_rows_resolve_too(): void {
		$page = $this->post( "reading:\n  - note: Start here\n    post: why-static" );

		$rows = $page->beforeMethod( 'reading' );

		self::assertSame( 'Start here', $rows[0]['note'] );
		self::assertSame( 'Why static', $rows[0]['post']->title() );
	}

	public function test_reading_a_relationship_records_the_collection_it_reads(): void {
		$pillar = $this->pillar();
		$seen   = [];

		$pillar->content->listen( static function ( string $collection ) use ( &$seen ): void {
			$seen[] = $collection;
		} );

		file_put_contents( $this->root . '/content/posts/hello-world.md', "---\ntitle: Hello\nfeatured: pages/about\n---\n" );
		$pillar->content->page( $pillar->content->find( 'posts', 'hello-world' ) )->beforeMethod( 'featured' );

		// So a page showing About is rebuilt when About changes.
		self::assertContains( 'pages', $seen );
	}

	public function test_a_section_setting_resolves_the_same_way(): void {
		$caster = new SettingsCaster( $this->pillar()->content );
		$field  = Setting::fromArray( [ 'id' => 'post', 'type' => 'collection_item', 'collection' => 'posts' ] );

		self::assertSame( 'Why static', $caster->castBlock( [ $field ], [ 'post' => 'why-static' ] )['post']->title() );
		self::assertNull( $caster->castBlock( [ $field ], [ 'post' => 'gone' ] )['post'] );
	}

	public function test_the_validator_warns_about_references_to_nothing(): void {
		$this->post( "related: [why-static, gone]\nfeatured: pages/nope" );

		$pillar   = $this->pillar( drafts: true );
		$messages = implode( "\n", array_column( ( new Validator( $pillar->site, $pillar->schemas, $pillar->content ) )->run(), 'message' ) );

		self::assertStringContainsString( '"related" points to posts/gone, which does not exist.', $messages );
		self::assertStringContainsString( '"featured" points to pages/nope, which does not exist.', $messages );
		self::assertStringNotContainsString( 'posts/why-static', $messages );
	}

	private function post( string $frontmatter, bool $drafts = false ): PageDrop {
		file_put_contents( $this->root . '/content/posts/hello-world.md', "---\ntitle: Hello world\n" . $frontmatter . "\n---\nBody\n" );

		$pillar = $this->pillar( drafts: $drafts );

		return $pillar->content->page( $pillar->content->find( 'posts', 'hello-world' ) );
	}
}
