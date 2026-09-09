<?php
declare( strict_types=1 );

namespace Pillar\Render\Drops;

/** `{collections.posts}` — a list of `PageDrop`s, plus what a theme asks about the list. */
final class CollectionDrop extends Drop implements \Countable, \IteratorAggregate {

	/** @param list<PageDrop> $items */
	public function __construct(
		private readonly string $name,
		private readonly array $items,
	) {}

	public function name(): string {
		return $this->name;
	}

	/** @return list<PageDrop> */
	public function items(): array {
		return $this->items;
	}

	public function size(): int {
		return count( $this->items );
	}

	public function isEmpty(): bool {
		return [] === $this->items;
	}

	public function first(): ?PageDrop {
		return $this->items[0] ?? null;
	}

	public function count(): int {
		return count( $this->items );
	}

	public function getIterator(): \Traversable {
		return new \ArrayIterator( $this->items );
	}
}
