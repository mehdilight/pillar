<?php
declare( strict_types=1 );

namespace Pillar\Seo\Head;

use Pillar\Render\Head\HeadContext;
use Pillar\Render\Head\HeadContributor;
use Pillar\Render\Head\HeadTag;
use Pillar\Seo\SeoEngine;

/**
 * One connected schema.org graph per page.
 *
 * Nodes reference each other by `@id` — the page is part of the website, the
 * article's main entity is the page, both are published by the same
 * publisher — which is what search engines actually read, rather than a pile
 * of unrelated fragments. Adapted from bastet's product graph to a
 * general-purpose site: an entry becomes an article node when its collection
 * says it is one (see {@see \Pillar\Seo\SeoSettings::articleType()}).
 */
final class SchemaContributor implements HeadContributor {

	public function __construct( private readonly SeoEngine $seo ) {}

	public function priority(): int {
		return 60;
	}

	/** @return list<HeadTag> */
	public function tags( HeadContext $context ): array {
		$subject = $this->seo->subject( $context );

		// A page nobody should index gets no graph, and a graph needs absolute
		// ids — without a base URL there is nothing honest to point them at.
		if ( $subject->noindex || ! $subject->settings->bool( 'schema_enabled' ) || '' === $subject->canonical ) {
			return [];
		}

		$root      = CanonicalUrl::absolute( $context->site->baseUrl, '/' );
		$publisher = $this->publisher( $subject, $root );

		$webpage = [
			'@type'       => 'WebPage',
			'@id'         => $subject->canonical . '#webpage',
			'url'         => $subject->canonical,
			'name'        => $subject->title,
			'description' => $subject->description,
			'isPartOf'    => [ '@id' => $root . '#website' ],
			'inLanguage'  => (string) ( $context->site->raw['locale'] ?? 'en' ),
		];

		$graph = [
			$publisher,
			[
				'@type'     => 'WebSite',
				'@id'       => $root . '#website',
				'url'       => $root,
				'name'      => $subject->settings->siteName(),
				'publisher' => [ '@id' => $publisher['@id'] ],
			],
		];

		$article = $this->article( $subject, $webpage['@id'], $publisher['@id'] );

		if ( null !== $article ) {
			$webpage['mainEntity'] = [ '@id' => $article['@id'] ];
			$graph[]               = $article;
		}

		$breadcrumb = $this->breadcrumb( $subject );

		if ( null !== $breadcrumb ) {
			$webpage['breadcrumb'] = [ '@id' => $breadcrumb['@id'] ];
			$graph[]               = $breadcrumb;
		}

		$graph[] = $webpage;

		return [ HeadTag::jsonLd( 'graph', [ '@context' => 'https://schema.org', '@graph' => $graph ] ) ];
	}

	/** @return array<string, mixed> */
	private function publisher( PageSubject $subject, string $root ): array {
		$publisher = [
			'@type' => 'Person' === $subject->settings->string( 'organization_type' ) ? 'Person' : 'Organization',
			'@id'   => $root . '#publisher',
			'name'  => $subject->settings->organizationName(),
			'url'   => $root,
		];

		$logo = $subject->settings->string( 'organization_logo' );

		if ( '' !== $logo ) {
			$logoUrl = $this->seo->imageUrl( $logo );

			if ( '' !== $logoUrl ) {
				$publisher['logo'] = [ '@type' => 'ImageObject', 'url' => $logoUrl ];
			}
		}

		return $publisher;
	}

	/** @return array<string, mixed>|null */
	private function article( PageSubject $subject, string $webpageId, string $publisherId ): ?array {
		if ( null === $subject->articleType || null === $subject->page ) {
			return null;
		}

		$article = [
			'@type'            => $subject->articleType,
			'@id'              => $subject->canonical . '#article',
			'headline'         => $subject->page->title(),
			'mainEntityOfPage' => [ '@id' => $webpageId ],
			'publisher'        => [ '@id' => $publisherId ],
		];

		$published = $subject->page->date();

		if ( null !== $published ) {
			$article['datePublished'] = $published;
		}

		$author = $subject->page->beforeMethod( 'author' );

		if ( is_string( $author ) && '' !== $author ) {
			$article['author'] = [ '@type' => 'Person', 'name' => $author ];
		}

		if ( '' !== $subject->image ) {
			$article['image'] = $subject->image;
		}

		return $article;
	}

	/** @return array<string, mixed>|null */
	private function breadcrumb( PageSubject $subject ): ?array {
		$items = [];

		foreach ( $subject->breadcrumbs() as $index => $crumb ) {
			$items[] = [ '@type' => 'ListItem', 'position' => $index + 1, 'name' => $crumb['name'], 'item' => $crumb['url'] ];
		}

		if ( [] === $items ) {
			return null;
		}

		return [
			'@type'           => 'BreadcrumbList',
			'@id'             => $subject->canonical . '#breadcrumb',
			'itemListElement' => $items,
		];
	}
}
