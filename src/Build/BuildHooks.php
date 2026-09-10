<?php
declare( strict_types=1 );

namespace Pillar\Build;

/**
 * Where a plugin joins the build.
 *
 * Three moments, which is all the ones core's own sitemap, feed and search
 * index turned out to need — and they are written on this API rather than as
 * privileged internals, because an extension surface that cannot express a
 * sitemap cannot express what a plugin author will want either.
 */
final class BuildHooks {

	/** @var list<callable(): void> */
	private array $before = [];

	/** @var list<callable(string, string): string> */
	private array $each = [];

	/** @var list<callable(BuildManifest): void> */
	private array $after = [];

	/** @param callable(): void $hook */
	public function before( callable $hook ): void {
		$this->before[] = $hook;
	}

	/**
	 * Transform a page's HTML on its way to disk — a minifier, an inliner.
	 *
	 * Called with `(html, url)` and must return the html. Only for pages that
	 * were actually rendered: an incremental build skips the unchanged ones,
	 * and a hook that must see every page belongs in `after()` instead.
	 *
	 * @param callable(string, string): string $hook
	 */
	public function eachPage( callable $hook ): void {
		$this->each[] = $hook;
	}

	/** @param callable(BuildManifest): void $hook */
	public function after( callable $hook ): void {
		$this->after[] = $hook;
	}

	public function runBefore(): void {
		foreach ( $this->before as $hook ) {
			$hook();
		}
	}

	public function runEachPage( string $html, string $url ): string {
		foreach ( $this->each as $hook ) {
			$html = $hook( $html, $url );
		}

		return $html;
	}

	public function runAfter( BuildManifest $manifest ): void {
		foreach ( $this->after as $hook ) {
			$hook( $manifest );
		}
	}
}
