<?php
declare( strict_types=1 );

namespace Pillar\Render\Drops;

use Phpmystic\Liqx\Drop as LiqxDrop;
use Pillar\Support\Str;

/**
 * Base for objects that control how a template sees them.
 *
 * A theme writes snake_case (`{post.reading_time}`); a drop answers with a
 * public no-argument method (`readingTime()`) or a public property. Liqx routes
 * *every* member access through `beforeMethod()`, so this map is the whole
 * contract.
 *
 * Resolution is a per-class map built once by reflection and cached for the
 * process: reflection happens once per class, never per access, so a drop read
 * inside a loop over 500 posts stays cheap.
 */
abstract class Drop extends LiqxDrop {

	/** @var array<class-string, array<string, array{string, bool}>> name => [member, isProperty] */
	private static array $resolvers = [];

	public function beforeMethod( string $method ): mixed {
		$resolver = self::$resolvers[ static::class ] ??= self::buildResolver( static::class );
		$entry    = $resolver[ $method ] ?? $resolver[ Str::camel( $method ) ] ?? null;

		if ( null === $entry ) {
			return $this->methodMissing( $method );
		}

		[ $member, $isProperty ] = $entry;

		return $isProperty ? $this->{$member} : $this->{$member}();
	}

	/**
	 * Answer a name the resolver does not know.
	 *
	 * Null, not an exception: Liqx renders an unknown value as empty, and a
	 * theme reading a field a particular page happens not to have is ordinary.
	 * `pillar check` is where a genuine typo gets caught, against the schema,
	 * with a file and a line — not here, at render time, on one page.
	 */
	protected function methodMissing( string $name ): mixed {
		return null;
	}

	/** @return array<string, array{string, bool}> */
	private static function buildResolver( string $class ): array {
		$reflection = new \ReflectionClass( $class );
		$resolver   = [];

		foreach ( $reflection->getProperties( \ReflectionProperty::IS_PUBLIC ) as $property ) {
			if ( $property->isStatic() ) {
				continue;
			}

			$name              = $property->getName();
			$resolver[ $name ] = [ $name, true ];
		}

		foreach ( $reflection->getMethods( \ReflectionMethod::IS_PUBLIC ) as $method ) {
			$name = $method->getName();

			if ( $method->isStatic() || $method->getNumberOfRequiredParameters() > 0 || str_starts_with( $name, '__' ) ) {
				continue;
			}

			if ( in_array( $name, [ 'beforeMethod', 'toArray' ], true ) ) {
				continue;
			}

			$resolver[ $name ] ??= [ $name, false ];
		}

		return $resolver;
	}
}
