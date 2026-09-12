<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Schema;

use Phpmystic\Pillar\Content\ContentStore;
use Phpmystic\Pillar\Content\MarkdownFile;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Site\Site;
use Phpmystic\Pillar\Template\PageTemplate;
use Phpmystic\Pillar\Template\SectionInstance;

/**
 * What `pillar check` checks.
 *
 * The point is to fail on a workstation, with a file name, rather than in a
 * build — or worse, as a page that renders blank and says nothing about why.
 */
final class Validator {

	/** @var list<array{level: string, where: string, message: string}> */
	private array $problems = [];

	public function __construct(
		private readonly Site $site,
		private readonly SchemaParser $schemas,
		private readonly ContentStore $content,
	) {}

	/** @return list<array{level: string, where: string, message: string}> */
	public function run(): array {
		$this->problems = [];

		$sections = $this->checkSections();

		$this->checkTemplates( $sections );
		$this->checkContent();
		$this->checkLayout();

		return $this->problems;
	}

	public function hasErrors(): bool {
		foreach ( $this->problems as $problem ) {
			if ( 'error' === $problem['level'] ) {
				return true;
			}
		}

		return false;
	}

	/** @return array<string, SectionSchema> */
	private function checkSections(): array {
		$errors   = [];
		$sections = $this->schemas->allSections( $errors );

		foreach ( $errors as $type => $message ) {
			$this->error( 'sections/' . $type . '.liqx', $message );
		}

		$blockErrors = [];

		$this->schemas->allBlocks( $blockErrors );

		foreach ( $blockErrors as $type => $message ) {
			$this->error( 'blocks/' . $type . '.liqx', $message );
		}

		return $sections;
	}

	/** @param array<string, SectionSchema> $sections */
	private function checkTemplates( array $sections ): void {
		$layers = $this->site->layers();

		foreach ( $layers->listing( 'templates', 'json' ) as $key => $path ) {
			$name = (string) $key;

			try {
				$template = PageTemplate::fromFile( $path, $name );
			} catch ( PillarException $error ) {
				$this->error( 'templates/' . $name . '.json', $error->getMessage() );

				continue;
			}

			foreach ( $template->sections as $section ) {
				$this->checkSectionInstance( $name, $section, $sections );
			}
		}
	}

	/** @param array<string, SectionSchema> $sections */
	private function checkSectionInstance( string $template, SectionInstance $instance, array $sections ): void {
		$where = 'templates/' . $template . '.json';

		if ( '' === $instance->type ) {
			$this->error( $where, sprintf( 'Section "%s" declares no type.', $instance->id ) );

			return;
		}

		if ( ! isset( $sections[ $instance->type ] ) ) {
			// The most common real failure: a template referencing a section
			// that was renamed or never existed. It renders as nothing at all,
			// which is unhelpfully quiet at build time.
			$this->error( $where, sprintf( 'Section "%s" is type "%s", which no layer provides.', $instance->id, $instance->type ) );

			return;
		}

		$schema = $sections[ $instance->type ];

		if ( [] !== $schema->enabledOn && 'layout' !== $template && ! in_array( $template, $schema->enabledOn, true ) ) {
			$this->warn(
				$where,
				sprintf( 'Section "%s" is not enabled on this template (enabled_on: %s).', $instance->type, implode( ', ', $schema->enabledOn ) )
			);
		}

		foreach ( array_keys( $instance->settings ) as $id ) {
			if ( null === $schema->setting( (string) $id ) ) {
				$this->warn( $where, sprintf( 'Section "%s" stores "%s", which its schema does not declare.', $instance->id, $id ) );
			}
		}

		if ( null !== $schema->maxBlocks && count( $instance->blocks ) > $schema->maxBlocks ) {
			$this->error(
				$where,
				sprintf( 'Section "%s" has %d blocks; "%s" allows %d.', $instance->id, count( $instance->blocks ), $instance->type, $schema->maxBlocks )
			);
		}
	}

	private function checkContent(): void {
		$errors  = [];
		$schemas = ContentSchema::all( $this->site->layers(), $errors );

		foreach ( $errors as $collection => $message ) {
			$this->error( 'schemas/' . $collection . '.json', $message );
		}

		foreach ( $this->content->files() as $collection => $files ) {
			$schema = $schemas[ $collection ] ?? null;

			if ( null === $schema ) {
				continue;
			}

			foreach ( $files as $file ) {
				$this->checkContentFile( $schema, $file );
			}
		}
	}

	private function checkContentFile( ContentSchema $schema, MarkdownFile $file ): void {
		$where = 'content/' . $file->collection . '/' . $file->slug . '.md';

		$this->checkValues( $schema->fields, $file->frontmatter, $where, '' );

		// Required fields, limits, email addresses: errors once published, a
		// warning on a draft that is still being written.
		foreach ( Rules::violations( $schema->fields, $file->frontmatter ) as $violation ) {
			filter_var( $file->frontmatter['draft'] ?? false, FILTER_VALIDATE_BOOL )
				? $this->warn( $where, $violation['message'] . ' (draft)' )
				: $this->error( $where, $violation['message'] );
		}
	}

	/**
	 * Every value against its field — and into groups and repeater rows, so a
	 * wrong value three levels down is reported with its path: `faq[1].answer`.
	 *
	 * @param list<Setting>        $fields
	 * @param array<mixed, mixed>  $values
	 */
	private function checkValues( array $fields, array $values, string $where, string $path ): void {
		foreach ( $fields as $field ) {
			if ( $field->type->isDecorative() || ! array_key_exists( $field->id, $values ) || null === $values[ $field->id ] ) {
				continue;
			}

			$value = $values[ $field->id ];
			$name  = $path . $field->id;
			$type  = $this->describe( $field );

			if ( null !== $type && ! $this->matches( $field, $value ) ) {
				$this->error( $where, sprintf( '"%s" should be %s, got %s.', $name, $type, get_debug_type( $value ) ) );

				continue;
			}

			if ( [] !== $field->options ) {
				$allowed = array_column( $field->options, 'value' );

				foreach ( is_array( $value ) ? $value : [ $value ] as $choice ) {
					if ( is_scalar( $choice ) && ! in_array( (string) $choice, $allowed, true ) ) {
						$this->error( $where, sprintf( '"%s" is "%s"; allowed: %s.', $name, $choice, implode( ', ', $allowed ) ) );
					}
				}
			}

			if ( FieldType::CollectionItem === $field->type ) {
				$this->checkReferences( $field, $value, $where, $name );
			}

			if ( FieldType::Group === $field->type && is_array( $value ) ) {
				$this->checkValues( $field->fields, $value, $where, $name . '.' );
			}

			if ( FieldType::Repeater === $field->type && is_array( $value ) ) {
				foreach ( array_values( $value ) as $index => $row ) {
					if ( is_array( $row ) ) {
						$this->checkValues( $field->fields, $row, $where, sprintf( '%s[%d].', $name, $index ) );
					}
				}
			}
		}
	}

	/** A relationship naming an entry that is not there: renamed, deleted, or never written. */
	private function checkReferences( Setting $field, mixed $value, string $where, string $name ): void {
		foreach ( is_array( $value ) ? $value : [ $value ] as $reference ) {
			if ( ! is_string( $reference ) || '' === $reference ) {
				continue;
			}

			[ $collection, $slug ] = str_contains( $reference, '/' ) ? explode( '/', $reference, 2 ) : [ $field->collections[0] ?? '', $reference ];

			if ( '' !== $collection && null === $this->content->find( $collection, $slug ) ) {
				$this->warn( $where, sprintf( '"%s" points to %s/%s, which does not exist.', $name, $collection, $slug ) );
			}
		}
	}

	private function describe( Setting $field ): ?string {
		if ( $field->multiple ) {
			return 'a list';
		}

		return match ( $field->type ) {
			FieldType::CollectionItem => 'an entry',
			FieldType::Checkbox => 'a boolean',
			FieldType::Number, FieldType::Range => 'a number',
			FieldType::Tags, FieldType::Checkboxes, FieldType::Repeater, FieldType::Table => 'a list',
			FieldType::Group => 'a set of fields',
			FieldType::Text, FieldType::Textarea, FieldType::Url, FieldType::Date, FieldType::Icon, FieldType::File => 'a string',
			default => null,
		};
	}

	private function matches( Setting $field, mixed $value ): bool {
		if ( $field->multiple ) {
			return is_array( $value ) && array_is_list( $value );
		}

		return match ( $field->type ) {
			FieldType::Checkbox => is_bool( $value ),
			FieldType::Number, FieldType::Range => is_int( $value ) || is_float( $value ),
			FieldType::Tags, FieldType::Checkboxes => is_array( $value ) && array_is_list( $value ),
			FieldType::Repeater => is_array( $value ) && array_is_list( $value ) && [] === array_filter( $value, static fn ( mixed $row ): bool => ! is_array( $row ) ),
			FieldType::Table => is_array( $value ) && array_is_list( $value ) && [] === array_filter( $value, static fn ( mixed $row ): bool => ! is_array( $row ) ),
			FieldType::Group => is_array( $value ) && ( [] === $value || ! array_is_list( $value ) ),
			default => is_string( $value ) || is_int( $value ) || is_float( $value ),
		};
	}

	private function checkLayout(): void {
		if ( null === $this->site->layers()->resolve( 'layout/theme.liqx' ) ) {
			$this->error( 'layout/theme.liqx', 'No layout in any layer — a site needs one.' );
		}
	}

	private function error( string $where, string $message ): void {
		$this->problems[] = [ 'level' => 'error', 'where' => $where, 'message' => $message ];
	}

	private function warn( string $where, string $message ): void {
		$this->problems[] = [ 'level' => 'warning', 'where' => $where, 'message' => $message ];
	}
}
