<?php
declare( strict_types=1 );

namespace Pillar;

use League\CommonMark\CommonMarkConverter;
use League\CommonMark\Event\DocumentParsedEvent;
use Phpmystic\Liqx\Environment;
use Pillar\Content\ContentStore;
use Pillar\Media\AltText;
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
use Pillar\Plugin\PluginLoader;
use Pillar\Plugin\EditorRegistry;
use Pillar\Build\BuildHooks;
use Pillar\Build\RouteRegistry;
use Pillar\Render\Head\HeadRegistry;
use Pillar\Render\Head\DefaultContributor;

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
		public readonly HeadRegistry $head,
		public readonly RouteRegistry $routes,
		public readonly BuildHooks $build,
		public readonly EditorRegistry $editor,
		/** @var list<\Pillar\Plugin\PluginContext> */
		public readonly array $plugins,
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
		$alt      = new AltText( $site );

		$markdown->getEnvironment()->addEventListener( DocumentParsedEvent::class, $alt->fillMarkdownImages( ... ) );

		$content = new ContentStore( $site, $markdown, $drafts );
		$errors = new RenderErrors();
		$head = new HeadRegistry( $errors );
		$head->register( new DefaultContributor() );
		$routes = new RouteRegistry();
		$build = new BuildHooks();
		$editorRegistry = new EditorRegistry();
		$plugins = ( new PluginLoader( $site, $head, $routes, $build, $content, $editorRegistry ) )->load();
		$site->setPluginLayers( PluginLoader::layersOf( $plugins ) );
		foreach ( $plugins as $plugin ) {
			array_push( $extensions, ...$plugin->extensions() );
		}

		$factory = new EnvironmentFactory( $site, $markdown, $alt );
		$factory->extend( ...$extensions );

		[ $environment, $sections, $snippets, $filters, $state ] = $factory->create( $compile );

		$schemas  = new SchemaParser( $site->layers() );
		$renderer = new PageRenderer(
			$site,
			$content,
			$environment,
			new SectionRenderer( $environment, $sections, $schemas, new SettingsCaster(), $errors, $editor ),
			$state,
			$errors,
			$head,
			$editor,
		);

		// Overrides Liqx's own `section()`, which renders a bare file with the
		// current scope. Pillar's sections are configured instances — settings
		// and blocks from `templates/layout.json` — so the name has to resolve
		// through the page renderer rather than straight to a file.
		$environment->registerGlobal(
			'section',
			static fn ( string $name ): string => $renderer->renderLayoutSection( $name )
		);

		return new self( $site, $environment, $content, $renderer, $errors, $filters, $sections, $snippets, $schemas, $head, $routes, $build, $editorRegistry, $plugins );
	}

	/** @param array<string, mixed> $data */
	public function render( string $template, string $route = '/', array $data = [] ): string {
		return $this->renderer->render( $template, $route, $data );
	}
}
