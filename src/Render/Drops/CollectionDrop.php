<?php
declare( strict_types=1 );

namespace Pillar\Render\Drops;

/**
 * `{collections.posts}` — a list of `PageDrop`s, plus what a theme asks about the list.
 *
 * Every read reports itself. A page that lists a collection depends on that
 * collection's membership, and nothing else in the render can see that — the
 * collection is not a template file, so the dependency recorder never loads it.
 * Without this, adding a post rebuilt the post and left every page listing
 * posts — the home page included — showing the old list.
 */
final class CollectionDrop extends Drop implements \Countable, \IteratorAggregate {

	/**
	 * @param list<PageDrop> $items
	 * @param (\Closure(string): void)|null $onRead called with the collection's name
	 */
	public function __construct(
		private readonly string $name,
		private readonly array $items,
		private readonly ?\Closure $onRead = null,
	) {}

	private function read(): void {
		if ( null !== $this->onRead ) {
			( $this->onRead )( $this->name );
		}
	}

	public function name(): string {
		return $this->name;
	}

	/** @return list<PageDrop> */
	public function items(): array {
		$this->read();

		return $this->items;
	}

	public function size(): int {
		$this->read();

		return count( $this->items );
	}

	public function isEmpty(): bool {
		$this->read();

		return [] === $this->items;
	}

	public function first(): ?PageDrop {
		$this->read();

		return $this->items[0] ?? null;
	}

	public function count(): int {
		$this->read();

		return count( $this->items );
	}

	public function getIterator(): \Traversable {
		$this->read();

		return new \ArrayIterator( $this->items );
	}
}
