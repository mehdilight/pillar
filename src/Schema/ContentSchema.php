<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Schema;

use Phpmystic\Pillar\Site\Layers;

/**
 * `schemas/<collection>.json` — the content model.
 *
 * The same setting vocabulary a section's `<schema>` uses, which is why one
 * component in the dashboard renders both a section setting and a post's
 * `date`. This is what turns a markdown file's frontmatter into a form.
 */
final class ContentSchema {

	/** @param list<Setting> $fields */
	public function __construct(
		public readonly string $collection,
		public readonly string $label,
		public readonly array $fields,
		public readonly string $icon = 'file-text',
	) {}

	/** @throws SchemaException */
	public static function fromArray( string $collection, array $raw ): self {
		$fields = [];

		foreach ( (array) ( $raw['fields'] ?? [] ) as $field ) {
			if ( is_array( $field ) ) {
				$fields[] = Setting::fromArray( $field );
			}
		}

		Setting::checkConditions( $fields );

		return new self(
			collection: $collection,
			label: (string) ( $raw['label'] ?? ucfirst( $collection ) ),
			fields: $fields,
			icon: is_string( $raw['icon'] ?? null ) && preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $raw['icon'] ) ? $raw['icon'] : 'file-text',
		);
	}

	/**
	 * Every declared content model in the site.
	 *
	 * @param array<string, string> $errors filled with collection => message
	 *
	 * @return array<string, self>
	 */
	public static function all( Layers $layers, array &$errors = [] ): array {
		$out = [];

		foreach ( $layers->listing( 'schemas', 'json' ) as $key => $path ) {
			$collection = (string) $key;
			$raw        = json_decode( (string) file_get_contents( $path ), true );

			if ( ! is_array( $raw ) ) {
				$errors[ $collection ] = sprintf( 'schemas/%s.json is not valid JSON.', $collection );

				continue;
			}

			try {
				$out[ $collection ] = self::fromArray( $collection, $raw );
			} catch ( SchemaException $error ) {
				$errors[ $collection ] = $error->getMessage();
			}
		}

		return $out;
	}

	public function field( string $id ): ?Setting {
		foreach ( $this->fields as $field ) {
			if ( $field->id === $id ) {
				return $field;
			}
		}

		return null;
	}

	/** @return array<string, mixed> the shape the dashboard's `ContentCollection` expects */
	public function toArray(): array {
		return [
			'name'   => $this->collection,
			'label'  => $this->label,
			'icon'   => $this->icon,
			'fields' => array_map( static fn ( Setting $f ): array => $f->toArray(), $this->fields ),
		];
	}
}
