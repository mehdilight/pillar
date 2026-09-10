<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * Turns what the dashboard stored into what a template should see.
 *
 * JSON has no idea a `range` is a number or a `checkbox` is a boolean once a
 * value has been round-tripped through a form, and a theme writing
 * `{section.settings.padding + 8}` should not have to care. Unset settings
 * fall back to the schema's default, so adding a setting to a section does not
 * require touching every page that already uses it.
 */
final class SettingsCaster {

	/** With the site's content, a relationship setting reads as the entries it names. */
	public function __construct( private readonly ?\Pillar\Content\ContentStore $content = null ) {}

	/**
	 * @param array<string, mixed> $stored
	 *
	 * @return array<string, mixed>
	 */
	public function cast( ?SectionSchema $schema, array $stored ): array {
		if ( null === $schema ) {
			return $stored;
		}

		$out = [];

		foreach ( $schema->settings as $setting ) {
			if ( $setting->type->isDecorative() ) {
				continue;
			}

			$out[ $setting->id ] = array_key_exists( $setting->id, $stored )
				? $this->value( $setting, $stored[ $setting->id ] )
				: $setting->initialValue();
		}

		// A value with no setting is kept rather than dropped: a theme author
		// removing a setting should not silently destroy the data on every page
		// that used it, and `pillar check` reports it instead.
		return $out + $stored;
	}

	/**
	 * @param list<Setting>        $settings
	 * @param array<string, mixed> $stored
	 *
	 * @return array<string, mixed>
	 */
	public function castBlock( array $settings, array $stored ): array {
		$out = [];

		foreach ( $settings as $setting ) {
			if ( $setting->type->isDecorative() ) {
				continue;
			}

			$out[ $setting->id ] = array_key_exists( $setting->id, $stored )
				? $this->value( $setting, $stored[ $setting->id ] )
				: $setting->initialValue();
		}

		return $out + $stored;
	}

	private function value( Setting $setting, mixed $value ): mixed {
		$cast = $this->castValue( $setting, $value );

		return null !== $this->content && in_array( $setting->type, [ FieldType::CollectionItem, FieldType::Page ], true )
			? $this->content->resolve( $setting, $cast )
			: $cast;
	}

	private function castValue( Setting $setting, mixed $value ): mixed {
		if ( null === $value ) {
			return $setting->initialValue();
		}

		if ( $setting->multiple ) {
			return array_values( array_map( 'strval', array_filter( (array) $value, 'is_scalar' ) ) );
		}

		return match ( $setting->type ) {
			FieldType::Checkbox => filter_var( $value, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE ) ?? (bool) $value,
			FieldType::Number, FieldType::Range => $this->number( $value ),
			FieldType::Tags, FieldType::Checkboxes => array_values( array_map( 'strval', array_filter( (array) $value, 'is_scalar' ) ) ),
			FieldType::Image, FieldType::Video, FieldType::File => '' === $value ? null : (string) $value,
			// A group is its fields, cast; a repeater is rows of them.
			FieldType::Group => $this->castBlock( $setting->fields, is_array( $value ) ? $value : [] ),
			FieldType::Repeater => array_values( array_map(
				fn ( array $row ): array => $this->castBlock( $setting->fields, $row ),
				array_filter( (array) $value, 'is_array' )
			) ),
			FieldType::Table => array_values( array_map(
				static fn ( mixed $row ): array => array_values( array_map( static fn ( mixed $cell ): string => is_scalar( $cell ) ? (string) $cell : '', (array) $row ) ),
				array_filter( (array) $value, 'is_array' )
			) ),
			default => is_scalar( $value ) ? (string) $value : $value,
		};
	}

	private function number( mixed $value ): int|float {
		if ( is_int( $value ) || is_float( $value ) ) {
			return $value;
		}

		$number = (float) $value;

		// An integer stays an integer: `{settings.columns}` printing "3.0"
		// would be a surprise nobody asked for.
		return $number == (int) $number ? (int) $number : $number;
	}
}
