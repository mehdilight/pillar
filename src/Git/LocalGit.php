<?php
declare( strict_types=1 );

namespace Pillar\Git;

/**
 * Git, through the binary.
 *
 * Not a library: `git` is already installed wherever someone edits a site, and
 * the alternative is a large dependency re-implementing porcelain. This is the
 * whole store — draft is the working tree, publish is a commit, history is
 * `git log`, discard is `git checkout --`.
 *
 * Every operation is scoped to the paths the dashboard owns, so a developer's
 * half-finished `.liqx` is never swept into an editor commit.
 */
final class LocalGit {

	/** The only paths the dashboard writes, and therefore the only ones it commits. */
	public const EDITOR_PATHS = [ 'templates', 'config', 'content', 'assets' ];

	public function __construct( private readonly string $root ) {}

	public function isRepository(): bool {
		return '' !== $this->run( [ 'rev-parse', '--is-inside-work-tree' ] )['out'];
	}

	public function branch(): string {
		$branch = trim( $this->run( [ 'rev-parse', '--abbrev-ref', 'HEAD' ] )['out'] );

		return '' === $branch ? 'main' : $branch;
	}

	public function hasRemote(): bool {
		return '' !== trim( $this->run( [ 'remote' ] )['out'] );
	}

	/**
	 * Uncommitted files under the editor-owned paths.
	 *
	 * @return list<string>
	 */
	public function changedFiles(): array {
		$result = $this->run( array_merge( [ 'status', '--porcelain', '--' ], self::EDITOR_PATHS ) );
		$files  = [];

		foreach ( explode( "\n", trim( $result['out'] ) ) as $line ) {
			if ( '' === trim( $line ) ) {
				continue;
			}

			// "XY path" — and a rename is "XY old -> new", where the new name
			// is the one that exists to be committed.
			$path = trim( substr( $line, 2 ) );

			if ( str_contains( $path, ' -> ' ) ) {
				$path = substr( $path, (int) strpos( $path, ' -> ' ) + 4 );
			}

			$files[] = trim( $path, '"' );
		}

		sort( $files );

		return $files;
	}

	/**
	 * @return list<array{hash: string, short: string, message: string, author: string, date: string}>
	 */
	public function history( int $limit = 30 ): array {
		$result = $this->run( array_merge(
			[ 'log', '--max-count=' . $limit, '--date=iso-strict', '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ad', '--' ],
			self::EDITOR_PATHS
		) );

		$entries = [];

		foreach ( explode( "\n", trim( $result['out'] ) ) as $line ) {
			if ( '' === trim( $line ) ) {
				continue;
			}

			$parts = explode( "\x1f", $line );

			if ( count( $parts ) < 5 ) {
				continue;
			}

			$entries[] = [
				'hash'    => $parts[0],
				'short'   => $parts[1],
				'message' => $parts[2],
				'author'  => $parts[3],
				'date'    => $parts[4],
			];
		}

		return $entries;
	}

	/**
	 * Stage the editor-owned paths and commit them.
	 *
	 * @return array{ok: bool, message: string}
	 */
	public function commit( string $message, bool $push = false ): array {
		if ( [] === $this->changedFiles() ) {
			return [ 'ok' => false, 'message' => 'Nothing to publish — the tree is clean.' ];
		}

		$add = $this->run( array_merge( [ 'add', '--' ], self::EDITOR_PATHS ) );

		if ( 0 !== $add['code'] ) {
			return [ 'ok' => false, 'message' => trim( $add['err'] ) ];
		}

		$commit = $this->run( [ 'commit', '-m', $message ] );

		if ( 0 !== $commit['code'] ) {
			return [ 'ok' => false, 'message' => trim( $commit['err'] ?: $commit['out'] ) ];
		}

		if ( $push && $this->hasRemote() ) {
			$result = $this->run( [ 'push' ] );

			if ( 0 !== $result['code'] ) {
				// The commit stands; only the push failed, and saying so is more
				// useful than reporting the whole publish as a failure.
				return [ 'ok' => true, 'message' => 'Committed, but the push failed: ' . trim( $result['err'] ) ];
			}

			return [ 'ok' => true, 'message' => 'Committed and pushed.' ];
		}

		return [ 'ok' => true, 'message' => 'Committed.' ];
	}

	/** Throw away uncommitted work in the editor-owned paths. */
	public function discard(): bool {
		$this->run( array_merge( [ 'checkout', 'HEAD', '--' ], self::EDITOR_PATHS ) );
		// Files the dashboard created and never committed are not reachable by
		// checkout; they are what `clean` is for.
		$this->run( array_merge( [ 'clean', '-fd', '--' ], self::EDITOR_PATHS ) );

		return true;
	}

	/**
	 * @param list<string> $arguments
	 *
	 * @return array{out: string, err: string, code: int}
	 */
	private function run( array $arguments ): array {
		$command = 'git ' . implode( ' ', array_map( 'escapeshellarg', $arguments ) );

		$process = proc_open(
			$command,
			[ 1 => [ 'pipe', 'w' ], 2 => [ 'pipe', 'w' ] ],
			$pipes,
			$this->root
		);

		if ( ! is_resource( $process ) ) {
			return [ 'out' => '', 'err' => 'could not run git', 'code' => 1 ];
		}

		$out = (string) stream_get_contents( $pipes[1] );
		$err = (string) stream_get_contents( $pipes[2] );

		fclose( $pipes[1] );
		fclose( $pipes[2] );

		return [ 'out' => $out, 'err' => $err, 'code' => proc_close( $process ) ];
	}
}
