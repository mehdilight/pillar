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
			// Newest first when the collection is dated, by slug otherwise —
			// so a blog reads as a blog without every theme sorting it again.
			usort(
				$files,
				static function ( MarkdownFile $a, MarkdownFile $b ): int {
					$dateA = (string) ( $a->frontmatter['date'] ?? '' );
					$dateB = (string) ( $b->frontmatter['date'] ?? '' );

					return '' !== $dateA || '' !== $dateB ? $dateB <=> $dateA : $a->slug <=> $b->slug;
				}
			);

			$found[ $collection ] = $files;
		}

		ksort( $found );

		return $this->files = $found;
	}

	/** @return list<string> */
	public function collectionNames(): array {
		return array_keys( $this->files() );
	}

	public function collection( string $name ): CollectionDrop {
		return $this->drops[ $name ] ??= new CollectionDrop(
			$name,
			array_map( fn ( MarkdownFile $file ): PageDrop => $this->page( $file ), $this->files()[ $name ] ?? [] )
		);
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

	/** Markdown is converted once per file per build, however many pages read it. */
	public function page( MarkdownFile $file ): PageDrop {
		return $this->pages[ $file->collection . '/' . $file->slug ] ??= new PageDrop(
			$file,
			$this->markdown->convert( $file->body )->getContent()
		);
	}
}
