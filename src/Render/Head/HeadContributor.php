<?php
declare( strict_types=1 );

namespace Pillar\Render\Head;

/**
 * Something that wants tags in `<head>`.
 *
 * The surface an SEO plugin lives on. A contributor is handed the page and
 * returns tags; it never renders markup and never sees the response.
 */
interface HeadContributor {

	/** @return list<HeadTag> */
	public function tags( HeadContext $context ): array;

	/**
	 * Lower runs first, and running first means winning a contested key.
	 *
	 * 0–99 for a site's own defaults, 100 for a plugin, 900+ for a last-resort
	 * fallback that should only apply when nothing else claimed the tag.
	 */
	public function priority(): int;
}
