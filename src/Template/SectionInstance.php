<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Template;

/** One section on a page: which type, with which settings and blocks. */
final class SectionInstance {

	/**
	 * @param array<string, mixed> $settings
	 * @param list<array<string, mixed>> $blocks
	 */
	public function __construct(
		public readonly string $id,
		public readonly string $type,
		public readonly array $settings = [],
		public readonly array $blocks = [],
		public readonly int $order = 0,
		public readonly bool $enabled = true,
		public readonly bool $isLayout = false,
		public readonly string $customCss = '',
	) {}

	/** @param array<string, mixed> $raw */
	public static function fromArray( string $id, array $raw ): self {
		$blocks = [];

		foreach ( (array) ( $raw['blocks'] ?? [] ) as $key => $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$block['id'] ??= is_string( $key ) ? $key : (string) count( $blocks );

			if ( true === ( $block['disabled'] ?? false ) ) {
				continue;
			}

			$blocks[] = $block;
		}

		return new self(
			id: '' !== $id ? $id : (string) ( $raw['section_id'] ?? $raw['type'] ?? 'section' ),
			type: (string) ( $raw['section_type'] ?? $raw['type'] ?? '' ),
			settings: (array) ( $raw['settings'] ?? [] ),
			blocks: $blocks,
			order: (int) ( $raw['order'] ?? 0 ),
			enabled: (bool) ( $raw['enabled'] ?? true ),
			isLayout: (bool) ( $raw['is_layout'] ?? false ),
			customCss: (string) ( $raw['custom_css'] ?? '' ),
		);
	}
}
