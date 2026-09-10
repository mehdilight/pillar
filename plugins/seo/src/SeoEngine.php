<?php
declare( strict_types=1 );

namespace Pillar\Seo;

use Phpmystic\Liqx\Environment;
use Pillar\Render\Head\HeadContext;
use Pillar\Render\LiqxExtension;
use Pillar\Seo\Head\CanonicalUrl;
use Pillar\Seo\Head\PageSubject;

/**
 * The resolver every surface shares — the head contributors, the sitemap, and
 * the `seo_breadcrumbs()` a theme can call.
 *
 * It is also a Liqx extension, which is how it gets hold of the environment's
 * `asset_url` filter: a social image or a logo given as `uploads/card.png` has
 * to become the hashed URL the build actually wrote, and only the filter knows
 * that mapping.
 */
final class SeoEngine implements LiqxExtension {

	private ?Environment $environment = null;

	public function __construct( public readonly SeoSettings $settings ) {}

	public function subject( HeadContext $context ): PageSubject {
		return new PageSubject( $context, $this->settings, $this->environment?->filter( 'asset_url' ), $this->environment?->filter( 'image_alt' ) );
	}

	/** An image setting — an asset path or a URL — as an absolute URL, or `''`. */
	public function imageUrl( string $image ): string {
		$filter = $this->environment?->filter( 'asset_url' );

		if ( '' !== $image && null === parse_url( $image, PHP_URL_SCHEME ) && ! str_starts_with( $image, '//' ) && null !== $filter ) {
			$image = $filter( $image );
		}

		return CanonicalUrl::absolute( $this->settings->site->baseUrl, $image );
	}

	public function extend( Environment $environment ): void {
		$this->environment = $environment;

		// The visible trail, for a theme that wants one where it chooses —
		// the same crumbs the BreadcrumbList node describes, so the markup and
		// the structured data cannot drift apart.
		$environment->registerGlobal( 'seo_breadcrumbs', function ( mixed $page = null, string $url = '/' ): string {
			$subject = $this->subject( new HeadContext( $this->settings->site, 'page', $url, [ 'page' => $page ] ) );
			$items   = $subject->breadcrumbs();

			if ( [] === $items ) {
				return '';
			}

			$html = '<nav aria-label="Breadcrumb"><ol class="seo-breadcrumbs">';
			$last = count( $items ) - 1;

			foreach ( $items as $index => $item ) {
				$name = htmlspecialchars( $item['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );

				$html .= $index === $last
					? '<li aria-current="page">' . $name . '</li>'
					: '<li><a href="' . htmlspecialchars( $item['url'] ?: '/', ENT_QUOTES ) . '">' . $name . '</a></li>';
			}

			return $html . '</ol></nav>';
		} );
	}
}
