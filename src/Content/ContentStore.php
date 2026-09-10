<?php
declare( strict_types=1 );

namespace Pillar\Content;

use League\CommonMark\CommonMarkConverter;
use Pillar\Render\Drops\CollectionDrop;
use Pillar\Render\Drops\PageDrop;
use Pillar\Site\Site;

/**
 * Every markdown file in the site, grouped by collection.
 *
 * Read once per build and held: a 500-page site asks for `collections.posts`
 * on every one of those pages, and re-walking the directory each time is the
 * difference between a fast build and a slow one.
 *
 * Content need not come from disk — `ContentSourceRegistry` (docs/backend.md
 * §10.1) will contribute items from a plugin into the same collections. The
 * merge point is `collections()`, which is why it takes the sources rather
 * than globbing inline.
 */
final class ContentStore {

	/** @var array<string, list<MarkdownFile>>|null */
	private ?array $files = null;

	/** @var array<string, CollectionDrop> */
	private array $drops = [];

	/** @var array<string, PageDrop> */
	private array $pages = [];

	/** @var list<callable(string): void> */
	private array $listeners = [];

	public function __construct(
		private readonly Site $site,
		private readonly CommonMarkConverter $markdown,
		/** Drafts render locally and are skipped in a production build. */
		private readonly bool $includeDrafts = false,
	) {}

	/** @return array<string, list<MarkdownFile>> */
	public function files(): array {
		if ( null !== $this->files ) {
			return $this->files;
		}

		$found = [];
		$root  = $this->site->absolute( 'content' );

		foreach ( glob( $root . '/*', GLOB_ONLYDIR ) ?: [] as $directory ) {
			$collection = basename( $directory );

			foreach ( glob( $directory . '/*.md' ) ?: [] as $path ) {
				$file = MarkdownFile::fromPath( $path, $collection );

				if ( $file->isDraft() && ! $this->includeDrafts ) {
					continue;
				}

				$found[ $collection ][] = $file;
			}
		}

		foreach ( $found as $collection => $files ) {
			usort( $files, self::order( ... ) );

			$found[ $collection ] = $files;
		}

		ksort( $found );

		return $this->files = $found;
	}

	/**
	 * The order a collection reads in, without every template sorting it again.
	 *
	 * An explicit `order:` wins — documentation is a sequence, and sorting it
	 * alphabetically puts "Getting started" in the middle. Otherwise newest
	 * first when the collection is dated, which is what a blog wants, and by
	 * slug when it is neither.
	 */
	private static function order( MarkdownFile $a, MarkdownFile $b ): int {
		$orderA = $a->frontmatter['order'] ?? null;
		$orderB = $b->frontmatter['order'] ?? null;

		if ( null !== $orderA || null !== $orderB ) {
			// An entry with no position sorts after every entry that has one,
			// rather than jumping to the front as a zero would.
			return ( $orderA ?? PHP_INT_MAX ) <=> ( $orderB ?? PHP_INT_MAX );
		}

		$dateA = (string) ( $a->frontmatter['date'] ?? '' );
		$dateB = (string) ( $b->frontmatter['date'] ?? '' );

		return '' !== $dateA || '' !== $dateB ? $dateB <=> $dateA : $a->slug <=> $b->slug;
	}

	/** @return list<string> */
	public function collectionNames(): array {
		return array_keys( $this->files() );
	}

	public function collection( string $name ): CollectionDrop {
		return $this->drops[ $name ] ??= new CollectionDrop(
			$name,
			array_map( fn ( MarkdownFile $file ): PageDrop => $this->page( $file ), $this->files()[ $name ] ?? [] ),
			function ( string $collection ): void {
				foreach ( $this->listeners as $listener ) {
					$listener( $collection );
				}
			}
		);
	}

	/**
	 * Called with a collection's name whenever a template reads it.
	 *
	 * The seam the build's dependency recorder hooks, exactly as it hooks the
	 * file system for templates.
	 *
	 * @param callable(string): void $listener
	 */
	public function listen( callable $listener ): void {
		$this->listeners[] = $listener;
	}

	/**
	 * A collection's identity: which entries it has, and what each one says.
	 *
	 * Membership and content together, so adding, removing, renaming or
	 * editing any entry changes it — each of those changes what a listing
	 * page shows.
	 */
	public function hash( string $name ): string {
		$parts = [];

		foreach ( $this->files()[ $name ] ?? [] as $file ) {
			$parts[] = $file->path . ':' . \Pillar\Build\FileHash::of( $file->path );
		}

		sort( $parts );

		return md5( $name . '|' . implode( '|', $parts ) );
	}

	/** @return array<string, CollectionDrop> */
	public function collections(): array {
		$out = [];

		foreach ( $this->collectionNames() as $name ) {
			$out[ $name ] = $this->collection( $name );
		}

		return $out;
	}

	public function find( string $collection, string $slug ): ?MarkdownFile {
		foreach ( $this->files()[ $collection ] ?? [] as $file ) {
			if ( $file->slug === $slug ) {
				return $file;
			}
		}

		return null;
	}

	/**
	 * A page built from content that is not on disk yet — the editor's preview
	 * of what is being typed.
	 *
	 * Never cached, and deliberately not `page()`: that one memoizes by
	 * collection and slug, so previewing an edit to an existing entry would
	 * hand back the saved version the moment anything had already read it.
	 */
	public function unsaved( MarkdownFile $file ): PageDrop {
		return new PageDrop( $file, $this->markdown->convert( $file->body )->getContent() );
	}

	/** Markdown is converted once per file per build, however many pages read it. */
	public function page( MarkdownFile $file ): PageDrop {
		return $this->pages[ $file->collection . '/' . $file->slug ] ??= new PageDrop(
			$file,
			$this->markdown->convert( $file->body )->getContent()
		);
	}
}
