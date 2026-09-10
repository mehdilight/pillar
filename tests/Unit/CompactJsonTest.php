<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Pillar\Support\CompactJson;

final class CompactJsonTest extends TestCase {

	public function test_a_schema_reads_like_one_written_by_hand(): void {
		$json = CompactJson::encode( [
			'label'  => 'Posts',
			'fields' => [
				[ 'id' => 'title', 'type' => 'text', 'label' => 'Title' ],
				[ 'id' => 'faq', 'type' => 'repeater', 'fields' => [ [ 'id' => 'q', 'type' => 'text' ] ] ],
			],
			'empty'  => [],
		] );

		self::assertSame(
			"{\n  \"label\": \"Posts\",\n  \"fields\": [\n    { \"id\": \"title\", \"type\": \"text\", \"label\": \"Title\" },\n    {\n      \"id\": \"faq\",\n      \"type\": \"repeater\",\n      \"fields\": [\n        { \"id\": \"q\", \"type\": \"text\" }\n      ]\n    }\n  ],\n  \"empty\": []\n}\n",
			$json
		);
	}

	public function test_it_round_trips_and_opens_up_what_does_not_fit(): void {
		$value = [ 'fields' => [ [ 'id' => 'long', 'label' => str_repeat( 'x', 120 ), 'options' => [ [ 'value' => 'a', 'label' => 'Ä/b' ] ] ] ] ];
		$json  = CompactJson::encode( $value );

		self::assertSame( $value, json_decode( $json, true ) );
		self::assertStringContainsString( "\n      \"label\": ", $json );
		self::assertStringContainsString( '"Ä/b"', $json );
	}
}
