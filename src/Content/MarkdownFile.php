<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Content;

/** One `content/<collection>/<slug>.md`, parsed but not yet rendered. */
final class MarkdownFile {

	/** @param array<string, mixed> $frontmatter */
	public function __construct(
		public readonly string $collection,
		public readonly string $slug,
		public readonly array $frontmatter,
		public readonly string $body,
		public readonly string $path,
	) {}

	public static function fromPath( string $path, string $collection ): self {
		$source = (string) file_get_contents( $path );

		[ $frontmatter, $body ] = Frontmatter::split( $source, $path );

		return new self(
			collection: $collection,
			slug: basename( $path, '.md' ),
			frontmatter: $frontmatter,
			body: $body,
			path: $path,
		);
	}

	/**
	 * Where this item is served.
	 *
	 * `pages` is the collection that owns the root — `content/pages/about.md`
	 * is `/about/`, not `/pages/about/`, because that is what a page is.
	 */
	public function url(): string {
		$prefix = 'pages' === $this->collection ? '' : $this->collection . '/';

		return '/' . $prefix . $this->slug . '/';
	}

	public function title(): string {
		return (string) ( $this->frontmatter['title'] ?? $this->slug );
	}

	public function isDraft(): bool {
		return (bool) ( $this->frontmatter['draft'] ?? false );
	}
}
