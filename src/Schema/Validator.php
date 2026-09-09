<?php
declare( strict_types=1 );

namespace Pillar\Schema;

use Pillar\Content\ContentStore;
use Pillar\Content\MarkdownFile;
use Pillar\PillarException;
use Pillar\Site\Site;
use Pillar\Template\PageTemplate;
use Pillar\Template\SectionInstance;

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

		foreach ( $layers->listing( 'templates', 'json' ) as $name => $path ) {
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

		foreach ( $schema->fields as $field ) {
			if ( ! array_key_exists( $field->id, $file->frontmatter ) ) {
				continue;
			}

			$value = $file->frontmatter[ $field->id ];
			$type  = $this->describe( $field->type );

			if ( null !== $type && ! $this->matches( $field->type, $value ) ) {
				$this->error(
					$where,
					sprintf( '"%s" should be %s, got %s.', $field->id, $type, get_debug_type( $value ) )
				);
			}

			if ( [] !== $field->options && is_scalar( $value ) ) {
				$allowed = array_column( $field->options, 'value' );

				if ( ! in_array( (string) $value, $allowed, true ) ) {
					$this->error( $where, sprintf( '"%s" is "%s"; allowed: %s.', $field->id, $value, implode( ', ', $allowed ) ) );
				}
			}
		}
	}

	private function describe( FieldType $type ): ?string {
		return match ( $type ) {
			FieldType::Checkbox => 'a boolean',
			FieldType::Number, FieldType::Range => 'a number',
			FieldType::Tags => 'a list',
			FieldType::Text, FieldType::Textarea, FieldType::Url, FieldType::Date => 'a string',
			default => null,
		};
	}

	private function matches( FieldType $type, mixed $value ): bool {
		return match ( $type ) {
			FieldType::Checkbox => is_bool( $value ),
			FieldType::Number, FieldType::Range => is_int( $value ) || is_float( $value ),
			FieldType::Tags => is_array( $value ),
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
