<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * What a field's value must satisfy: required, a character limit, an email
 * address, a maximum number of rows or entries — and whether the field is
 * shown at all, since a field its `visible_if` hides is never required.
 *
 * One implementation for the server's save and `pillar check`; the dashboard
 * mirrors it (lib/fieldRules.ts) so a form says what is wrong before saving.
 */
final class Rules {

	/**
	 * Whether a field is shown, given the values beside it.
	 *
	 * @param array<mixed, mixed> $siblings
	 */
	public static function visible( Setting $field, array $siblings ): bool {
		foreach ( $field->visibleIf as $rule ) {
			$value = $siblings[ $rule['field'] ] ?? null;

			$holds = match ( $rule['operator'] ) {
				'empty'      => self::isEmpty( $value ),
				'not_empty'  => ! self::isEmpty( $value ),
				'not_equals' => ! self::equals( $value, $rule['value'] ),
				'contains'   => is_array( $value )
					? in_array( (string) $rule['value'], array_map( 'strval', array_filter( $value, 'is_scalar' ) ), true )
					: str_contains( (string) ( is_scalar( $value ) ? $value : '' ), (string) $rule['value'] ),
				default      => self::equals( $value, $rule['value'] ),
			};

			if ( ! $holds ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Everything wrong with `$values`, into groups and repeater rows.
	 *
	 * @param list<Setting>       $fields
	 * @param array<mixed, mixed> $values
	 *
	 * @return list<array{path: string, message: string}> `path` is dotted — `faq.1.question`
	 */
	public static function violations( array $fields, array $values, string $path = '', string $label = '' ): array {
		$out = [];

		foreach ( $fields as $field ) {
			if ( $field->type->isDecorative() || ! self::visible( $field, $values ) ) {
				continue;
			}

			$value = $values[ $field->id ] ?? null;
			$where = $path . $field->id;
			$name  = $label . ( '' !== $field->label ? $field->label : $field->id );

			if ( $field->required && self::isEmpty( $value ) ) {
				$out[] = [ 'path' => $where, 'message' => sprintf( '%s is required.', $name ) ];

				continue;
			}

			if ( null !== $field->characterLimit && is_string( $value ) && mb_strlen( self::text( $field, $value ) ) > $field->characterLimit ) {
				$out[] = [ 'path' => $where, 'message' => sprintf( '%s is longer than %d characters.', $name, $field->characterLimit ) ];
			}

			if ( 'email' === $field->inputType && is_string( $value ) && '' !== $value && false === filter_var( $value, FILTER_VALIDATE_EMAIL ) ) {
				$out[] = [ 'path' => $where, 'message' => sprintf( '%s is not an email address.', $name ) ];
			}

			$many = FieldType::Repeater === $field->type || ( FieldType::CollectionItem === $field->type && $field->multiple );

			if ( $many && null !== $field->max && is_array( $value ) && count( $value ) > $field->max ) {
				$out[] = [ 'path' => $where, 'message' => sprintf( '%s has more than %d %s.', $name, (int) $field->max, FieldType::Repeater === $field->type ? 'rows' : 'entries' ) ];
			}

			if ( FieldType::Group === $field->type && is_array( $value ) ) {
				array_push( $out, ...self::violations( $field->fields, $value, $where . '.', $name . ' › ' ) );
			}

			if ( FieldType::Repeater === $field->type && is_array( $value ) ) {
				foreach ( array_values( $value ) as $index => $row ) {
					if ( is_array( $row ) ) {
						array_push( $out, ...self::violations( $field->fields, $row, $where . '.' . $index . '.', sprintf( '%s row %d › ', $name, $index + 1 ) ) );
					}
				}
			}
		}

		return $out;
	}

	/** Nothing there: unset, blank, an empty list — or a toggle left off. */
	public static function isEmpty( mixed $value ): bool {
		return null === $value || false === $value || [] === $value || ( is_string( $value ) && '' === trim( $value ) );
	}

	private static function equals( mixed $value, mixed $expected ): bool {
		if ( is_array( $value ) ) {
			return in_array( (string) ( is_scalar( $expected ) ? $expected : '' ), array_map( 'strval', array_filter( $value, 'is_scalar' ) ), true );
		}

		if ( is_bool( $value ) || is_bool( $expected ) ) {
			return filter_var( $value, FILTER_VALIDATE_BOOL ) === filter_var( $expected, FILTER_VALIDATE_BOOL );
		}

		return (string) ( is_scalar( $value ) ? $value : '' ) === (string) ( is_scalar( $expected ) ? $expected : '' );
	}

	/** Rich text counts its words' characters, not its tags'. */
	private static function text( Setting $field, string $value ): string {
		return FieldType::Richtext === $field->type ? html_entity_decode( strip_tags( $value ) ) : $value;
	}
}
