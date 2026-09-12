<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render;

use Phpmystic\Liqx\Environment;
use Phpmystic\Liqx\Template;
use Phpmystic\Pillar\Content\ContentStore;
use Phpmystic\Pillar\Content\MenuStore;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Render\Drops\SiteDrop;
use Phpmystic\Pillar\Render\Head\HeadContext;
use Phpmystic\Pillar\Render\Head\HeadRegistry;
use Phpmystic\Pillar\Site\Layers;
use Phpmystic\Pillar\Site\Site;
use Phpmystic\Pillar\Template\PageTemplate;
use Phpmystic\Pillar\Template\SectionInstance;

/**
 * A whole page: the page's template JSON, each section rendered, wrapped in
 * the theme's layout.
 *
 * `pillar build` and `pillar dev`'s preview are two callers of this one class.
 * That is what makes the editor's preview honest — it renders through the
 * identical path the build will use, not a lookalike.
 */
final class PageRenderer {

	private readonly Layers $layers;

	public function __construct(
		private readonly Site $site,
		private readonly ContentStore $content,
		private readonly Environment $environment,
		private readonly SectionRenderer $sectionRenderer,
		private readonly PageState $state,
		private readonly RenderErrors $errors,
		private readonly HeadRegistry $head = new HeadRegistry(),
		/** The editor's canvas: contributors that should not run there can tell. */
		private readonly bool $preview = false,
	) {
		$this->layers = $this->site->layers();
	}

	/**
	 * @param array<string, mixed> $data drops particular to this route
	 */
	public function render( string $template, string $route = '/', array $data = [] ): string {
		$settings = $this->settings();
		$page     = $this->template( $template );
		$layout   = $this->layoutTemplate();

		$scope = $data + [
			'site'        => new SiteDrop( $this->site, $settings ),
			'settings'    => $settings,
			'collections' => $this->content->collections(),
			'menus'       => MenuStore::load( $this->site ),
			'template'    => $template,
			'route'       => $route,
		];

		// The `section()` global a layout calls reaches these.
		$this->state->layoutSections = $this->keyed( $layout->sections );
		$this->state->scope          = $scope;
		$this->state->route          = $route;

		$body = '';

		foreach ( $page->enabledSections() as $section ) {
			$body .= $this->sectionRenderer->render( $section, $scope, $route );
		}

		// `{content_for_header}` in a layout is where plugins reach `<head>`.
		// Rendered after the body so a contributor can read anything the
		// sections put in scope.
		$header = $this->head->isEmpty() ? '' : $this->head->render(
			new HeadContext( $this->site, $template, $route, $scope, $settings, $this->preview )
		);

		return $this->renderLayout( $scope + [
			'content_for_layout' => $body,
			'content_for_header' => $header,
		] );
	}

	/** Render one layout section by name — what the `section()` global calls. */
	public function renderLayoutSection( string $name ): string {
		$section = $this->state->layoutSections[ $name ] ?? null;

		if ( null === $section ) {
			// A layout asking for a section the site never configured is not an
			// error: a theme may offer an optional announcement bar.
			return '';
		}

		return $this->sectionRenderer->render( $section, $this->state->scope, $this->state->route );
	}

	/** @param array<string, mixed> $scope */
	private function renderLayout( array $scope ): string {
		$path = $this->layers->resolve( 'layout/theme.liqx' );

		if ( null === $path ) {
			throw new PillarException( 'No layout/theme.liqx in any layer — a site needs a layout.' );
		}

		try {
			return Template::parse( (string) file_get_contents( $path ), $this->environment, 'layout/theme' )
				->render( $scope );
		} catch ( \Throwable $error ) {
			// Unlike a section, a broken layout has no partial output worth
			// shipping — the page would be the error and nothing else.
			throw new PillarException( 'layout/theme.liqx failed to render: ' . $error->getMessage(), 0, $error );
		}
	}

	private function template( string $name ): PageTemplate {
		$path = $this->layers->resolve( 'templates/' . $name . '.json' );

		if ( null === $path ) {
			throw new PillarException( sprintf( 'No templates/%s.json in any layer.', $name ) );
		}

		return PageTemplate::fromFile( $path, $name );
	}

	/**
	 * The layout's own sections — header, footer — which every page shares.
	 *
	 * Missing is fine: a site whose layout writes its header in markup needs no
	 * `templates/layout.json` at all.
	 */
	private function layoutTemplate(): PageTemplate {
		$path = $this->layers->resolve( 'templates/layout.json' );

		return null === $path
			? PageTemplate::fromArray( 'layout', [] )
			: PageTemplate::fromFile( $path, 'layout' );
	}

	/**
	 * @param list<SectionInstance> $sections
	 *
	 * @return array<string, SectionInstance>
	 */
	private function keyed( array $sections ): array {
		$out = [];

		foreach ( $sections as $section ) {
			// Addressed by type, because that is the name a layout writes:
			// `{section('header')}`, not the storage id.
			$out[ $section->type ] = $section;
			$out[ $section->id ]   = $section;
		}

		return $out;
	}

	/** @return array<string, mixed> */
	private function settings(): array {
		$path = $this->layers->resolve( 'config/settings_data.json' );

		if ( null === $path ) {
			return [];
		}

		$raw = json_decode( (string) file_get_contents( $path ), true );

		return is_array( $raw ) ? $raw : [];
	}

	public function errors(): RenderErrors {
		return $this->errors;
	}
}
