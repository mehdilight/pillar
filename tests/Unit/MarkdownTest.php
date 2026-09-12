<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Tests\SiteTestCase;

/** The markdown the dashboard's editor writes is the markdown the site reads. */
final class MarkdownTest extends SiteTestCase {

	public function test_tables_strikethrough_autolinks_and_task_lists_render(): void {
		$html = $this->pillar()->filters->all()['markdownify'](
			"| Need | Git |\n| --- | --- |\n| draft | working tree |\n\n~~gone~~ and https://example.com\n\n- [x] done\n- [ ] todo\n"
		);

		self::assertStringContainsString( '<table>', $html );
		self::assertStringContainsString( '<td>working tree</td>', $html );
		self::assertStringContainsString( '<del>gone</del>', $html );
		self::assertStringContainsString( '<a href="https://example.com">https://example.com</a>', $html );
		self::assertStringContainsString( 'type="checkbox"', $html );
	}

	public function test_raw_html_such_as_an_embed_is_kept(): void {
		$html = $this->pillar()->filters->all()['markdownify']( "<iframe src=\"https://www.youtube-nocookie.com/embed/x\"></iframe>\n" );

		self::assertStringContainsString( '<iframe', $html );
	}
}
