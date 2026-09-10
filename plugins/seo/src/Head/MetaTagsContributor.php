<?php
declare( strict_types=1 );

namespace Pillar\Seo\Head;

use Pillar\Render\Head\HeadContext;
use Pillar\Render\Head\HeadContributor;
use Pillar\Render\Head\HeadTag;
use Pillar\Seo\SeoEngine;

/**
 * Title, description, robots, canonical, Open Graph and Twitter — as one
 * contributor, the way bastet's port had it.
 *
 * One class rather than one per tag because they all answer the same question
 * (what is this page, and what did the author override), and splitting them
 * would resolve that repeatedly. `og:title` falling back to the meta title is
 * the behaviour, not an accident of ordering, and it reads plainly here.
 */
final class MetaTagsContributor implements HeadContributor {

	public function __construct( private readonly SeoEngine $seo ) {}

	public function priority(): int {
		// Below the plugin default of 100: this is the plugin's own core output,
		// and a more specific plugin layered on top should be able to take a
		// field from it. Above the site's DefaultContributor at 1000.
		return 50;
	}

	/** @return list<HeadTag> */
	public function tags( HeadContext $context ): array {
		$subject = $this->seo->subject( $context );

		$tags = [
			HeadTag::title( $subject->title ),
			HeadTag::meta( 'robots', ( $subject->noindex ? 'noindex' : 'index' ) . ', ' . ( $subject->nofollow ? 'nofollow' : 'follow' ) ),
		];

		if ( '' !== $subject->description ) {
			$tags[] = HeadTag::meta( 'description', $subject->description );
		}

		// The editor's canvas: a title and noindex, and nothing that would point
		// a crawler or a share card at a preview URL.
		if ( $context->preview ) {
			return $tags;
		}

		if ( '' !== $subject->canonical ) {
			$tags[] = HeadTag::link( 'canonical', $subject->canonical );
			$tags[] = HeadTag::property( 'og:url', $subject->canonical );
		}

		return array_merge( $tags, $this->social( $subject ) );
	}

	/** @return list<HeadTag> */
	private function social( PageSubject $subject ): array {
		$tags = [
			HeadTag::property( 'og:type', $subject->isArticle() ? 'article' : 'website' ),
			HeadTag::property( 'og:site_name', $subject->settings->siteName() ),
			HeadTag::property( 'og:title', $subject->socialTitle() ),
			HeadTag::meta( 'twitter:title', $subject->socialTitle() ),
		];

		if ( '' !== $subject->socialDescription() ) {
			$tags[] = HeadTag::property( 'og:description', $subject->socialDescription() );
			$tags[] = HeadTag::meta( 'twitter:description', $subject->socialDescription() );
		}

		if ( '' !== $subject->image ) {
			$tags[] = HeadTag::property( 'og:image', $subject->image );
			$tags[] = HeadTag::meta( 'twitter:image', $subject->image );
		}

		$tags[] = HeadTag::meta( 'twitter:card', '' !== $subject->image ? 'summary_large_image' : 'summary' );

		$twitter = $subject->settings->string( 'twitter_site' );

		if ( '' !== $twitter ) {
			$tags[] = HeadTag::meta( 'twitter:site', '@' . ltrim( $twitter, '@' ) );
		}

		$published = $subject->page?->date();

		if ( $subject->isArticle() && null !== $published ) {
			$tags[] = HeadTag::property( 'article:published_time', $published );
		}

		return $tags;
	}
}
