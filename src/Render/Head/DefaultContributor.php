<?php
declare( strict_types=1 );

namespace Pillar\Render\Head;

use Pillar\Render\Drops\PageDrop;

/**
 * The head a site gets with no plugin at all: a title and a description.
 *
 * A layout opts in by printing `{content_for_header}`. Priority 1000 — the
 * last-resort band — so any plugin that emits a title or description wins the
 * key and this one's is dropped; with the SEO plugin off, a page still has a
 * `<title>`, which a page must.
 */
final class DefaultContributor implements HeadContributor {

	public function priority(): int {
		return 1000;
	}

	/** @return list<HeadTag> */
	public function tags( HeadContext $context ): array {
		$page = $context->drop( 'page' );
		$name = (string) $context->setting( 'site_title', $context->site->name );

		$tags = [ HeadTag::title( $page instanceof PageDrop ? $page->title() . ' — ' . $name : $name ) ];

		$description = (string) $context->setting( 'tagline', '' );

		if ( '' !== $description ) {
			$tags[] = HeadTag::meta( 'description', $description );
		}

		if ( $context->preview ) {
			$tags[] = HeadTag::meta( 'robots', 'noindex, nofollow' );
		}

		return $tags;
	}
}
