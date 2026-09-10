<?php
declare( strict_types=1 );

namespace Pillar\Build;

/** One page the build will write. */
final class Route {

	/** @param array<string, mixed> $data drops particular to this route */
	public function __construct(
		public readonly string $url,
		public readonly string $template,
		public readonly array $data = [],
		/** The content file behind this route, when there is one. */
		public readonly ?string $source = null,
		/**
		 * Collections this route read before rendering — a paginated listing
		 * slices its collection in the route table, where no recorder is
		 * listening, so it declares the dependency itself.
		 *
		 * @var list<string>
		 */
		public readonly array $collections = [],
	) {}

	/**
	 * Where the file lands.
	 *
	 * Directory-index form — `/about/` is `about/index.html` — so the site
	 * serves the same URLs on every host, and it is the deploy adapter's
	 * config, not the renderer, that reconciles a host's URL policy.
	 */
	public function outputPath(): string {
		$path = trim( $this->url, '/' );

		if ( str_ends_with( $this->url, '.html' ) || str_ends_with( $this->url, '.xml' ) ) {
			return $path;
		}

		return '' === $path ? 'index.html' : $path . '/index.html';
	}
}
