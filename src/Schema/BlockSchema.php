<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Schema;

/** A repeatable block a section hosts. */
final class BlockSchema {

	/** @param list<Setting> $settings */
	public function __construct(
		public readonly string $type,
		public readonly string $name = '',
		public readonly array $settings = [],
		/** Types this block will host, for blocks that nest. */
		public readonly array $accepts = [],
	) {}

	/** @param array<string, mixed> $raw */
	public static function fromArray( string $type, array $raw ): self {
		$settings = [];

		foreach ( (array) ( $raw['settings'] ?? [] ) as $setting ) {
			if ( is_array( $setting ) ) {
				$settings[] = Setting::fromArray( $setting );
			}
		}

		Setting::checkConditions( $settings );

		return new self(
			type: $type,
			name: (string) ( $raw['name'] ?? $type ),
			settings: $settings,
			accepts: array_values( array_map( 'strval', (array) ( $raw['accepts'] ?? [] ) ) ),
		);
	}

	/** @return array<string, mixed> */
	public function toArray(): array {
		return [
			'type'     => $this->type,
			'name'     => $this->name,
			'settings' => array_map( static fn ( Setting $s ): array => $s->toArray(), $this->settings ),
			'accepts'  => $this->accepts,
		];
	}
}
