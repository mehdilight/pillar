<?php
declare( strict_types=1 );

namespace Pillar\Build;

/**
 * What the last build produced, and what each page depended on.
 *
 * The dependency set is what makes an incremental build correct rather than
 * merely fast: a page is rebuilt when anything it actually read has changed,
 * and "actually read" is recorded by the file system during the render instead
 * of guessed at afterwards.
 */
final class BuildManifest {

	/** @param array<string, array{hash: string, output: string, deps: list<string>}> $pages */
	private function __construct(
		public array $pages = [],
		public string $fingerprint = '',
		/** @var list<string> */
		public array $artifacts = [],
		/** @var list<string> */
		public array $assets = [],
	) {}

	public static function empty(): self {
		return new self();
	}

	public static function load( string $path ): self {
		if ( ! is_file( $path ) ) {
			return self::empty();
		}

		$raw = json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $raw ) ) {
			return self::empty();
		}

		return new self( (array) ( $raw['pages'] ?? [] ), (string) ( $raw['fingerprint'] ?? '' ), (array) ( $raw['artifacts'] ?? [] ), (array) ( $raw['assets'] ?? [] ) );
	}

	public function save( string $path ): void {
		@mkdir( dirname( $path ), 0777, true );

		file_put_contents(
			$path,
			(string) json_encode(
				[ 'fingerprint' => $this->fingerprint, 'pages' => $this->pages, 'artifacts' => $this->artifacts, 'assets' => $this->assets ],
				JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
			)
		);
	}

	/** @param list<string> $deps */
	public function record( string $url, string $hash, string $output, array $deps ): void {
		sort( $deps );

		$this->pages[ $url ] = [ 'hash' => $hash, 'output' => $output, 'deps' => array_values( array_unique( $deps ) ) ];
	}

	public function hashFor( string $url ): ?string {
		return $this->pages[ $url ]['hash'] ?? null;
	}

	/** @return list<string> */
	public function depsFor( string $url ): array {
		return $this->pages[ $url ]['deps'] ?? [];
	}
}
