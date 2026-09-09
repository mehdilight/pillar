<?php
declare( strict_types=1 );

/**
 * Writes PHP's `FieldType` enum and the editor's TypeScript union from
 * `schema/field-types.json`.
 *
 * The two sides of a field type — the cast and the control — drifted about
 * fifteen types apart in bastet's editor, and the failure is not cosmetic:
 * `Setting::fromArray()` throws on a type it does not know, so one stale entry
 * stops a whole section parsing. Generating both removes the possibility.
 *
 *     php tools/generate-field-types.php [--check]
 *
 * `--check` writes nothing and exits non-zero when either file is stale — what
 * CI runs.
 */

$root  = dirname( __DIR__ );
$check = in_array( '--check', $argv, true );

$spec = json_decode( (string) file_get_contents( $root . '/schema/field-types.json' ), true );

if ( ! is_array( $spec ) || ! isset( $spec['types'] ) ) {
	fwrite( STDERR, "schema/field-types.json is not valid.\n" );
	exit( 1 );
}

$types = $spec['types'];

$cases = '';
$empty = '';
$decor = [];

foreach ( $types as $type ) {
	$name  = (string) $type['name'];
	$const = str_replace( ' ', '', ucwords( str_replace( '_', ' ', $name ) ) );

	$cases .= sprintf( "\tcase %s = '%s';\n", $const, $name );
	$empty .= sprintf( "\t\t\tself::%s => %s,\n", $const, var_export( $type['empty'] ?? null, true ) );

	if ( true === ( $type['decorative'] ?? false ) ) {
		$decor[] = 'self::' . $const;
	}
}

$php = <<<PHP
<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * The setting types a `<schema>` block may declare.
 *
 * GENERATED from schema/field-types.json by tools/generate-field-types.php.
 * Do not edit by hand — the editor's TypeScript union is generated from the
 * same file, and hand-editing one side is how the two drift.
 */
enum FieldType: string {

{$cases}
	/** Types that carry no value — they exist to organise the sidebar. */
	public function isDecorative(): bool {
		return in_array( \$this, [ __DECORATIVE__ ], true );
	}

	/** The value stored when nothing was ever chosen and the schema gave no default. */
	public function emptyValue(): mixed {
		return match ( \$this ) {
{$empty}		};
	}
}

PHP;

$php = str_replace( '__DECORATIVE__', implode( ', ', $decor ), $php );

$union = implode( "\n", array_map( static fn ( array $t ): string => sprintf( "  | '%s'", $t['name'] ), $types ) );
$decorTs = implode( ', ', array_map( static fn ( array $t ): string => sprintf( "'%s'", $t['name'] ), array_filter( $types, static fn ( array $t ): bool => true === ( $t['decorative'] ?? false ) ) ) );

$ts = <<<TS
/**
 * The setting types a `<schema>` block may declare.
 *
 * GENERATED from schema/field-types.json by tools/generate-field-types.php.
 * Do not edit by hand — PHP's FieldType enum is generated from the same file.
 */
export type FieldType =
{$union};

export const DECORATIVE_FIELD_TYPES: FieldType[] = [{$decorTs}];

TS;

$targets = [
	$root . '/src/Schema/FieldType.php'          => $php,
	$root . '/apps/editor/src/types/field-types.ts' => $ts,
];

$stale = [];

foreach ( $targets as $path => $contents ) {
	if ( is_file( $path ) && file_get_contents( $path ) === $contents ) {
		continue;
	}

	$stale[] = $path;

	if ( ! $check ) {
		@mkdir( dirname( $path ), 0777, true );
		file_put_contents( $path, $contents );
	}
}

if ( $check && [] !== $stale ) {
	fwrite( STDERR, "Stale generated files:\n  " . implode( "\n  ", $stale ) . "\nRun: php tools/generate-field-types.php\n" );
	exit( 1 );
}

echo [] === $stale ? "field types up to date\n" : 'wrote ' . count( $stale ) . " file(s)\n";
