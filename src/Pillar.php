<?php
declare( strict_types=1 );

namespace Pillar;

use League\CommonMark\CommonMarkConverter;
use Phpmystic\Liqx\Environment;
use Pillar\Content\ContentStore;
use Pillar\Render\EnvironmentFactory;
use Pillar\Render\Filters;
use Pillar\Render\LayeredFileSystem;
use Pillar\Render\LiqxExtension;
use Pillar\Render\PageRenderer;
use Pillar\Render\PageState;
use Pillar\Render\RenderErrors;
use Pillar\Render\SectionRenderer;
use Pillar\Schema\SchemaParser;
use Pillar\Schema\SettingsCaster;
use Pillar\Site\Site;

/**
 * The composition root: one site, wired.
 *
 * Everything is constructed once and held, because a build renders hundreds of
 * pages against the same environment, the same content store and the same
 * compiled-template cache. A container would buy nothing here that this does
 * not already give — the graph is a dozen objects and it is all in one method.
 */
final class Pillar {

	private function __construct(
		public readonly Site $site,
		public readonly Environment $environment,
		public readonly ContentStore $content,
		public readonly PageRenderer $renderer,
		public readonly RenderErrors $errors,
		public readonly Filters $filters,
		public readonly LayeredFileSystem $sections,
		public readonly LayeredFileSystem $snippets,
		public readonly SchemaParser $schemas,
	) {}

	/**
	 * @param list<LiqxExtension> $extensions plugin-supplied filters and globals
	 */
	public static function forSite(
		string $root,
		bool $editor = false,
		bool $drafts = false,
		bool $compile = true,
		array $extensions = [],
	): self {
		$site     = Site::load( $root );
		$markdown = new CommonMarkConverter( [ 'html_input' => 'allow', 'allow_unsafe_links' => false ] );

		$factory = new EnvironmentFactory( $site, $markdown );
		$factory->extend( ...$extensions );

		[ $environment, $sections, $snippets, $filters, $state ] = $factory->create( $compile );

		$content  = new ContentStore( $site, $markdown, $drafts );
		$errors   = new RenderErrors();
		$schemas  = new SchemaParser( $site->layers() );
		$renderer = new PageRenderer(
			$site,
			$content,
			$environment,
			new SectionRenderer( $environment, $sections, $schemas, new SettingsCaster(), $errors, $editor ),
			$state,
			$errors,
		);

		// Overrides Liqx's own `section()`, which renders a bare file with the
		// current scope. Pillar's sections are configured instances — settings
		// and blocks from `templates/layout.json` — so the name has to resolve
		// through the page renderer rather than straight to a file.
		$environment->registerGlobal(
			'section',
			static fn ( string $name ): string => $renderer->renderLayoutSection( $name )
		);

		return new self( $site, $environment, $content, $renderer, $errors, $filters, $sections, $snippets, $schemas );
	}

	/** @param array<string, mixed> $data */
	public function render( string $template, string $route = '/', array $data = [] ): string {
		return $this->renderer->render( $template, $route, $data );
	}
}
