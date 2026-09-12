<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Schema\FieldType;
use Phpmystic\Pillar\Schema\SchemaException;
use Phpmystic\Pillar\Schema\SectionSchema;
use Phpmystic\Pillar\Schema\Setting;
use Phpmystic\Pillar\Schema\SettingsCaster;
use Phpmystic\Pillar\Schema\Validator;
use Phpmystic\Pillar\Tests\SiteTestCase;

/** B2: the `<schema>` block is the contract, and `pillar check` enforces it. */
final class SchemaTest extends SiteTestCase {

	public function test_a_section_schema_is_read_from_the_liqx_file(): void {
		$schema = $this->pillar()->schemas->forSection( 'hero' );

		self::assertNotNull( $schema );
		self::assertSame( 'Hero', $schema->name );
		self::assertSame( [ 'heading', 'subheading', 'padding' ], array_column( $schema->settings, 'id' ) );
		self::assertSame( FieldType::Range, $schema->setting( 'padding' )?->type );
	}

	public function test_an_unknown_setting_type_is_fatal_not_ignored(): void {
		// The failure bastet drifted into: a type the editor offers and PHP
		// rejects would otherwise render a control writing a value nothing reads.
		$this->expectException( SchemaException::class );
		$this->expectExceptionMessageMatches( '/Unknown setting type "color_scheme"/' );

		Setting::fromArray( [ 'id' => 'scheme', 'type' => 'color_scheme', 'label' => 'Scheme' ] );
	}

	public function test_a_setting_needs_a_usable_id(): void {
		$this->expectException( SchemaException::class );
		$this->expectExceptionMessageMatches( '/must be lowercase/' );

		Setting::fromArray( [ 'id' => 'Heading-1', 'type' => 'text' ] );
	}

	public function test_decorative_settings_need_no_id(): void {
		$setting = Setting::fromArray( [ 'type' => 'header', 'content' => 'Layout' ] );

		self::assertTrue( $setting->type->isDecorative() );
		self::assertNull( $setting->initialValue() );
	}

	public function test_duplicate_setting_ids_are_refused(): void {
		$this->expectException( SchemaException::class );
		$this->expectExceptionMessageMatches( '/Duplicate setting id "heading"/' );

		SectionSchema::fromArray( 'hero', [
			'settings' => [
				[ 'id' => 'heading', 'type' => 'text' ],
				[ 'id' => 'heading', 'type' => 'textarea' ],
			],
		] );
	}

	public function test_a_select_without_options_is_refused(): void {
		$this->expectException( SchemaException::class );
		$this->expectExceptionMessageMatches( '/needs options/' );

		Setting::fromArray( [ 'id' => 'width', 'type' => 'select' ] );
	}

	public function test_stored_values_are_cast_to_what_the_type_promises(): void {
		$schema = SectionSchema::fromArray( 'x', [
			'settings' => [
				[ 'id' => 'padding', 'type' => 'range', 'default' => 96 ],
				[ 'id' => 'full', 'type' => 'checkbox', 'default' => true ],
				[ 'id' => 'tags', 'type' => 'tags' ],
				[ 'id' => 'missing', 'type' => 'text', 'default' => 'fallback' ],
			],
		] );

		// What a form actually round-trips through JSON.
		$cast = ( new SettingsCaster() )->cast( $schema, [ 'padding' => '120', 'full' => 'false', 'tags' => 'one' ] );

		self::assertSame( 120, $cast['padding'] );
		self::assertFalse( $cast['full'] );
		self::assertSame( [ 'one' ], $cast['tags'] );
		self::assertSame( 'fallback', $cast['missing'], 'an unset setting falls back to its default' );
	}

	public function test_a_value_with_no_setting_is_kept_not_destroyed(): void {
		$schema = SectionSchema::fromArray( 'x', [ 'settings' => [ [ 'id' => 'a', 'type' => 'text' ] ] ] );
		$cast   = ( new SettingsCaster() )->cast( $schema, [ 'a' => 'x', 'removed' => 'still here' ] );

		self::assertSame( 'still here', $cast['removed'] );
	}

	public function test_check_passes_on_a_healthy_site(): void {
		self::assertSame( [], $this->validator()->run() );
	}

	public function test_check_catches_a_template_naming_a_section_that_does_not_exist(): void {
		unlink( $this->root . '/sections/hero.liqx' );

		$problems = $this->validator()->run();

		self::assertContains( 'templates/index.json', array_column( $problems, 'where' ) );
		self::assertStringContainsString( 'which no layer provides', $problems[0]['message'] );
	}

	public function test_check_catches_a_broken_schema_block(): void {
		file_put_contents( $this->root . '/sections/hero.liqx', "<div></div>\n<schema>{ not json }</schema>" );

		// One validator, asked twice: `hasErrors()` reports on the run that
		// happened, so a fresh instance would always say no.
		$validator = $this->validator();
		$problems  = $validator->run();

		self::assertTrue( $validator->hasErrors() );
		self::assertStringContainsString( 'not valid JSON', $problems[0]['message'] );
	}

	public function test_check_catches_content_that_violates_its_schema(): void {
		file_put_contents(
			$this->root . '/content/posts/bad.md',
			"---\ntitle: Bad\ntags: not-a-list\ndraft: yes-please\n---\nBody.\n"
		);

		$messages = array_column( $this->validator()->run(), 'message' );

		self::assertStringContainsString( '"tags" should be a list, got string', implode( ' ', $messages ) );
		self::assertStringContainsString( '"draft" should be a boolean, got string', implode( ' ', $messages ) );
	}

	public function test_check_warns_about_a_stored_setting_the_schema_dropped(): void {
		$template = json_decode( (string) file_get_contents( $this->root . '/templates/index.json' ), true );

		$template['sections']['hero_a1']['settings']['gone'] = 'value';

		file_put_contents( $this->root . '/templates/index.json', (string) json_encode( $template ) );

		$validator = $this->validator();
		$problems  = $validator->run();

		self::assertFalse( $validator->hasErrors(), 'a warning, not an error — the value is kept' );
		self::assertStringContainsString( 'which its schema does not declare', $problems[0]['message'] );
	}

	private function validator(): Validator {
		$pillar = $this->pillar( drafts: true );

		return new Validator( $pillar->site, $pillar->schemas, $pillar->content );
	}
}
