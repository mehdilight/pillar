<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Content\FrontmatterWriter;
use Phpmystic\Pillar\Dev\Media;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Schema\ContentSchema;
use Phpmystic\Pillar\Schema\SchemaException;
use Phpmystic\Pillar\Schema\Setting;
use Phpmystic\Pillar\Schema\SettingsCaster;
use Phpmystic\Pillar\Schema\Validator;
use Phpmystic\Pillar\Tests\SiteTestCase;

/**
 * Groups, repeaters, tables, checkboxes, icons and files — and the options
 * that turn an image into a gallery and a date into a date and time.
 */
final class FieldTypesTest extends SiteTestCase {

	private const FAQ = [
		'id'     => 'faq',
		'type'   => 'repeater',
		'label'  => 'Questions',
		'fields' => [
			[ 'id' => 'question', 'type' => 'text', 'label' => 'Question' ],
			[ 'id' => 'answer', 'type' => 'textarea', 'label' => 'Answer' ],
			[ 'id' => 'featured', 'type' => 'checkbox', 'label' => 'Featured' ],
		],
	];

	public function test_group_and_repeater_parse_their_fields_and_round_trip(): void {
		$author = Setting::fromArray( [ 'id' => 'author', 'type' => 'group', 'fields' => [ [ 'id' => 'name', 'type' => 'text' ], [ 'id' => 'links', 'type' => 'repeater', 'fields' => [ [ 'id' => 'url', 'type' => 'url' ] ] ] ] ] );

		self::assertCount( 2, $author->fields );
		self::assertSame( 'repeater', $author->fields[1]->type->value );
		self::assertSame( [], $author->initialValue() );
		self::assertSame( 'url', $author->toArray()['fields'][1]['fields'][0]['type'] );
	}

	public function test_a_group_needs_fields_with_unique_names_and_cannot_nest_forever(): void {
		foreach ( [
			[ 'id' => 'empty', 'type' => 'group' ],
			[ 'id' => 'twice', 'type' => 'repeater', 'fields' => [ [ 'id' => 'a', 'type' => 'text' ], [ 'id' => 'a', 'type' => 'text' ] ] ],
			[ 'id' => 'l1', 'type' => 'group', 'fields' => [ [ 'id' => 'l2', 'type' => 'group', 'fields' => [ [ 'id' => 'l3', 'type' => 'group', 'fields' => [ [ 'id' => 'l4', 'type' => 'group', 'fields' => [ [ 'id' => 'x', 'type' => 'text' ] ] ] ] ] ] ] ] ],
			[ 'id' => 'choices', 'type' => 'checkboxes' ],
			[ 'id' => 'related', 'type' => 'collection_item', 'collection' => '../posts' ],
		] as $raw ) {
			try {
				Setting::fromArray( $raw );
				self::fail( sprintf( '"%s" should not parse.', $raw['id'] ) );
			} catch ( SchemaException ) {
				self::addToAssertionCount( 1 );
			}
		}
	}

	public function test_options_apply_only_to_the_types_they_mean_something_for(): void {
		self::assertTrue( Setting::fromArray( [ 'id' => 'gallery', 'type' => 'image', 'multiple' => true ] )->multiple );
		self::assertSame( [], Setting::fromArray( [ 'id' => 'gallery', 'type' => 'image', 'multiple' => true ] )->initialValue() );
		self::assertFalse( Setting::fromArray( [ 'id' => 'title', 'type' => 'text', 'multiple' => true ] )->multiple );
		self::assertTrue( Setting::fromArray( [ 'id' => 'starts', 'type' => 'date', 'time' => true ] )->time );
		self::assertSame( [ 'posts' ], Setting::fromArray( [ 'id' => 'related', 'type' => 'collection_item', 'collection' => 'posts', 'multiple' => true ] )->toArray()['collections'] );
		self::assertSame( [ 'posts', 'docs' ], Setting::fromArray( [ 'id' => 'related', 'type' => 'collection_item', 'collections' => [ 'posts', 'docs' ] ] )->collections );
	}

	public function test_section_values_are_cast_all_the_way_down(): void {
		$caster = new SettingsCaster();
		$fields = [
			Setting::fromArray( self::FAQ ),
			Setting::fromArray( [ 'id' => 'author', 'type' => 'group', 'fields' => [ [ 'id' => 'name', 'type' => 'text' ], [ 'id' => 'age', 'type' => 'number' ] ] ] ),
			Setting::fromArray( [ 'id' => 'prices', 'type' => 'table' ] ),
			Setting::fromArray( [ 'id' => 'topics', 'type' => 'checkboxes', 'options' => [ [ 'value' => 'a' ], [ 'value' => 'b' ] ] ] ),
			Setting::fromArray( [ 'id' => 'gallery', 'type' => 'image', 'multiple' => true ] ),
		];

		$cast = $caster->castBlock( $fields, [
			'faq'     => [ [ 'question' => 'Why?', 'featured' => '1' ], 'not a row' ],
			'author'  => [ 'name' => 'Ada', 'age' => '36' ],
			'prices'  => [ [ 'Plan', 3 ], [ 'Pro', null ] ],
			'topics'  => [ 'a', [ 'nested' ] ],
			'gallery' => '/assets/one.png',
		] );

		self::assertSame( [ [ 'question' => 'Why?', 'answer' => '', 'featured' => true ] ], $cast['faq'] );
		self::assertSame( [ 'name' => 'Ada', 'age' => 36 ], $cast['author'] );
		self::assertSame( [ [ 'Plan', '3' ], [ 'Pro', '' ] ], $cast['prices'] );
		self::assertSame( [ 'a' ], $cast['topics'] );
		self::assertSame( [ '/assets/one.png' ], $cast['gallery'] );
	}

	public function test_the_validator_reports_a_wrong_value_inside_a_repeater_row_by_its_path(): void {
		file_put_contents( $this->root . '/schemas/posts.json', (string) json_encode( [
			'label'  => 'Posts',
			'fields' => [
				[ 'id' => 'title', 'type' => 'text' ],
				self::FAQ,
				[ 'id' => 'topics', 'type' => 'checkboxes', 'options' => [ [ 'value' => 'git' ], [ 'value' => 'php' ] ] ],
			],
		] ) );
		file_put_contents(
			$this->root . '/content/posts/hello-world.md',
			"---\ntitle: Hello\nfaq:\n  - question: Fine\n    featured: true\n  - question: Broken\n    featured: 'yes'\ntopics: [git, rust]\n---\nBody\n"
		);

		$pillar   = $this->pillar( drafts: true );
		$messages = implode( "\n", array_column( ( new Validator( $pillar->site, $pillar->schemas, $pillar->content ) )->run(), 'message' ) );

		self::assertStringContainsString( '"faq[1].featured" should be a boolean', $messages );
		self::assertStringNotContainsString( 'faq[0]', $messages );
		self::assertStringContainsString( '"topics" is "rust"; allowed: git, php.', $messages );
	}

	public function test_structured_frontmatter_is_written_as_readable_blocks(): void {
		$written = FrontmatterWriter::write( '', [
			'title' => 'Hello',
			'tags'  => [ 'git', 'php' ],
			'faq'   => [ [ 'question' => 'Why?', 'answer' => "Two\nlines" ] ],
		], 'Body' );

		self::assertStringContainsString( "tags: [git, php]\n", $written );
		self::assertStringContainsString( "faq:\n  - question: 'Why?'\n    answer: |-\n      Two\n      lines\n", $written );
	}

	public function test_a_content_type_with_structured_fields_parses(): void {
		$schema = ContentSchema::fromArray( 'people', [ 'fields' => [ self::FAQ, [ 'id' => 'icon', 'type' => 'icon' ], [ 'id' => 'cv', 'type' => 'file' ] ] ] );

		self::assertSame( [ 'repeater', 'icon', 'file' ], array_map( static fn ( Setting $field ): string => $field->type->value, $schema->fields ) );
	}

	public function test_video_tag_embeds_links_and_plays_files(): void {
		$tag = $this->pillar()->filters->all()['video_tag'];

		self::assertSame(
			'<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Launch" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen class="hero"></iframe>',
			$tag( 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'Launch', 'hero' )
		);
		self::assertStringContainsString( 'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"', $tag( 'https://youtu.be/dQw4w9WgXcQ' ) );
		self::assertStringContainsString( 'src="https://player.vimeo.com/video/76979871"', $tag( 'https://vimeo.com/76979871' ) );
		self::assertSame( '<video src="/assets/uploads/demo.mp4" controls preload="metadata" playsinline aria-label="Video"></video>', $tag( '/assets/uploads/demo.mp4' ) );
		self::assertSame( '', $tag( '' ) );
	}

	public function test_files_upload_when_their_bytes_match_their_extension(): void {
		$media = new Media( $this->pillar()->site );

		$pdf = $media->upload( [ 'name' => 'Price list.pdf', 'data' => base64_encode( "%PDF-1.7\n%âãÏÓ\n" ) ] );

		self::assertSame( 'file', $pdf['kind'] );
		self::assertMatchesRegularExpression( '#^/assets/uploads/price-list-[0-9a-f]{10}\.pdf$#', $pdf['url'] );
		self::assertContains( $pdf['url'], array_column( $media->all(), 'url' ) );

		foreach ( [ 'fake.pdf' => '<html><script>alert(1)</script>', 'page.html' => '<html></html>', 'notes.txt' => "binary\0data" ] as $name => $bytes ) {
			try {
				$media->upload( [ 'name' => $name, 'data' => base64_encode( $bytes ) ] );
				self::fail( $name . ' should be refused.' );
			} catch ( PillarException ) {
				self::addToAssertionCount( 1 );
			}
		}

		$media->delete( $pdf['url'] );
		self::assertFileDoesNotExist( $this->root . $pdf['url'] );
	}
}
