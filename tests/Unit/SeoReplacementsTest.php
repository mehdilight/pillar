<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Phpmystic\Pillar\Seo\Replacements;

// Plugin classes autoload at runtime via PluginLoader, not composer's static map.
require_once dirname( __DIR__, 2 ) . '/plugins/seo/src/Replacements.php';

/**
 * The SEO plugin's replacement variables — the mechanism that lets one
 * template produce four hundred distinct, correct titles.
 *
 * The collapse rules carry most of the weight: `%%sep%%` only earns its
 * place as a variable if emptying the thing beside it also removes the
 * separator, otherwise every product without a vendor renders "Serum ·  ·
 * Shop".
 */
final class SeoReplacementsTest extends TestCase {

	public function test_it_fills_known_variables(): void {
		$this->assertSame(
			'Serum · Ma Boutique',
			$this->replacements()->apply( '%%title%% %%sep%% %%sitename%%' )
		);
	}

	public function test_variable_names_are_case_insensitive(): void {
		$this->assertSame( 'Serum', $this->replacements()->apply( '%%TITLE%%' ) );
	}

	/**
	 * A visible `%%nonexistent%%` in a live `<title>` is worse than a
	 * slightly shorter title.
	 */
	public function test_an_unknown_variable_becomes_empty_rather_than_being_left_in(): void {
		$result = $this->replacements()->apply( '%%title%% %%sep%% %%nonexistent%%' );

		$this->assertStringNotContainsString( '%%', $result );
		$this->assertSame( 'Serum', $result );
	}

	public function test_an_empty_variable_takes_its_separator_with_it(): void {
		// `tagline` is empty — the trailing separator has to go too.
		$this->assertSame( 'Ma Boutique', $this->replacements()->apply( '%%sitename%% %%sep%% %%tagline%%' ) );
	}

	public function test_a_middle_variable_going_empty_collapses_the_doubled_separator(): void {
		$this->assertSame(
			'Serum · Ma Boutique',
			$this->replacements()->apply( '%%title%% %%sep%% %%tagline%% %%sep%% %%sitename%%' )
		);
	}

	public function test_a_leading_separator_is_removed(): void {
		$this->assertSame( 'Ma Boutique', $this->replacements()->apply( '%%tagline%% %%sep%% %%sitename%%' ) );
	}

	public function test_an_empty_template_stays_empty(): void {
		$this->assertSame( '', $this->replacements()->apply( '' ) );
		$this->assertSame( '', $this->replacements()->apply( '   ' ) );
	}

	/**
	 * A literal separator in a template is cleaned up the same way — the
	 * rules are about characters, not about which one `%%sep%%` produced.
	 */
	public function test_literal_separators_collapse_too(): void {
		$this->assertSame( 'Serum | Ma Boutique', $this->replacements()->apply( '%%title%% | %%tagline%% | %%sitename%%' ) );
	}

	public function test_with_returns_a_copy_rather_than_mutating(): void {
		$base    = $this->replacements();
		$changed = $base->with( 'title', 'Other' );

		$this->assertSame( 'Serum', $base->apply( '%%title%%' ) );
		$this->assertSame( 'Other', $changed->apply( '%%title%%' ) );
	}

	public function test_truncate_leaves_a_short_value_alone(): void {
		$this->assertSame( 'Short enough', Replacements::truncate( 'Short enough', 60 ) );
	}

	public function test_truncate_breaks_on_a_word_boundary(): void {
		$long = 'A fairly long description that will certainly need to be cut somewhere sensible';

		$result = Replacements::truncate( $long, 40 );

		$this->assertLessThanOrEqual( 40, mb_strlen( $result ) );
		$this->assertStringEndsWith( '…', $result );
		$this->assertStringNotContainsString( 'certainl…', $result, 'it should not cut mid-word' );
	}

	/** A single word longer than the limit has no boundary to break on. */
	public function test_truncate_hard_cuts_an_unbreakable_string(): void {
		$result = Replacements::truncate( str_repeat( 'a', 100 ), 20 );

		$this->assertLessThanOrEqual( 20, mb_strlen( $result ) );
	}

	public function test_truncate_strips_markup_and_collapses_whitespace(): void {
		$this->assertSame(
			'Bold text here',
			Replacements::truncate( "<p><b>Bold</b>   text\n\nhere</p>", 60 )
		);
	}

	private function replacements(): Replacements {
		return new Replacements( [
			'title'    => 'Serum',
			'sitename' => 'Ma Boutique',
			'sep'      => '·',
			'tagline'  => '',
		] );
	}
}
