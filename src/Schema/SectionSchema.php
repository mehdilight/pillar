<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * What a section tells the dashboard about itself.
 *
 * Everything here becomes a control; nothing else can be changed. A section
 * with no schema still renders — it is simply not editable, which is the right
 * answer for a section that takes no configuration.
 */
final class SectionSchema {

	/**
	 * @param list<Setting> $settings
	 * @param list<BlockSchema> $blocks
	 * @param list<array{name: string, settings?: array<string, mixed>, blocks?: list<array<string, mixed>>}> $presets
	 * @param list<string> $enabledOn templates this section may be added to; empty means all
	 */
	public function __construct(
		public readonly string $type,
		public readonly string $name,
		public readonly array $settings = [],
		public readonly array $blocks = [],
		public readonly array $presets = [],
		public readonly ?int $maxBlocks = null,
		public readonly array $enabledOn = [],
		public readonly string $description = '',
		/** Sections the site owner may not remove or reorder — header, footer. */
		public readonly bool $static = false,
	) {}

	/**
	 * @param array<string, mixed> $raw
	 *
	 * @throws SchemaException
	 */
	public static function fromArray( string $type, array $raw ): self {
		$settings = [];
		$seen     = [];

		foreach ( (array) ( $raw['settings'] ?? [] ) as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}

			$setting = Setting::fromArray( $entry );

			if ( ! $setting->type->isDecorative() ) {
				if ( isset( $seen[ $setting->id ] ) ) {
					// Two controls writing one key: whichever the editor drew
					// second would silently overwrite the first.
					throw new SchemaException( sprintf( 'Duplicate setting id "%s" in section "%s".', $setting->id, $type ) );
				}

				$seen[ $setting->id ] = true;
			}

			$settings[] = $setting;
		}

		$blocks = [];

		foreach ( (array) ( $raw['blocks'] ?? [] ) as $entry ) {
			if ( is_array( $entry ) && isset( $entry['type'] ) ) {
				$blocks[] = BlockSchema::fromArray( (string) $entry['type'], $entry );
			}
		}

		return new self(
			type: $type,
			name: (string) ( $raw['name'] ?? $type ),
			settings: $settings,
			blocks: $blocks,
			presets: array_values( array_filter( (array) ( $raw['presets'] ?? [] ), 'is_array' ) ),
			maxBlocks: isset( $raw['max_blocks'] ) ? (int) $raw['max_blocks'] : null,
			enabledOn: array_values( array_map( 'strval', (array) ( $raw['enabled_on'] ?? [] ) ) ),
			description: (string) ( $raw['description'] ?? '' ),
			static: (bool) ( $raw['static'] ?? false ),
		);
	}

	/** The settings a fresh instance of this section starts with. @return array<string, mixed> */
	public function defaults(): array {
		$out = [];

		foreach ( $this->settings as $setting ) {
			if ( $setting->type->isDecorative() ) {
				continue;
			}

			$out[ $setting->id ] = $setting->initialValue();
		}

		return $out;
	}

	public function setting( string $id ): ?Setting {
		foreach ( $this->settings as $setting ) {
			if ( $setting->id === $id ) {
				return $setting;
			}
		}

		return null;
	}

	/** @return array<string, mixed> the shape the dashboard's `AvailableSection` expects */
	public function toArray(): array {
		return [
			'type'        => $this->type,
			'name'        => $this->name,
			'description' => $this->description,
			'settings'    => array_map( static fn ( Setting $s ): array => $s->toArray(), $this->settings ),
			'blocks'      => array_map( static fn ( BlockSchema $b ): array => $b->toArray(), $this->blocks ),
			'presets'     => $this->presets,
			'max_blocks'  => $this->maxBlocks,
			'enabled_on'  => $this->enabledOn,
		];
	}
}
