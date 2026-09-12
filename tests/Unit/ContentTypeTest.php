<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\Content\ContentType;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Tests\SiteTestCase;

/** Creating a content type: the three files, written the way a person would. */
final class ContentTypeTest extends SiteTestCase {

	public function test_developer_icon_survives_content_type_edits(): void {
		$this->types()->create( 'guides' );
		$path = $this->root . '/schemas/guides.json';
		$raw = json_decode( (string) file_get_contents( $path ), true );
		$raw['icon'] = 'book-open';
		file_put_contents( $path, json_encode( $raw ) );
		$this->types()->update( 'guides', 'Help', $raw['fields'] );
		$updated = json_decode( (string) file_get_contents( $path ), true );
		$schema = \Phpmystic\Pillar\Schema\ContentSchema::fromArray( 'guides', $updated );
		self::assertSame( 'book-open', $schema->toArray()['icon'] );
		self::assertSame( 'Help', $schema->label );
		self::assertSame( 'file-text', \Phpmystic\Pillar\Schema\ContentSchema::fromArray( 'plain', [] )->icon );
	}

	public function test_it_writes_the_schema_the_folder_and_the_template(): void {
		$result = $this->types()->create( 'guides', 'Guides' );

		self::assertSame( [ 'schemas/guides.json', 'content/guides/', 'templates/guide.json' ], $result['files'] );
		self::assertFileExists( $this->root . '/schemas/guides.json' );
		self::assertDirectoryExists( $this->root . '/content/guides' );
		// Git does not track an empty directory, and a content type that
		// vanishes on clone is worse than a stray file.
		self::assertFileExists( $this->root . '/content/guides/.gitkeep' );
		self::assertFileExists( $this->root . '/templates/guide.json' );
	}

	public function test_the_entry_template_is_copied_from_the_page_template(): void {
		$this->types()->create( 'guides' );

		self::assertJsonStringEqualsJsonString(
			(string) file_get_contents( $this->root . '/templates/page.json' ),
			(string) file_get_contents( $this->root . '/templates/guide.json' ),
			'whatever renders a page renders a new type’s entries too'
		);
	}

	public function test_a_new_type_starts_with_blog_shaped_fields(): void {
		$this->types()->create( 'guides' );

		$schema = json_decode( (string) file_get_contents( $this->root . '/schemas/guides.json' ), true );

		self::assertSame( 'Guides', $schema['label'] );
		self::assertSame( [ 'title', 'date', 'tags', 'draft' ], array_column( $schema['fields'], 'id' ) );
	}

	public function test_fields_can_be_chosen(): void {
		$this->types()->create( 'guides', 'Guides', [ ContentType::PRESETS['title'], ContentType::PRESETS['order'] ] );

		$schema = json_decode( (string) file_get_contents( $this->root . '/schemas/guides.json' ), true );

		self::assertSame( [ 'title', 'order' ], array_column( $schema['fields'], 'id' ) );
	}

	public function test_an_entry_in_a_new_type_renders_and_builds(): void {
		$this->types()->create( 'guides', 'Guides' );

		file_put_contents(
			$this->root . '/content/guides/first.md',
			"---\ntitle: First guide\n---\nThe body.\n"
		);

		( new Builder( $this->pillar( compile: false ) ) )->build();

		$html = (string) file_get_contents( $this->root . '/dist/guides/first/index.html' );

		self::assertStringContainsString( '<h1>First guide</h1>', $html );
		self::assertStringContainsString( 'The body.', $html );
	}

	public function test_a_bad_field_type_fails_before_anything_is_written(): void {
		try {
			$this->types()->create( 'guides', 'Guides', [ [ 'id' => 'x', 'type' => 'color_scheme' ] ] );

			self::fail( 'expected a SchemaException' );
		} catch ( PillarException ) {
			// A half-created type — a folder with no schema — is worse than
			// none at all.
			self::assertFileDoesNotExist( $this->root . '/schemas/guides.json' );
			self::assertDirectoryDoesNotExist( $this->root . '/content/guides' );
		}
	}

	public function test_creating_one_that_exists_is_refused(): void {
		$this->expectException( PillarException::class );
		$this->expectExceptionMessageMatches( '/A "posts" collection already exists/' );

		$this->types()->create( 'posts' );
	}

	public function test_a_name_that_would_not_be_a_folder_is_refused(): void {
		$this->expectException( PillarException::class );

		$this->types()->create( '../escaped' );
	}

	public function test_a_declared_type_with_no_entries_is_still_listed(): void {
		$this->types()->create( 'guides', 'Guides' );

		$pillar = $this->pillar( drafts: true );
		$types  = ( new ContentType( $pillar->site ) )->all( $pillar->content );

		// Otherwise creating a type and then adding its first entry is
		// impossible: it would appear nowhere to add an entry to.
		self::assertArrayHasKey( 'guides', $types );
		self::assertSame( 0, $types['guides']['count'] );
		self::assertSame( 'Guides', $types['guides']['label'] );
	}

	public function test_fields_can_be_replaced_later(): void {
		$this->types()->create( 'guides', 'Guides' );
		$this->types()->update( 'guides', 'Manuals', [ ContentType::PRESETS['title'], ContentType::PRESETS['image'] ] );

		$schema = json_decode( (string) file_get_contents( $this->root . '/schemas/guides.json' ), true );

		self::assertSame( 'Manuals', $schema['label'] );
		self::assertSame( [ 'title', 'image' ], array_column( $schema['fields'], 'id' ) );
	}

	private function types(): ContentType {
		return new ContentType( $this->pillar( compile: false )->site );
	}
}
