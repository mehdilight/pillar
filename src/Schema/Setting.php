<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * One control in a `<schema>` block — the contract between a theme author and
 * whoever edits the site. Everything here becomes a control in the dashboard;
 * nothing else can be changed.
 */
final class Setting {

	/** @param list<array{value: string, label: string}> $options */
	public function __construct(
		public readonly string $id,
		public readonly FieldType $type,
		public readonly string $label = '',
		public readonly mixed $default = null,
		public readonly array $options = [],
		public readonly ?float $min = null,
		public readonly ?float $max = null,
		public readonly ?float $step = null,
		public readonly string $unit = '',
		public readonly string $info = '',
		public readonly string $content = '',
		public readonly string $placeholder = '',
		public readonly string $cssVar = '',
		public readonly string $cssUnit = '',
	) {}

	/**
	 * @param array<string, mixed> $raw
	 *
	 * @throws SchemaException on an unknown type — deliberately fatal. A type
	 *         the dashboard offers and this rejects would otherwise render a
	 *         control that silently writes a value nothing reads.
	 */
	public static function fromArray( array $raw ): self {
		$name = (string) ( $raw['type'] ?? '' );
		$type = FieldType::tryFrom( $name );

		if ( null === $type ) {
			throw new SchemaException(
				sprintf(
					'Unknown setting type "%s". Known types: %s.',
					$name,
					implode( ', ', array_column( FieldType::cases(), 'value' ) )
				)
			);
		}

		$id = (string) ( $raw['id'] ?? '' );

		if ( ! $type->isDecorative() ) {
			if ( '' === $id ) {
				throw new SchemaException( sprintf( 'A "%s" setting needs an id.', $name ) );
			}

			if ( ! preg_match( '/^[a-z][a-z0-9_]*$/', $id ) ) {
				throw new SchemaException(
					sprintf( 'Setting id "%s" must be lowercase, starting with a letter (a-z, 0-9, _).', $id )
				);
			}
		}

		$options = [];

		foreach ( (array) ( $raw['options'] ?? [] ) as $option ) {
			if ( is_array( $option ) && isset( $option['value'] ) ) {
				$options[] = [
					'value' => (string) $option['value'],
					'label' => (string) ( $option['label'] ?? $option['value'] ),
				];
			}
		}

		if ( in_array( $type, [ FieldType::Select, FieldType::Radio ], true ) && [] === $options ) {
			throw new SchemaException( sprintf( 'Setting "%s" is a %s and needs options.', $id, $name ) );
		}

		return new self(
			id: $id,
			type: $type,
			label: (string) ( $raw['label'] ?? '' ),
			default: $raw['default'] ?? null,
			options: $options,
			min: isset( $raw['min'] ) ? (float) $raw['min'] : null,
			max: isset( $raw['max'] ) ? (float) $raw['max'] : null,
			step: isset( $raw['step'] ) ? (float) $raw['step'] : null,
			unit: (string) ( $raw['unit'] ?? '' ),
			info: (string) ( $raw['info'] ?? '' ),
			content: (string) ( $raw['content'] ?? '' ),
			placeholder: (string) ( $raw['placeholder'] ?? '' ),
			cssVar: (string) ( $raw['css_var'] ?? '' ),
			cssUnit: (string) ( $raw['css_unit'] ?? '' ),
		);
	}

	/** The value a section starts with: the schema's default, else the type's empty value. */
	public function initialValue(): mixed {
		if ( $this->type->isDecorative() ) {
			return null;
		}

		return $this->default ?? $this->type->emptyValue();
	}

	/** @return array<string, mixed> the shape the dashboard's `SchemaSetting` expects */
	public function toArray(): array {
		$out = [ 'id' => $this->id, 'type' => $this->type->value, 'label' => $this->label ];

		foreach (
			[
				'default'     => $this->default,
				'options'     => $this->options,
				'min'         => $this->min,
				'max'         => $this->max,
				'step'        => $this->step,
				'unit'        => $this->unit,
				'info'        => $this->info,
				'content'     => $this->content,
				'placeholder' => $this->placeholder,
				'css_var'     => $this->cssVar,
				'css_unit'    => $this->cssUnit,
			] as $key => $value
		) {
			if ( null !== $value && '' !== $value && [] !== $value ) {
				$out[ $key ] = $value;
			}
		}

		return $out;
	}
}
