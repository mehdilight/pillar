<?php
declare( strict_types=1 );

namespace Pillar\Content;

use League\CommonMark\CommonMarkConverter;
use Pillar\Render\Drops\CollectionDrop;
use Pillar\Render\Drops\PageDrop;
use Pillar\Schema\ContentSchema;
use Pillar\Schema\FieldType;
use Pillar\Schema\Setting;
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

	/** @var array<string, ContentSchema>|null */
	private ?array $schemas = null;

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
		return new PageDrop( $file, $this->markdown->convert( $file->body )->getContent(), $this->augmenter( $file->collection ) );
	}

	/** Markdown is converted once per file per build, however many pages read it. */
	public function page( MarkdownFile $file ): PageDrop {
		return $this->pages[ $file->collection . '/' . $file->slug ] ??= new PageDrop(
			$file,
			$this->markdown->convert( $file->body )->getContent(),
			$this->augmenter( $file->collection )
		);
	}

	/**
	 * An entry, by reference — recorded as a read of its collection, so a
	 * page showing a related post is rebuilt when that post changes. A draft
	 * is not found in a production build, the same as everywhere else.
	 */
	public function entry( string $collection, string $slug ): ?PageDrop {
		foreach ( $this->listeners as $listener ) {
			$listener( $collection );
		}

		$file = $this->find( $collection, $slug );

		return null === $file ? null : $this->page( $file );
	}

	/**
	 * A field's value as a template should see it.
	 *
	 * A relationship is stored as references — `related: [git-is-the-store]`
	 * — and read as the entries themselves: `{post.title}` over
	 * `page.related`, not a slug to look up. Groups and repeater rows are
	 * resolved all the way down. A reference to nothing is dropped.
	 */
	public function resolve( Setting $field, mixed $value ): mixed {
		return match ( $field->type ) {
			FieldType::CollectionItem => $this->references( $field, $value ),
			FieldType::Page => is_string( $value ) && '' !== trim( $value, '/' ) ? $this->entry( 'pages', trim( $value, '/' ) ) : null,
			FieldType::Group => is_array( $value ) ? $this->resolveAll( $field->fields, $value ) : $value,
			FieldType::Repeater => is_array( $value )
				? array_map( fn ( mixed $row ): mixed => is_array( $row ) ? $this->resolveAll( $field->fields, $row ) : $row, $value )
				: $value,
			default => $value,
		};
	}

	/**
	 * @param list<Setting>        $fields
	 * @param array<mixed, mixed>  $values
	 *
	 * @return array<mixed, mixed>
	 */
	public function resolveAll( array $fields, array $values ): array {
		foreach ( $fields as $field ) {
			if ( ! $field->type->isDecorative() && array_key_exists( $field->id, $values ) ) {
				$values[ $field->id ] = $this->resolve( $field, $values[ $field->id ] );
			}
		}

		return $values;
	}

	/**
	 * `slug` for a field with one collection, `collection/slug` for one with
	 * several — either resolves.
	 *
	 * @return PageDrop|list<PageDrop>|null
	 */
	private function references( Setting $field, mixed $value ): PageDrop|array|null {
		$entries = [];

		foreach ( is_array( $value ) ? $value : [ $value ] as $reference ) {
			if ( ! is_string( $reference ) || '' === $reference ) {
				continue;
			}

			[ $collection, $slug ] = str_contains( $reference, '/' )
				? explode( '/', $reference, 2 )
				: [ $field->collections[0] ?? '', $reference ];

			$entry = '' === $collection ? null : $this->entry( $collection, $slug );

			if ( null !== $entry ) {
				$entries[] = $entry;
			}
		}

		return $field->multiple ? $entries : ( $entries[0] ?? null );
	}

	/** How a collection's entries answer for their own fields — see `resolve()`. */
	private function augmenter( string $collection ): \Closure {
		return function ( string $name, mixed $value ) use ( $collection ): mixed {
			$this->schemas ??= ContentSchema::all( $this->site->layers() );

			$field = ( $this->schemas[ $collection ] ?? null )?->field( $name );

			return null === $field ? $value : $this->resolve( $field, $value );
		};
	}
}
