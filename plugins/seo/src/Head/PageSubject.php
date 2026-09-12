<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Seo\Head;

use Phpmystic\Pillar\Render\Drops\PageDrop;
use Phpmystic\Pillar\Render\Drops\PaginateDrop;
use Phpmystic\Pillar\Render\Head\HeadContext;
use Phpmystic\Pillar\Seo\Replacements;
use Phpmystic\Pillar\Seo\SeoSettings;

/**
 * One page's resolved SEO values.
 *
 * Every output surface — the head tags, the JSON-LD graph, the sitemap, the
 * editor's search preview — reads this, so they cannot disagree about what a
 * page's title is. Resolution for every field is the same three steps: the
 * entry's own `seo:` override, then its collection's pattern with this page's
 * variables filled in, then nothing. A blank tag is never better than none.
 */
final class PageSubject {

	public readonly ?PageDrop $page;

	/** The entry's `seo:` frontmatter, over any per-URL override. @var array<string, mixed> */
	public readonly array $meta;

	/** The entry's collection, or null for a page that is a template rather than content. */
	public readonly ?string $collection;

	/** `home`, `page`, or a collection name — what the patterns are keyed by. */
	public readonly string $type;

	/** The schema.org type this is, when it is a piece of writing rather than a page. */
	public readonly ?string $articleType;

	public readonly string $title;

	public readonly string $description;

	public readonly string $canonical;

	public readonly string $image;

	/** The sharing image's alt text, from the site's media library — `''` when it has none. */
	public readonly string $imageAlt;

	public readonly bool $noindex;

	public readonly bool $nofollow;

	public readonly Replacements $replacements;

	/**
	 * @param (callable(string): string)|null $assetUrl resolves a theme asset to its built URL
	 * @param (callable(string): string)|null $imageAlt the media library's alt text for an image
	 */
	public function __construct(
		public readonly HeadContext $context,
		public readonly SeoSettings $settings,
		?callable $assetUrl = null,
		?callable $imageAlt = null,
	) {
		$drop       = $context->drop( 'page' );
		$this->page = $drop instanceof PageDrop ? $drop : null;
		$this->meta = (array) $this->page?->beforeMethod( 'seo' ) + $settings->routeMeta( $context->url );

		$this->collection = $this->page?->collection();
		$this->type       = match ( true ) {
			'/' === $context->url     => 'home',
			null === $this->collection => 'page',
			default                    => $this->collection,
		};
		$this->articleType = null === $this->collection
			? null
			: $settings->articleType( $this->collection, null !== $this->page?->date() );

		$this->replacements = new Replacements( $this->variables() );

		$fallbackTitle = $this->pageTitle();

		$this->title       = $this->replacements->apply( $this->string( 'title' ) ?: $settings->pattern( 'title', $this->type ) ) ?: $fallbackTitle;
		$this->description = $this->replacements->apply( $this->descriptionPattern() );
		$this->canonical   = CanonicalUrl::resolve( $context->site->baseUrl, $context->url, $this->string( 'canonical' ) );
		$this->image       = $this->resolveImage( $assetUrl );
		$this->imageAlt    = '' !== $this->image && null !== $imageAlt ? trim( (string) $imageAlt( $this->imageSource() ) ) : '';

		// The editor's canvas, a 404 and a draft are not pages anyone should
		// find through a search engine, whatever the settings say.
		$this->noindex = $context->preview
			|| '404' === $context->template
			|| ( $this->page?->draft() ?? false )
			|| filter_var( $this->meta['noindex'] ?? false, FILTER_VALIDATE_BOOLEAN );

		$this->nofollow = $context->preview || filter_var( $this->meta['nofollow'] ?? false, FILTER_VALIDATE_BOOLEAN );
	}

	/** A string from the entry's own `seo:` overrides. */
	public function string( string $key ): string {
		$value = $this->meta[ $key ] ?? '';

		return is_scalar( $value ) ? trim( (string) $value ) : '';
	}

	public function isArticle(): bool {
		return null !== $this->articleType;
	}

	public function socialTitle(): string {
		return $this->string( 'og_title' ) ?: $this->title;
	}

	public function socialDescription(): string {
		return $this->string( 'og_description' ) ?: $this->description;
	}

	/**
	 * Home → this page. Two levels on purpose: a collection has no index page
	 * of its own unless a site builds one, and a crumb pointing at nothing is
	 * worse than a shorter trail.
	 *
	 * @return list<array{name: string, url: string}>
	 */
	public function breadcrumbs(): array {
		if ( '/' === $this->context->url || ! $this->settings->bool( 'breadcrumbs_enabled' ) ) {
			return [];
		}

		return [
			[ 'name' => $this->settings->siteName(), 'url' => CanonicalUrl::absolute( $this->context->site->baseUrl, '/' ) ],
			[ 'name' => $this->page?->title() ?? $this->title, 'url' => $this->canonical ],
		];
	}

	/** @return array<string, string> */
	private function variables(): array {
		$excerpt = (string) (
			$this->page?->beforeMethod( 'summary' )
			?: $this->page?->beforeMethod( 'description' )
			?: $this->page?->excerpt()
			?? ''
		);

		$pagination = $this->context->drop( 'paginate' );
		$number     = $pagination instanceof PaginateDrop ? $pagination->currentPage() : 1;

		return [
			'title'       => $this->pageTitle(),
			'sitename'    => $this->settings->siteName(),
			'sep'         => $this->settings->string( 'separator' ),
			'tagline'     => $this->settings->tagline(),
			'excerpt'     => Replacements::truncate( $excerpt, 155 ),
			// Empty on page one, so `%%title%% %%page%%` does not read "Blog 1".
			'page'        => $number > 1 ? (string) $number : '',
			'currentyear' => date( 'Y' ),
			'currentdate' => date( 'Y-m-d' ),
		];
	}

	private function pageTitle(): string {
		if ( null !== $this->page ) {
			return $this->page->title();
		}

		return 'home' === $this->type
			? $this->settings->siteName()
			: ucfirst( str_replace( [ '-', '_' ], ' ', $this->context->template ) );
	}

	private function descriptionPattern(): string {
		$own = $this->string( 'description' );

		if ( '' !== $own ) {
			return $own;
		}

		// A plain home description is a sentence, not a pattern, and wins when
		// the site has written one.
		if ( 'home' === $this->type && '' !== $this->settings->string( 'home_description' ) ) {
			return $this->settings->string( 'home_description' );
		}

		return $this->settings->pattern( 'description', $this->type );
	}

	/** The sharing image as written — the entry's override, its own image, or the site default. */
	private function imageSource(): string {
		return $this->string( 'og_image' )
			?: (string) ( $this->page?->beforeMethod( 'image' ) ?: $this->settings->string( 'social_image' ) );
	}

	/** @param (callable(string): string)|null $assetUrl */
	private function resolveImage( ?callable $assetUrl ): string {
		$image = $this->imageSource();

		// A bare asset path goes through `asset_url`, so a shared card points at
		// the hashed file the build actually wrote.
		if ( '' !== $image && null === parse_url( $image, PHP_URL_SCHEME ) && ! str_starts_with( $image, '//' ) && null !== $assetUrl ) {
			$image = $assetUrl( $image );
		}

		return CanonicalUrl::absolute( $this->context->site->baseUrl, $image );
	}
}
