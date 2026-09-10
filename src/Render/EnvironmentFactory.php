<?php
declare( strict_types=1 );

namespace Pillar\Render;

use League\CommonMark\CommonMarkConverter;
use Pillar\Media\AltText;
use Phpmystic\Liqx\Environment;
use Pillar\Site\Site;

/**
 * Builds the Liqx environment a site renders against: its filters, its
 * globals, the layered file systems, and the compiled-template cache.
 *
 * One environment per build, not per page — `setCompiledTemplateDir()` is what
 * makes a 500-page build take seconds instead of minutes, and its in-memory
 * half only pays off when the environment survives more than one render.
 */
final class EnvironmentFactory {

	/** @var list<LiqxExtension> */
	private array $extensions = [];

	public function __construct(
		private readonly Site $site,
		private readonly CommonMarkConverter $markdown,
		private readonly ?AltText $alt = null,
	) {}

	/**
	 * Extensions are applied last, so a plugin re-registering a built-in filter
	 * name overrides it. Deliberate, and a real footgun — allowed for the same
	 * reason a plugin may run arbitrary PHP: it is your machine and your site.
	 */
	public function extend( LiqxExtension ...$extensions ): void {
		array_push( $this->extensions, ...$extensions );
	}

	/**
	 * @return array{Environment, LayeredFileSystem, LayeredFileSystem, Filters, PageState}
	 */
	public function create( bool $compile = true ): array {
		$layers   = $this->site->layers();
		$sections = new LayeredFileSystem( $layers, 'sections' );
		// A component tag resolves as a snippet first, then as a block file —
		// which is what lets `<Feature />` mean `blocks/feature.liqx`.
		$snippets = new LayeredFileSystem( $layers, 'snippets', 'blocks' );

		$environment = Environment::create();
		$filters     = new Filters( $this->site, $this->markdown, $this->alt ?? new AltText( $this->site ) );
		$state       = new PageState();

		foreach ( $filters->all() as $name => $filter ) {
			$environment->registerFilter( $name, $filter );
		}

		$environment->setSnippetFileSystem( $snippets );
		$environment->setSectionFileSystem( $sections );

		if ( $compile ) {
			$environment->setCompiledTemplateDir( $this->site->cacheDir() . '/compiled' );
		}

		foreach ( $this->extensions as $extension ) {
			$extension->extend( $environment );
		}

		return [ $environment, $sections, $snippets, $filters, $state ];
	}
}
