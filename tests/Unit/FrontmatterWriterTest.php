<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Phpmystic\Pillar\Content\Frontmatter;
use Phpmystic\Pillar\Content\FrontmatterWriter;

/** Saving an entry must not restyle the lines nobody edited. */
final class FrontmatterWriterTest extends TestCase {

	private const ORIGINAL = <<<'MD'
---
title: Git is the store
date: 2026-09-07
tags: [design]
seo:
  title: A custom title
---
Body text.

MD;

	public function test_saving_unchanged_frontmatter_leaves_the_file_byte_identical(): void {
		[ $frontmatter, $body ] = Frontmatter::split( self::ORIGINAL );

		self::assertSame( self::ORIGINAL, FrontmatterWriter::write( self::ORIGINAL, $frontmatter, $body ) );
	}

	public function test_a_changed_key_is_rewritten_and_every_other_line_is_kept(): void {
		[ $frontmatter, $body ] = Frontmatter::split( self::ORIGINAL );

		$frontmatter['tags'] = [ 'design', 'git' ];

		$written = FrontmatterWriter::write( self::ORIGINAL, $frontmatter, $body );

		self::assertStringContainsString( "title: Git is the store\n", $written, 'not re-quoted' );
		self::assertStringContainsString( "date: 2026-09-07\n", $written, 'not re-quoted' );
		self::assertStringContainsString( "tags: [design, git]\n", $written );
		self::assertStringContainsString( "seo:\n  title: A custom title\n", $written, 'a nested block is kept whole' );
	}

	public function test_a_new_key_is_appended_and_a_removed_key_dropped(): void {
		[ $frontmatter, $body ] = Frontmatter::split( self::ORIGINAL );

		unset( $frontmatter['seo'] );
		$frontmatter['draft'] = true;

		$written = FrontmatterWriter::write( self::ORIGINAL, $frontmatter, $body );

		self::assertStringNotContainsString( 'seo:', $written );
		self::assertStringContainsString( "draft: true\n---\n", $written );
		self::assertSame( $frontmatter, Frontmatter::split( $written )[0], 'and it still reads back as written' );
	}

	public function test_a_form_value_that_only_changed_type_is_not_a_change(): void {
		$original = "---\norder: 7\n---\nBody.\n";

		// A number input hands back 7; a text round trip hands back "7".
		self::assertSame( $original, FrontmatterWriter::write( $original, [ 'order' => '7' ], "Body.\n" ) );
	}

	public function test_the_file_ends_with_exactly_one_newline(): void {
		self::assertStringEndsWith( "Body.\n", FrontmatterWriter::write( '', [ 'title' => 'x' ], 'Body.' ) );
		self::assertStringEndsWith( "Body.\n", FrontmatterWriter::write( '', [ 'title' => 'x' ], "Body.\n\n\n" ) );
	}

	public function test_a_new_file_is_written_in_the_usual_style(): void {
		self::assertSame(
			"---\ntitle: 'Hello world'\ntags: [a, b]\ndraft: false\n---\nBody.\n",
			FrontmatterWriter::write( '', [ 'title' => 'Hello world', 'tags' => [ 'a', 'b' ], 'draft' => false ], 'Body.' )
		);
	}
}
