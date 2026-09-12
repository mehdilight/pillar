<?php
declare( strict_types=1 );

namespace Pillar\Content;

use League\CommonMark\CommonMarkConverter;
use League\CommonMark\Extension\Autolink\AutolinkExtension;
use League\CommonMark\Extension\Strikethrough\StrikethroughExtension;
use League\CommonMark\Extension\Table\TableExtension;
use League\CommonMark\Extension\TaskList\TaskListExtension;

/**
 * The one markdown dialect Pillar renders: CommonMark with GitHub's tables,
 * strikethrough, autolinks and task lists.
 *
 * The dashboard's content editor writes tables and `~~strikethrough~~`, so
 * the site must read them — CommonMark alone printed a table as rows of
 * pipes. Not the whole GitHub-flavoured extension: that one also strips raw
 * HTML like `<iframe>`, and an embedded video in markdown is a thing people
 * reasonably write. Raw HTML stays allowed; unsafe link schemes do not.
 */
final class Markdown {

	public static function converter(): CommonMarkConverter {
		$converter = new CommonMarkConverter( [ 'html_input' => 'allow', 'allow_unsafe_links' => false ] );

		$converter->getEnvironment()
			->addExtension( new TableExtension() )
			->addExtension( new StrikethroughExtension() )
			->addExtension( new AutolinkExtension() )
			->addExtension( new TaskListExtension() );

		return $converter;
	}
}
