<?php
declare( strict_types=1 );

namespace Pillar\Content;

use Pillar\PillarException;
use Pillar\Schema\ContentSchema;
use Pillar\Schema\Setting;
use Pillar\Site\Site;

/**
 * Creating and changing a content type.
 *
 * A content type is three things on disk, and before this class you had to
 * write all three by hand:
 *
 *   schemas/<name>.json        the fields — what the dashboard's form shows
 *   content/<name>/            where the markdown lives
 *   templates/<singular>.json  how one entry renders
 *
 * None of that changes: this writes exactly the files a person would have
 * written, so a type created in the dashboard is indistinguishable from one
 * typed into an editor, and either can be edited the other way.
 */
final class ContentType {

	/** The fields a new type starts with, by preset name. */
	public const PRESETS = [
		'title'   => [ 'id' => 'title', 'type' => 'text', 'label' => 'Title' ],
		'date'    => [ 'id' => 'date', 'type' => 'date', 'label' => 'Date' ],
		'summary' => [ 'id' => 'summary', 'type' => 'textarea', 'label' => 'Summary' ],
		'tags'    => [ 'id' => 'tags', 'type' => 'tags', 'label' => 'Tags' ],
		'image'   => [ 'id' => 'image', 'type' => 'image', 'label' => 'Cover image' ],
		'order'   => [ 'id' => 'order', 'type' => 'number', 'label' => 'Position', 'default' => 10 ],
		'draft'   => [ 'id' => 'draft', 'type' => 'checkbox', 'label' => 'Draft', 'default' => false ],
	];

	/** What a type gets when nothing was asked for: a blog-shaped entry. */
	public const DEFAULT_FIELDS = [ 'title', 'date', 'tags', 'draft' ];

	public function __construct( private readonly Site $site ) {}

	/**
	 * Create a content type.
	 *
	 * @param list<array<string, mixed>>|null $fields raw field definitions; the
	 *        default preset when null
	 *
	 * @return array{name: string, singular: string, files: list<string>, notes: list<string>}
	 *
	 * @throws PillarException
	 */
	public function create( string $name, string $label = '', ?array $fields = null, bool $withTemplate = true ): array {
		$name = $this->validName( $name );

		if ( is_dir( $this->site->absolute( 'content/' . $name ) ) || null !== $this->site->layers()->resolve( 'schemas/' . $name . '.json' ) ) {
			throw new PillarException( sprintf( 'A "%s" collection already exists.', $name ) );
		}

		$fields ??= array_map( static fn ( string $key ): array => self::PRESETS[ $key ], self::DEFAULT_FIELDS );

		// Parsed before anything is written: a bad field type should fail here,
		// not leave a half-created type behind.
		ContentSchema::fromArray( $name, [ 'label' => $label, 'fields' => $fields ] );

		$files = [];
		$notes = [];

		$files[] = $this->writeSchema( $name, '' !== $label ? $label : ucfirst( str_replace( '-', ' ', $name ) ), $fields );
		$files[] = $this->makeDirectory( $name );

		$singular = self::singular( $name );

		if ( $withTemplate ) {
			$template = $this->writeTemplate( $singular, $notes );

			if ( null !== $template ) {
				$files[] = $template;
			}
		} else {
			$notes[] = sprintf( 'Entries will render through templates/page.json until templates/%s.json exists.', $singular );
		}

		return [ 'name' => $name, 'singular' => $singular, 'files' => $files, 'notes' => $notes ];
	}

	/**
	 * Replace a type's fields.
	 *
	 * @param list<array<string, mixed>> $fields
	 *
	 * @throws PillarException
	 */
	public function update( string $name, string $label, array $fields ): string {
		$name = $this->validName( $name );

		if ( null === $this->site->layers()->resolve( 'schemas/' . $name . '.json' ) ) {
			throw new PillarException( sprintf( 'No "%s" collection to update.', $name ) );
		}

		ContentSchema::fromArray( $name, [ 'label' => $label, 'fields' => $fields ] );

		return $this->writeSchema( $name, $label, $fields );
	}

	/**
	 * Every content type the site has: declared, or simply a folder of markdown.
	 *
	 * A type with a schema and no entries yet counts — otherwise creating one
	 * and then adding its first entry is impossible, since it would not appear
	 * anywhere to add an entry to.
	 *
	 * @return array<string, array{label: string, schema: ContentSchema|null, count: int}>
	 */
	public function all( ContentStore $content ): array {
		$declared = ContentSchema::all( $this->site->layers() );
		$files    = $content->files();
		$out      = [];

		foreach ( array_unique( array_merge( array_keys( $declared ), array_keys( $files ) ) ) as $key ) {
			$name   = (string) $key;
			$schema = $declared[ $name ] ?? null;

			$out[ $name ] = [
				'label'  => null === $schema ? ucfirst( str_replace( '-', ' ', $name ) ) : $schema->label,
				'schema' => $schema,
				'count'  => count( $files[ $name ] ?? [] ),
			];
		}

		ksort( $out );

		return $out;
	}

	/**
	 * The template name a collection's entries render through.
	 *
	 * `posts` → `post`. English-only and deliberately dumb: the alternative is
	 * an inflection library for a rule a site author can override per entry.
	 */
	public static function singular( string $collection ): string {
		return str_ends_with( $collection, 's' ) ? substr( $collection, 0, -1 ) : $collection;
	}

	/** @param list<array<string, mixed>> $fields */
	private function writeSchema( string $name, string $label, array $fields ): string {
		$relative = 'schemas/' . $name . '.json';

		$this->put(
			$relative,
			(string) json_encode(
				[ 'label' => $label, 'fields' => $fields ],
				JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
			) . "\n"
		);

		return $relative;
	}

	private function makeDirectory( string $name ): string {
		$relative = 'content/' . $name;
		$path     = $this->site->absolute( $relative );

		if ( ! is_dir( $path ) && ! @mkdir( $path, 0777, true ) && ! is_dir( $path ) ) {
			throw new PillarException( sprintf( 'Could not create %s', $relative ) );
		}

		// Git does not track an empty directory, and a content type that
		// vanishes on clone is worse than a stray file.
		$this->put( $relative . '/.gitkeep', '' );

		return $relative . '/';
	}

	/**
	 * Scaffold the entry template, by copying `page.json` when the site has one.
	 *
	 * Copying beats inventing: whatever section the site already uses to render
	 * a page's title and body is the right one for a new type's entries too,
	 * and it stays editable in the dashboard from the first minute.
	 *
	 * @param list<string> $notes
	 */
	private function writeTemplate( string $singular, array &$notes ): ?string {
		$relative = 'templates/' . $singular . '.json';

		if ( null !== $this->site->layers()->resolve( $relative ) ) {
			$notes[] = sprintf( '%s already exists and was left alone.', $relative );

			return null;
		}

		$source = $this->site->layers()->resolve( 'templates/page.json' );

		if ( null === $source ) {
			$notes[] = sprintf(
				'No templates/page.json to copy, so %s was not created — entries will not render until a template exists.',
				$relative
			);

			return null;
		}

		$this->put( $relative, (string) file_get_contents( $source ) );

		return $relative;
	}

	/**
	 * A name that is going to become a folder.
	 *
	 * Checked as given, not slugified first: slugifying `../escaped` produces
	 * `escaped`, which is a perfectly good name for a directory nobody asked
	 * for. A name that needs cleaning up is a mistake worth reporting.
	 */
	private function validName( string $name ): string {
		$name = trim( $name );

		if ( ! preg_match( '/^[a-z][a-z0-9-]*$/', $name ) ) {
			throw new PillarException(
				sprintf( '"%s" is not a usable collection name — lowercase letters, digits and hyphens.', $name )
			);
		}

		return $name;
	}

	private function put( string $relative, string $contents ): void {
		$path = $this->site->absolute( $relative );

		@mkdir( dirname( $path ), 0777, true );

		if ( false === file_put_contents( $path, $contents ) ) {
			throw new PillarException( sprintf( 'Could not write %s', $relative ) );
		}
	}
}
