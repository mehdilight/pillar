<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render;

/**
 * Section failures collected during a render.
 *
 * A section that throws renders as an empty string and the page still ships —
 * a typo in one section must never blank a whole page. The error is kept here
 * instead: an overlay in `pillar dev`, a non-zero exit with a report in
 * `pillar build`.
 */
final class RenderErrors {

	/** @var list<array{route: string, section: string, type: string, error: \Throwable}> */
	private array $errors = [];

	public function add( string $route, string $section, string $type, \Throwable $error ): void {
		$this->errors[] = compact( 'route', 'section', 'type', 'error' );
	}

	/** @return list<array{route: string, section: string, type: string, error: \Throwable}> */
	public function all(): array {
		return $this->errors;
	}

	public function isEmpty(): bool {
		return [] === $this->errors;
	}

	public function count(): int {
		return count( $this->errors );
	}

	public function clear(): void {
		$this->errors = [];
	}
}
