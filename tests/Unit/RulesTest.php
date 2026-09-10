<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Dev\Server;
use Pillar\Schema\ContentSchema;
use Pillar\Schema\Rules;
use Pillar\Schema\SchemaException;
use Pillar\Schema\Setting;
use Pillar\Schema\Validator;
use Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;

/**
 * Required fields, limits and email addresses — and `visible_if`, since a
 * field that is not shown is never required.
 */
final class RulesTest extends SiteTestCase {

	/** @return list<Setting> */
	private static function form(): array {
		return ContentSchema::fromArray( 'events', [ 'fields' => [
			[ 'id' => 'title', 'type' => 'text', 'label' => 'Title', 'required' => true, 'character_limit' => 20 ],
			[ 'id' => 'kind', 'type' => 'radio', 'label' => 'Kind', 'display' => 'buttons', 'options' => [ [ 'value' => 'talk' ], [ 'value' => 'video' ] ] ],
			[ 'id' => 'video_url', 'type' => 'url', 'label' => 'Video', 'required' => true, 'visible_if' => [ [ 'field' => 'kind', 'value' => 'video' ] ] ],
			[ 'id' => 'contact', 'type' => 'text', 'label' => 'Contact', 'input_type' => 'email' ],
			[ 'id' => 'agree', 'type' => 'checkbox', 'label' => 'Agreed', 'required' => true, 'visible_if' => [ [ 'field' => 'contact', 'operator' => 'not_empty' ] ] ],
			[ 'id' => 'speakers', 'type' => 'repeater', 'label' => 'Speakers', 'max' => 2, 'fields' => [ [ 'id' => 'name', 'type' => 'text', 'label' => 'Name', 'required' => true ] ] ],
		] ] )->fields;
	}

	public function test_a_valid_entry_has_no_violations(): void {
		self::assertSame( [], Rules::violations( self::form(), [ 'title' => 'Launch', 'kind' => 'talk', 'speakers' => [ [ 'name' => 'Ada' ] ] ] ) );
	}

	public function test_each_rule_reports_the_field_by_its_path(): void {
		$violations = Rules::violations( self::form(), [
			'title'    => str_repeat( 'x', 21 ),
			'kind'     => 'video',
			'contact'  => 'not an address',
			'speakers' => [ [ 'name' => 'Ada' ], [ 'name' => ' ' ], [ 'name' => 'Grace' ] ],
		] );

		self::assertSame(
			[
				'title'           => 'Title is longer than 20 characters.',
				'video_url'       => 'Video is required.',
				'contact'         => 'Contact is not an email address.',
				'agree'           => 'Agreed is required.',
				'speakers'        => 'Speakers has more than 2 rows.',
				'speakers.1.name' => 'Speakers row 2 › Name is required.',
			],
			array_column( $violations, 'message', 'path' )
		);
	}

	public function test_a_hidden_field_is_never_required(): void {
		$paths = array_column( Rules::violations( self::form(), [ 'title' => 'Launch', 'kind' => 'talk' ] ), 'path' );

		self::assertNotContains( 'video_url', $paths );
		self::assertNotContains( 'agree', $paths );
	}

	public function test_every_operator(): void {
		$field = static fn ( string $operator, mixed $value = null ): Setting => Setting::fromArray( [ 'id' => 'b', 'type' => 'text', 'visible_if' => [ [ 'field' => 'a', 'operator' => $operator, 'value' => $value ] ] ] );

		self::assertTrue( Rules::visible( $field( 'equals', 'x' ), [ 'a' => 'x' ] ) );
		self::assertTrue( Rules::visible( $field( 'equals', true ), [ 'a' => true ] ) );
		self::assertTrue( Rules::visible( $field( 'not_equals', 'x' ), [ 'a' => 'y' ] ) );
		self::assertTrue( Rules::visible( $field( 'contains', 'git' ), [ 'a' => [ 'php', 'git' ] ] ) );
		self::assertTrue( Rules::visible( $field( 'contains', 'it' ), [ 'a' => 'git' ] ) );
		self::assertTrue( Rules::visible( $field( 'empty' ), [ 'a' => [] ] ) );
		self::assertTrue( Rules::visible( $field( 'empty' ), [] ) );
		self::assertFalse( Rules::visible( $field( 'not_empty' ), [ 'a' => '  ' ] ) );
		self::assertFalse( Rules::visible( $field( 'equals', 'x' ), [ 'a' => 'y' ] ) );
	}

	public function test_a_condition_must_name_a_field_beside_it(): void {
		foreach ( [
			[ [ 'id' => 'a', 'type' => 'text', 'visible_if' => [ [ 'field' => 'typo' ] ] ] ],
			[ [ 'id' => 'a', 'type' => 'text', 'visible_if' => [ [ 'field' => 'a' ] ] ] ],
			[ [ 'id' => 'a', 'type' => 'text' ], [ 'id' => 'b', 'type' => 'text', 'visible_if' => [ [ 'field' => 'a', 'operator' => 'is' ] ] ] ],
		] as $fields ) {
			try {
				ContentSchema::fromArray( 'x', [ 'fields' => $fields ] );
				self::fail( 'Should not parse: ' . json_encode( $fields ) );
			} catch ( SchemaException ) {
				self::addToAssertionCount( 1 );
			}
		}
	}

	public function test_publishing_enforces_the_rules_and_a_draft_may_be_incomplete(): void {
		file_put_contents( $this->root . '/schemas/posts.json', (string) json_encode( [ 'label' => 'Posts', 'fields' => [
			[ 'id' => 'title', 'type' => 'text', 'label' => 'Title' ],
			[ 'id' => 'summary', 'type' => 'textarea', 'label' => 'Summary', 'required' => true ],
		] ] ) );

		$save = fn ( array $frontmatter ) => ( new Server( $this->root, $this->root . '/no-dashboard' ) )->handle(
			Request::create( '/api/content/posts/hello-world', 'PUT', [], [], [], [], (string) json_encode( [ 'frontmatter' => $frontmatter, 'body' => 'Hi' ] ) )
		);

		$refused = $save( [ 'title' => 'Hello' ] );
		self::assertSame( 422, $refused->getStatusCode() );
		self::assertStringContainsString( 'Summary is required.', (string) $refused->getContent() );

		self::assertSame( 200, $save( [ 'title' => 'Hello', 'draft' => true ] )->getStatusCode() );
		self::assertSame( 200, $save( [ 'title' => 'Hello', 'summary' => 'Short.' ] )->getStatusCode() );
	}

	public function test_pillar_check_errors_on_published_entries_and_warns_on_drafts(): void {
		file_put_contents( $this->root . '/schemas/posts.json', (string) json_encode( [ 'label' => 'Posts', 'fields' => [
			[ 'id' => 'summary', 'type' => 'textarea', 'label' => 'Summary', 'required' => true ],
		] ] ) );

		$pillar   = $this->pillar( drafts: true );
		$problems = ( new Validator( $pillar->site, $pillar->schemas, $pillar->content ) )->run();
		$byFile   = [];

		foreach ( $problems as $problem ) {
			if ( str_contains( $problem['message'], 'Summary is required' ) ) {
				$byFile[ $problem['where'] ] = $problem['level'];
			}
		}

		self::assertSame( 'error', $byFile['content/posts/hello-world.md'] ?? null );
		self::assertSame( 'warning', $byFile['content/posts/unfinished.md'] ?? null );
	}
}
