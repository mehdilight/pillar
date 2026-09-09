<?php
declare( strict_types=1 );

namespace Pillar\Build;

use Pillar\Content\ContentStore;
use Pillar\Content\MarkdownFile;
use Pillar\Site\Site;

/**
 * Every page the site has: its static templates, plus one route per content
 * item.
 *
 * A collection renders through `templates/<collection-singular>.json` when the
 * site has one — `content/posts/*.md` through `templates/post.json` — falling
 * back to `templates/page.json`. Conventional, and overridable per item with
 * `template:` in frontmatter.
 */
final class RouteTable {

	public function __construct(
		private readonly Site $site,
		private readonly ContentStore $content,
	) {}

	/** @return list<Route> */
	public function all(): array {
		$routes    = [];
		$templates = $this->site->layers()->listing( 'templates', 'json' );

		// Content first, so a collection's own index page can still be a static
		// template of the same name without either shadowing the other.
		foreach ( $this->content->files() as $collection => $files ) {
			foreach ( $files as $file ) {
				$template = $this->templateFor( $file, $templates );

				if ( null === $template ) {
					continue;
				}

				$routes[] = new Route(
					url: $file->url(),
					template: $template,
					data: [ 'page' => $this->content->page( $file ), 'post' => $this->content->page( $file ) ],
					source: $file->path,
				);
			}
		}

		foreach ( array_keys( $templates ) as $key ) {
			// Cast: a `404` template comes back as an integer key (see Layers).
			$name = (string) $key;

			// `layout.json` is the layout's own sections, not a page; a content
			// template is rendered per item above, never on its own.
			if ( 'layout' === $name || $this->isContentTemplate( $name ) ) {
				continue;
			}

			$routes[] = new Route( url: $this->urlFor( $name ), template: $name );
		}

		return $routes;
	}

	/** @param array<string, string> $templates */
	private function templateFor( MarkdownFile $file, array $templates ): ?string {
		$declared = (string) ( $file->frontmatter['template'] ?? '' );

		if ( '' !== $declared ) {
			return isset( $templates[ $declared ] ) ? $declared : null;
		}

		foreach ( [ $this->singular( $file->collection ), 'page' ] as $candidate ) {
			if ( isset( $templates[ $candidate ] ) ) {
				return $candidate;
			}
		}

		return null;
	}

	private function isContentTemplate( string $name ): bool {
		foreach ( $this->content->collectionNames() as $collection ) {
			if ( $this->singular( $collection ) === $name ) {
				return true;
			}
		}

		return 'page' === $name;
	}

	private function urlFor( string $name ): string {
		return match ( true ) {
			'index' === $name => '/',
			'404' === $name   => '/404.html',
			default           => '/' . $name . '/',
		};
	}

	private function singular( string $collection ): string {
		return str_ends_with( $collection, 's' ) ? substr( $collection, 0, -1 ) : $collection;
	}
}
