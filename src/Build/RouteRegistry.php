<?php
declare( strict_types=1 );

namespace Pillar\Build;

/**
 * Routes a plugin contributes: a sitemap, a feed, a robots.txt.
 *
 * These are not pages — they have no template and no sections. A contributor
 * gives a URL and a callable that produces the file's contents, and both the
 * build and the dev server go through the same list, so `/sitemap.xml` works
 * in the preview exactly as it will once built.
 */
final class RouteRegistry {

	/** @var array<string, array{url: string, type: string, render: callable(): string}> */
	private array $routes = [];

	/** @var list<callable(): iterable<array{url: string, type: string, render: callable(): string}>> */
	private array $providers = [];

	/**
	 * @param string $url  where it is served, e.g. `/sitemap.xml`
	 * @param string $type its content type
	 * @param callable(): string $render produces the file, lazily — nothing
	 *        calls it until that URL is actually being built or requested
	 */
	public function add( string $url, string $type, callable $render ): void {
		$url = '/' . ltrim( $url, '/' );
		if ( ! preg_match( '#^/(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$#', $url ) ) {
			throw new \Pillar\PillarException( 'Plugin routes must be file URLs without traversal: ' . $url );
		}
		if ( isset( $this->routes[ $url ] ) ) {
			throw new \Pillar\PillarException( 'Duplicate plugin route: ' . $url );
		}

		$this->routes[ $url ] = [ 'url' => $url, 'type' => $type, 'render' => $render ];
	}

	/**
	 * Routes whose URLs are not known until the site is walked.
	 *
	 * A sitemap split into chunks cannot name `/sitemap-3.xml` without first
	 * counting every page — and plugins register on every `pillar dev` API
	 * request, so walking the site at registration made every click in the
	 * dashboard pay for it. A provider runs only when the routes are actually
	 * enumerated: by a build, or by a preview request for a URL no page owns.
	 *
	 * @param callable(): iterable<array{url: string, type: string, render: callable(): string}> $provider
	 */
	public function provide( callable $provider ): void {
		$this->providers[] = $provider;
	}

	/** @return array<string, array{url: string, type: string, render: callable(): string}> */
	public function all(): array {
		$this->resolve();

		return $this->routes;
	}

	/** @return array{url: string, type: string, render: callable(): string}|null */
	public function find( string $url ): ?array {
		$this->resolve();

		return $this->routes[ $url ] ?? $this->routes[ rtrim( $url, '/' ) ] ?? null;
	}

	public function isEmpty(): bool {
		return [] === $this->routes && [] === $this->providers;
	}

	/** Run each provider once, the first time anything asks for routes. */
	private function resolve(): void {
		$providers       = $this->providers;
		$this->providers = [];

		foreach ( $providers as $provider ) {
			foreach ( $provider() as $route ) {
				$this->add( $route['url'], $route['type'], $route['render'] );
			}
		}
	}
}
