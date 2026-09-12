<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Seo;

use Phpmystic\Pillar\Build\RouteTable;
use Phpmystic\Pillar\Plugin\PluginContext;
use Phpmystic\Pillar\Render\Head\HeadContext;
use Phpmystic\Pillar\Seo\Head\CanonicalUrl;

/**
 * `/sitemap.xml` — and, past the page-size limit, `/sitemap-N.xml` behind an
 * index.
 *
 * Registered as a *provider*, not as routes: how many chunk files exist depends
 * on how many pages the site has, and finding that out means walking every
 * route. Plugins register on every `pillar dev` API request, so doing that walk
 * at registration made every click in the dashboard pay for a sitemap nobody
 * had asked for. The provider runs only when a build writes the files or the
 * preview is asked for one.
 *
 * The preview serves the same callbacks the build writes, so the sitemap seen
 * in `pillar dev` is the one that ships.
 */
final class Sitemap {

	private const TYPE = 'application/xml; charset=utf-8';

	/** @var list<array{url: string, modified: string}>|null */
	private ?array $urls = null;

	public function __construct(
		private readonly PluginContext $context,
		private readonly SeoEngine $seo,
	) {}

	public function register(): void {
		// A sitemap is a list of absolute URLs; with no base URL there is
		// nothing honest to list.
		if ( ! $this->seo->settings->bool( 'sitemap_enabled' ) || '' === CanonicalUrl::absolute( $this->context->site->baseUrl, '/' ) ) {
			return;
		}

		$this->context->routes->provide( fn (): array => $this->routes() );
	}

	/**
	 * Every indexable page: not a draft, not noindex, not a 404, and not a page
	 * whose canonical points elsewhere — listing a URL that says "I am really
	 * that other one" is a contradiction search engines report.
	 *
	 * @return list<array{url: string, modified: string}>
	 */
	public function urls(): array {
		if ( null !== $this->urls ) {
			return $this->urls;
		}

		$out = [];

		foreach ( ( new RouteTable( $this->context->site, $this->context->content ) )->all() as $route ) {
			$subject = $this->seo->subject( new HeadContext( $this->context->site, $route->template, $route->url, $route->data ) );
			$own     = CanonicalUrl::resolve( $this->context->site->baseUrl, $route->url );

			if ( $subject->noindex || '' === $subject->canonical || $subject->canonical !== $own ) {
				continue;
			}

			// The author's date, which is stable across clones — a checkout's
			// file mtime is not, and would churn every sitemap on every clone.
			$date = (string) ( $subject->page?->beforeMethod( 'updated_at' ) ?: $subject->page?->date() ?? '' );

			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}(?:T.*)?$/', $date ) ) {
				$date = '';
			}

			$out[ $own ] = [ 'url' => $own, 'modified' => $date ];
		}

		ksort( $out );

		return $this->urls = array_values( $out );
	}

	/** @return list<array{url: string, type: string, render: callable(): string}> */
	private function routes(): array {
		$size   = max( 1, min( 50000, (int) $this->seo->settings->get( 'sitemap_page_size' ) ) );
		$chunks = array_chunk( $this->urls(), $size );

		if ( count( $chunks ) <= 1 ) {
			return [ [ 'url' => '/sitemap.xml', 'type' => self::TYPE, 'render' => fn (): string => $this->urlset( $this->urls() ) ] ];
		}

		$routes = [];
		$maps   = [];

		foreach ( $chunks as $index => $chunk ) {
			$url      = '/sitemap-' . ( $index + 1 ) . '.xml';
			$maps[]   = CanonicalUrl::absolute( $this->context->site->baseUrl, $url );
			$routes[] = [ 'url' => $url, 'type' => self::TYPE, 'render' => fn (): string => $this->urlset( $chunk ) ];
		}

		$routes[] = [ 'url' => '/sitemap.xml', 'type' => self::TYPE, 'render' => static fn (): string => self::index( $maps ) ];

		return $routes;
	}

	/** @param list<array{url: string, modified: string}> $urls */
	private function urlset( array $urls ): string {
		$xml = self::declaration() . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

		foreach ( $urls as $entry ) {
			$xml .= '<url><loc>' . self::escape( $entry['url'] ) . '</loc>';

			if ( '' !== $entry['modified'] ) {
				$xml .= '<lastmod>' . self::escape( $entry['modified'] ) . '</lastmod>';
			}

			$xml .= '</url>';
		}

		return $xml . '</urlset>';
	}

	/** @param list<string> $maps */
	private static function index( array $maps ): string {
		$xml = self::declaration() . '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

		foreach ( $maps as $url ) {
			$xml .= '<sitemap><loc>' . self::escape( $url ) . '</loc></sitemap>';
		}

		return $xml . '</sitemapindex>';
	}

	private static function declaration(): string {
		return '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
	}

	private static function escape( string $value ): string {
		return htmlspecialchars( $value, ENT_XML1 | ENT_QUOTES, 'UTF-8' );
	}
}
