<?php
declare( strict_types=1 );

namespace Pillar\Template;

/**
 * A template's declaration that it paginates a collection.
 *
 * Declared in the template JSON rather than inside a section, because the build
 * has to know how many pages exist *before* rendering any of them — a route
 * table cannot be discovered by rendering.
 *
 *   { "paginate": { "collection": "posts", "per_page": 10 }, "sections": … }
 */
final class Pagination {

	public function __construct(
		public readonly string $collection,
		public readonly int $perPage,
	) {}

	/** @param array<string, mixed> $raw */
	public static function fromArray( array $raw ): ?self {
		$collection = (string) ( $raw['collection'] ?? '' );

		if ( '' === $collection ) {
			return null;
		}

		// One per page is a legitimate (if odd) choice; zero is a mistake that
		// would divide by zero two frames later.
		$perPage = max( 1, (int) ( $raw['per_page'] ?? 10 ) );

		return new self( $collection, $perPage );
	}
}
