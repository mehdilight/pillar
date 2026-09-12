<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render\Drops;

/**
 * One page of a collection, and how to reach the others.
 *
 * A template that paginates declares it once, in its JSON, and every section
 * on the page can read `paginate` — which is why this carries the URLs rather
 * than making each theme compute them from a page number and a base path.
 */
final class PaginateDrop extends Drop {

	/** @param list<PageDrop> $items this page's slice */
	public function __construct(
		private readonly array $items,
		private readonly int $currentPage,
		private readonly int $pages,
		private readonly int $total,
		private readonly int $perPage,
		/** The collection's first page — `/blog/`, never `/blog/page/1/`. */
		private readonly string $baseUrl,
	) {}

	/** @return list<PageDrop> */
	public function items(): array {
		return $this->items;
	}

	public function currentPage(): int {
		return $this->currentPage;
	}

	public function pages(): int {
		return $this->pages;
	}

	/** Every entry in the collection, not just this page's. */
	public function total(): int {
		return $this->total;
	}

	public function perPage(): int {
		return $this->perPage;
	}

	public function hasPrevious(): bool {
		return $this->currentPage > 1;
	}

	public function hasNext(): bool {
		return $this->currentPage < $this->pages;
	}

	public function previousUrl(): ?string {
		return $this->hasPrevious() ? $this->urlFor( $this->currentPage - 1 ) : null;
	}

	public function nextUrl(): ?string {
		return $this->hasNext() ? $this->urlFor( $this->currentPage + 1 ) : null;
	}

	/** Alias for previousUrl() in templates. */
	public function previous(): ?string {
		return $this->previousUrl();
	}

	/** Alias for nextUrl() in templates. */
	public function next(): ?string {
		return $this->nextUrl();
	}


	/** Where the numbered links point. */
	public function urlFor( int $page ): string {
		return $page <= 1 ? $this->baseUrl : rtrim( $this->baseUrl, '/' ) . '/page/' . $page . '/';
	}

	/**
	 * The numbered links, with gaps as ellipses — what a theme actually draws.
	 *
	 * Windowed rather than complete: a collection with two hundred pages should
	 * not render two hundred links, and every theme working that out again is
	 * two hundred chances to get it wrong.
	 *
	 * @return list<array{title: string, url: string|null, current: bool, gap: bool}>
	 */
	public function parts(): array {
		if ( $this->pages <= 1 ) {
			return [];
		}

		$window = [ 1, $this->pages, $this->currentPage, $this->currentPage - 1, $this->currentPage + 1 ];
		$shown  = array_values( array_unique( array_filter(
			$window,
			fn ( int $page ): bool => $page >= 1 && $page <= $this->pages
		) ) );

		sort( $shown );

		$parts    = [];
		$previous = 0;

		foreach ( $shown as $page ) {
			if ( $page - $previous > 1 ) {
				$parts[] = [ 'title' => '…', 'url' => null, 'current' => false, 'gap' => true ];
			}

			$parts[] = [
				'title'   => (string) $page,
				'url'     => $this->urlFor( $page ),
				'current' => $page === $this->currentPage,
				'gap'     => false,
			];

			$previous = $page;
		}

		return $parts;
	}
}
