<?php
declare( strict_types=1 );

namespace Pillar\Schema;

use Pillar\Site\Layers;

/**
 * Pulls the `<schema>` block out of a section or block file.
 *
 * A regex, not a parse. The dashboard reads every schema on every load, and
 * parsing thirty templates to throw away their markup would be the slowest
 * thing in the product. The block is unambiguous raw JSON between two literal
 * tags, and Liqx captures it verbatim, so nothing is lost by reading it this
 * way.
 *
 * Memoized per type: nested blocks ask for the same handful repeatedly.
 */
final class SchemaParser {

	private const PATTERN = '~<schema\s*>(.*?)</schema\s*>~s';

	/** @var array<string, SectionSchema|null> */
	private array $sections = [];

	/** @var array<string, BlockSchema|null> */
	private array $blocks = [];

	public function __construct( private readonly Layers $layers ) {}

	/** @throws SchemaException */
	public function forSection( string $type ): ?SectionSchema {
		if ( array_key_exists( $type, $this->sections ) ) {
			return $this->sections[ $type ];
		}

		$path = $this->layers->resolve( 'sections/' . $type . '.liqx' );

		if ( null === $path ) {
			return $this->sections[ $type ] = null;
		}

		$json = self::extract( (string) file_get_contents( $path ) );

		// A section with no `<schema>` renders fine — it simply takes no
		// configuration, and the dashboard shows it with no controls.
		return $this->sections[ $type ] = null === $json
			? null
			: SectionSchema::fromArray( $type, $this->decode( $json, 'sections/' . $type . '.liqx' ) );
	}

	/** @throws SchemaException */
	public function forBlock( string $type ): ?BlockSchema {
		if ( array_key_exists( $type, $this->blocks ) ) {
			return $this->blocks[ $type ];
		}

		$path = $this->layers->resolve( 'blocks/' . $type . '.liqx' );

		if ( null === $path ) {
			return $this->blocks[ $type ] = null;
		}

		$json = self::extract( (string) file_get_contents( $path ) );

		return $this->blocks[ $type ] = BlockSchema::fromArray(
			$type,
			null === $json ? [] : $this->decode( $json, 'blocks/' . $type . '.liqx' )
		);
	}

	/**
	 * Every section the site has, with its schema.
	 *
	 * One broken section is collected, not fatal: a typo in one file must not
	 * make the whole site uneditable.
	 *
	 * @param array<string, string> $errors filled with type => message
	 *
	 * @return array<string, SectionSchema>
	 */
	public function allSections( array &$errors = [] ): array {
		$out = [];

		foreach ( array_keys( $this->layers->listing( 'sections' ) ) as $key ) {
			$type = (string) $key;

			try {
				$schema = $this->forSection( $type );

				if ( null !== $schema ) {
					$out[ $type ] = $schema;
				}
			} catch ( SchemaException $error ) {
				$errors[ $type ] = $error->getMessage();
			}
		}

		return $out;
	}

	/**
	 * @param array<string, string> $errors
	 *
	 * @return array<string, BlockSchema>
	 */
	public function allBlocks( array &$errors = [] ): array {
		$out = [];

		foreach ( array_keys( $this->layers->listing( 'blocks' ) ) as $key ) {
			$type = (string) $key;

			try {
				$schema = $this->forBlock( $type );

				if ( null !== $schema ) {
					$out[ $type ] = $schema;
				}
			} catch ( SchemaException $error ) {
				$errors[ $type ] = $error->getMessage();
			}
		}

		return $out;
	}

	public static function extract( string $source ): ?string {
		return preg_match( self::PATTERN, $source, $matches ) ? trim( $matches[1] ) : null;
	}

	/**
	 * @return array<string, mixed>
	 *
	 * @throws SchemaException
	 */
	private function decode( string $json, string $origin ): array {
		$decoded = json_decode( $json, true );

		if ( ! is_array( $decoded ) ) {
			throw new SchemaException( sprintf( 'The <schema> block in %s is not valid JSON: %s', $origin, json_last_error_msg() ) );
		}

		return $decoded;
	}
}
