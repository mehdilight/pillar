<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render\Drops;

/**
 * `{section.settings.heading}` — what a section knows about itself.
 *
 * `settings` and `blocks` are plain arrays on purpose: they are data someone
 * typed into the dashboard, and Liqx reads arrays natively.
 */
final class SectionDrop extends Drop {

	/**
	 * @param array<string, mixed> $settings
	 * @param list<array<string, mixed>> $blocks
	 */
	public function __construct(
		public readonly string $id,
		public readonly string $type,
		public readonly array $settings,
		public readonly array $blocks = [],
	) {}

	public function index(): int {
		return 0;
	}

	/**
	 * Blocks grouped by type, for a section that renders one kind in one place
	 * and another elsewhere.
	 *
	 * @return array<string, list<array<string, mixed>>>
	 */
	public function blocksByType(): array {
		$out = [];

		foreach ( $this->blocks as $block ) {
			$out[ (string) ( $block['type'] ?? '' ) ][] = $block;
		}

		return $out;
	}
}
