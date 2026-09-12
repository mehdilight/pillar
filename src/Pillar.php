<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar;

use League\CommonMark\Event\DocumentParsedEvent;
use Phpmystic\Liqx\Environment;
use Phpmystic\Pillar\Content\ContentStore;
use Phpmystic\Pillar\Media\AltText;
use Phpmystic\Pillar\Media\ImageConfig;
use Phpmystic\Pillar\Media\Images;
use Phpmystic\Pillar\Render\EnvironmentFactory;
use Phpmystic\Pillar\Render\Filters;
use Phpmystic\Pillar\Render\LayeredFileSystem;
use Phpmystic\Pillar\Render\LiqxExtension;
use Phpmystic\Pillar\Render\PageRenderer;
use Phpmystic\Pillar\Render\PageState;
use Phpmystic\Pillar\Render\RenderErrors;
use Phpmystic\Pillar\Render\SectionRenderer;
use Phpmystic\Pillar\Schema\SchemaParser;
use Phpmystic\Pillar\Schema\SettingsCaster;
use Phpmystic\Pillar\Site\Site;
use Phpmystic\Pillar\Plugin\PluginLoader;
use Phpmystic\Pillar\Plugin\EditorRegistry;
use Phpmystic\Pillar\Build\BuildHooks;
use Phpmystic\Pillar\Build\RouteRegistry;
use Phpmystic\Pillar\Render\Head\HeadRegistry;
use Phpmystic\Pillar\Render\Head\DefaultContributor;

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
		/** @var list<\Phpmystic\Pillar\Plugin\PluginContext> */
		public readonly array $plugins,
		public readonly Images $images,
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
		$markdown = \Phpmystic\Pillar\Content\Markdown::converter();
		$alt      = new AltText( $site );
		$images   = new Images( $site, ImageConfig::fromSite( $site ) );

		$markdown->getEnvironment()->addEventListener( DocumentParsedEvent::class, $alt->fillMarkdownImages( ... ) );
		$markdown->getEnvironment()->addEventListener( DocumentParsedEvent::class, $images->fillMarkdownImages( ... ) );

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

		$factory = new EnvironmentFactory( $site, $markdown, $alt, $images );
		$factory->extend( ...$extensions );

		[ $environment, $sections, $snippets, $filters, $state ] = $factory->create( $compile );

		$schemas  = new SchemaParser( $site->layers() );
		$renderer = new PageRenderer(
			$site,
			$content,
			$environment,
			new SectionRenderer( $environment, $sections, $schemas, new SettingsCaster( $content ), $errors, $editor ),
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

		return new self( $site, $environment, $content, $renderer, $errors, $filters, $sections, $snippets, $schemas, $head, $routes, $build, $editorRegistry, $plugins, $images );
	}

	/** @param array<string, mixed> $data */
	public function render( string $template, string $route = '/', array $data = [] ): string {
		return $this->renderer->render( $template, $route, $data );
	}
}
