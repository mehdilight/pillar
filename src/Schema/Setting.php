<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * One control in a `<schema>` block — the contract between a theme author and
 * whoever edits the site. Everything here becomes a control in the dashboard;
 * nothing else can be changed.
 */
final class Setting {

	/** Groups inside repeaters inside groups: deep enough for any real form, and no deeper. */
	public const MAX_DEPTH = 3;

	/** How a `visible_if` rule compares a sibling's value. */
	public const OPERATORS = [ 'equals', 'not_equals', 'contains', 'empty', 'not_empty' ];

	/** What a `text` field's `input_type` may ask for. */
	public const INPUT_TYPES = [ 'text', 'email', 'tel' ];

	/**
	 * @param list<array{value: string, label: string}> $options
	 * @param list<Setting>                             $fields  a group's or a repeater row's fields
	 * @param list<string>                              $collections
	 * @param list<array{field: string, operator: string, value: mixed}> $visibleIf
	 * @param list<string>                              $extensions
	 */
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
		public readonly array $fields = [],
		/** `image` → a gallery; `collection_item` → several entries. Stored as a list. */
		public readonly bool $multiple = false,
		/** `collection_item`: the collections its entries come from. */
		public readonly array $collections = [],
		/** `date`: a time of day as well. */
		public readonly bool $time = false,
		/** Must have a value — when it is shown. */
		public readonly bool $required = false,
		/** Text fields: at most this many characters. */
		public readonly ?int $characterLimit = null,
		/** `text`: `email` or `tel` — the keyboard, and for email, a check. */
		public readonly string $inputType = 'text',
		/** `radio`: `buttons` draws the options as a row of buttons. */
		public readonly string $display = '',
		/** Kept in the file, never shown in the form — data a plugin or script manages. */
		public readonly bool $hidden = false,
		/** Shown only when every rule holds for its sibling field. */
		public readonly array $visibleIf = [],
		/** `file`: the extensions it takes — `[pdf]` for a brochure; any download when empty. */
		public readonly array $extensions = [],
	) {}

	/**
	 * @param array<string, mixed> $raw
	 *
	 * @throws SchemaException on an unknown type — deliberately fatal. A type
	 *         the dashboard offers and this rejects would otherwise render a
	 *         control that silently writes a value nothing reads.
	 */
	public static function fromArray( array $raw, int $depth = 0 ): self {
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

		if ( in_array( $type, [ FieldType::Select, FieldType::Radio, FieldType::Checkboxes ], true ) && [] === $options ) {
			throw new SchemaException( sprintf( 'Setting "%s" is a %s and needs options.', $id, $name ) );
		}

		$fields = self::fieldsOf( $type, $id, $raw, $depth );

		// `collections: [posts, docs]`, or the shorthand `collection: posts`.
		$collections = array_values( array_unique( array_map( 'strval', (array) ( $raw['collections'] ?? ( isset( $raw['collection'] ) ? [ $raw['collection'] ] : [] ) ) ) ) );

		foreach ( $collections as $collection ) {
			if ( ! preg_match( '/^[a-z][a-z0-9-]*$/', $collection ) ) {
				throw new SchemaException( sprintf( 'Setting "%s" names a collection "%s" that is not a collection name.', $id, $collection ) );
			}
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
			fields: $fields,
			multiple: in_array( $type, [ FieldType::Image, FieldType::CollectionItem ], true ) && true === ( $raw['multiple'] ?? false ),
			collections: FieldType::CollectionItem === $type ? $collections : [],
			time: FieldType::Date === $type && true === ( $raw['time'] ?? false ),
			required: ! $type->isDecorative() && true === ( $raw['required'] ?? false ),
			characterLimit: isset( $raw['character_limit'] ) && in_array( $type, [ FieldType::Text, FieldType::Textarea, FieldType::Markdown, FieldType::Richtext ], true )
				? max( 1, (int) $raw['character_limit'] )
				: null,
			inputType: FieldType::Text === $type && in_array( $raw['input_type'] ?? 'text', self::INPUT_TYPES, true ) ? (string) ( $raw['input_type'] ?? 'text' ) : 'text',
			display: FieldType::Radio === $type && 'buttons' === ( $raw['display'] ?? '' ) ? 'buttons' : '',
			hidden: true === ( $raw['hidden'] ?? false ),
			visibleIf: self::conditionsOf( $id, $raw ),
			extensions: FieldType::File === $type
				? array_values( array_unique( array_filter( array_map( static fn ( mixed $item ): string => strtolower( (string) $item ), (array) ( $raw['extensions'] ?? [] ) ), static fn ( string $item ): bool => 1 === preg_match( '/^[a-z0-9]{1,8}$/', $item ) ) ) )
				: [],
		);
	}

	/**
	 * `visible_if: [{ field: "kind", operator: "equals", value: "video" }]` —
	 * a shape check here; that each rule names a real sibling is checked by
	 * `checkConditions()`, once the siblings are known.
	 *
	 * @param array<string, mixed> $raw
	 *
	 * @return list<array{field: string, operator: string, value: mixed}>
	 */
	private static function conditionsOf( string $id, array $raw ): array {
		$rules = [];

		foreach ( (array) ( $raw['visible_if'] ?? [] ) as $rule ) {
			$field    = is_array( $rule ) ? (string) ( $rule['field'] ?? '' ) : '';
			$operator = is_array( $rule ) ? (string) ( $rule['operator'] ?? 'equals' ) : '';

			if ( ! preg_match( '/^[a-z][a-z0-9_]*$/', $field ) || ! in_array( $operator, self::OPERATORS, true ) ) {
				throw new SchemaException( sprintf( 'Setting "%s" has a visible_if rule that needs a field and one of: %s.', $id, implode( ', ', self::OPERATORS ) ) );
			}

			$rules[] = [ 'field' => $field, 'operator' => $operator, 'value' => $rule['value'] ?? null ];
		}

		return $rules;
	}

	/**
	 * Every `visible_if` names a field beside it — not itself, not one that
	 * does not exist. A typo here would silently hide a field forever.
	 *
	 * @param list<Setting> $siblings
	 *
	 * @throws SchemaException
	 */
	public static function checkConditions( array $siblings ): void {
		$ids = array_map( static fn ( Setting $setting ): string => $setting->id, $siblings );

		foreach ( $siblings as $setting ) {
			foreach ( $setting->visibleIf as $rule ) {
				if ( $rule['field'] === $setting->id || ! in_array( $rule['field'], $ids, true ) ) {
					throw new SchemaException( sprintf( 'Setting "%s" is shown depending on "%s", which is not a field beside it.', $setting->id, $rule['field'] ) );
				}
			}
		}
	}

	/**
	 * A group's or repeater's sub-fields — required, uniquely named, and only
	 * for those two types: sub-fields on a text setting would be a schema
	 * that says more than the form can show.
	 *
	 * @param array<string, mixed> $raw
	 *
	 * @return list<Setting>
	 */
	private static function fieldsOf( FieldType $type, string $id, array $raw, int $depth ): array {
		$holds = in_array( $type, [ FieldType::Group, FieldType::Repeater ], true );

		if ( ! $holds ) {
			return [];
		}

		if ( $depth >= self::MAX_DEPTH ) {
			throw new SchemaException( sprintf( 'Setting "%s" nests groups and repeaters more than %d deep.', $id, self::MAX_DEPTH ) );
		}

		$fields = [];
		$seen   = [];

		foreach ( (array) ( $raw['fields'] ?? [] ) as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}

			$setting = self::fromArray( $field, $depth + 1 );

			if ( ! $setting->type->isDecorative() ) {
				if ( isset( $seen[ $setting->id ] ) ) {
					throw new SchemaException( sprintf( 'Setting "%s" has two fields called "%s".', $id, $setting->id ) );
				}

				$seen[ $setting->id ] = true;
			}

			$fields[] = $setting;
		}

		if ( [] === $seen ) {
			throw new SchemaException( sprintf( 'Setting "%s" is a %s and needs at least one field.', $id, $type->value ) );
		}

		self::checkConditions( $fields );

		return $fields;
	}

	/** The value a section starts with: the schema's default, else the type's empty value. */
	public function initialValue(): mixed {
		if ( $this->type->isDecorative() ) {
			return null;
		}

		if ( null === $this->default && $this->multiple ) {
			return [];
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
				'fields'      => array_map( static fn ( Setting $field ): array => $field->toArray(), $this->fields ),
				'multiple'    => $this->multiple ?: null,
				'collections' => $this->collections,
				'time'        => $this->time ?: null,
				'required'    => $this->required ?: null,
				'character_limit' => $this->characterLimit,
				'input_type'  => 'text' === $this->inputType ? null : $this->inputType,
				'display'     => $this->display,
				'hidden'      => $this->hidden ?: null,
				'visible_if'  => $this->visibleIf,
				'extensions'  => $this->extensions,
			] as $key => $value
		) {
			if ( null !== $value && '' !== $value && [] !== $value ) {
				$out[ $key ] = $value;
			}
		}

		return $out;
	}
}
