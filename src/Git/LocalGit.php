<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Git;

/**
 * Git provider operating through the local `git` CLI binary.
 *
 * Not a library: `git` is already installed wherever someone edits a site, and
 * the alternative is a large dependency re-implementing porcelain. This is the
 * whole store — draft is the working tree, publish is a commit, history is
 * `git log`, discard is `git checkout --`.
 *
 * Every operation is scoped to the paths the dashboard owns, so a developer's
 * half-finished `.liqx` is never swept into an editor commit.
 */
final class LocalGit implements GitProviderInterface {

	public function __construct( private readonly string $root ) {}

	public function providerName(): string {
		return 'local';
	}

	public function isRepository(): bool {
		return '' !== $this->run( [ 'rev-parse', '--is-inside-work-tree' ] )['out'];
	}

	public function branch(): string {
		$branch = trim( $this->run( [ 'rev-parse', '--abbrev-ref', 'HEAD' ] )['out'] );

		return '' === $branch ? 'main' : $branch;
	}

	/** @return list<string> */
	public function branches(): array {
		if ( ! $this->isRepository() ) {
			return [];
		}

		$result = $this->run( [ 'branch', '--list', '--format=%(refname:short)' ] );
		$branches = array_values( array_filter( array_map( 'trim', explode( "\n", $result['out'] ) ) ) );

		return [] === $branches ? [ $this->branch() ] : $branches;
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
	public function history( int $limit = 30, ?string $path = null ): array {
		$paths = ( null !== $path && '' !== trim( $path ) )
			? [ trim( $path ) ]
			: self::EDITOR_PATHS;

		$result = $this->run( array_merge(
			[ 'log', '--max-count=' . $limit, '--date=iso-strict', '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ad', '--' ],
			$paths
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
	public function commit( string $message, bool $push = false, ?string $author = null ): array {
		if ( [] === $this->changedFiles() ) {
			return [ 'ok' => false, 'message' => 'Nothing to publish — the tree is clean.' ];
		}

		$add = $this->run( array_merge( [ 'add', '--' ], self::EDITOR_PATHS ) );

		if ( 0 !== $add['code'] ) {
			return [ 'ok' => false, 'message' => trim( $add['err'] ) ];
		}

		$commitArgs = [ 'commit', '-m', $message ];
		if ( null !== $author && '' !== trim( $author ) ) {
			$commitArgs[] = '--author=' . trim( $author );
		}

		$commit = $this->run( $commitArgs );

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

	/** Throw away uncommitted work in the editor-owned paths or for a specific file. */
	public function discard( ?string $path = null ): bool {
		$paths = ( null !== $path && '' !== trim( $path ) )
			? [ trim( $path ) ]
			: self::EDITOR_PATHS;

		$this->run( array_merge( [ 'checkout', 'HEAD', '--' ], $paths ) );
		$this->run( array_merge( [ 'clean', '-fd', '--' ], $paths ) );

		return true;
	}

	/** @return array{ok: bool, message: string} */
	public function createBranch( string $name, ?string $from = null ): array {
		if ( ! $this->isRepository() ) {
			return [ 'ok' => false, 'message' => 'Not a git repository.' ];
		}

		$name = trim( $name );
		if ( '' === $name || ! preg_match( '/^[a-zA-Z0-9_\-\.\/]+$/', $name ) ) {
			return [ 'ok' => false, 'message' => 'Invalid branch name.' ];
		}

		$args = [ 'checkout', '-b', $name ];
		if ( null !== $from && '' !== trim( $from ) ) {
			$args[] = trim( $from );
		}

		$result = $this->run( $args );

		return 0 === $result['code']
			? [ 'ok' => true, 'message' => sprintf( 'Created and switched to branch %s.', $name ) ]
			: [ 'ok' => false, 'message' => trim( $result['err'] ?: $result['out'] ) ];
	}

	/** @return array{ok: bool, message: string} */
	public function switchBranch( string $name ): array {
		if ( ! $this->isRepository() ) {
			return [ 'ok' => false, 'message' => 'Not a git repository.' ];
		}

		$name = trim( $name );
		if ( '' === $name ) {
			return [ 'ok' => false, 'message' => 'Branch name required.' ];
		}

		$result = $this->run( [ 'checkout', $name ] );

		return 0 === $result['code']
			? [ 'ok' => true, 'message' => sprintf( 'Switched to branch %s.', $name ) ]
			: [ 'ok' => false, 'message' => trim( $result['err'] ?: $result['out'] ) ];
	}

	/** @return array{ok: bool, message: string} */
	public function deleteBranch( string $name ): array {
		if ( ! $this->isRepository() ) {
			return [ 'ok' => false, 'message' => 'Not a git repository.' ];
		}

		$name = trim( $name );
		if ( $name === $this->branch() ) {
			return [ 'ok' => false, 'message' => 'Cannot delete the currently active branch.' ];
		}

		$result = $this->run( [ 'branch', '-D', $name ] );

		return 0 === $result['code']
			? [ 'ok' => true, 'message' => sprintf( 'Deleted branch %s.', $name ) ]
			: [ 'ok' => false, 'message' => trim( $result['err'] ?: $result['out'] ) ];
	}

	/** @return array{ok: bool, message: string} */
	public function mergeBranch( string $source, ?string $message = null ): array {
		if ( ! $this->isRepository() ) {
			return [ 'ok' => false, 'message' => 'Not a git repository.' ];
		}

		$args = [ 'merge', '--no-ff', trim( $source ) ];
		if ( null !== $message && '' !== trim( $message ) ) {
			$args[] = '-m';
			$args[] = trim( $message );
		}

		$result = $this->run( $args );

		return 0 === $result['code']
			? [ 'ok' => true, 'message' => sprintf( 'Merged branch %s.', $source ) ]
			: [ 'ok' => false, 'message' => trim( $result['err'] ?: $result['out'] ) ];
	}

	public function diff( ?string $path = null ): string {
		if ( ! $this->isRepository() ) {
			return '';
		}

		$args = [ 'diff', 'HEAD', '--' ];
		if ( null !== $path && '' !== trim( $path ) ) {
			$args[] = trim( $path );
		} else {
			$args = array_merge( $args, self::EDITOR_PATHS );
		}

		return trim( $this->run( $args )['out'] );
	}

	/** @return array{ok: bool, message: string, url?: string, number?: int} */
	public function createPullRequest( string $title, string $body, string $head, string $base ): array {
		if ( ! $this->isRepository() ) {
			return [ 'ok' => false, 'message' => 'Not a git repository.' ];
		}

		$remote = trim( $this->run( [ 'config', '--get', 'remote.origin.url' ] )['out'] );
		$githubRepo = null;

		if ( preg_match( '#github\.com[:/]([^/]+)/([^/.]+)(\.git)?#', $remote, $matches ) ) {
			$githubRepo = $matches[1] . '/' . $matches[2];
		}

		$token = getenv( 'GITHUB_TOKEN' ) ?: ( $_SERVER['GITHUB_TOKEN'] ?? null );

		if ( null !== $githubRepo && is_string( $token ) && '' !== trim( $token ) ) {
			$ch = curl_init( 'https://api.github.com/repos/' . $githubRepo . '/pulls' );
			curl_setopt_array( $ch, [
				CURLOPT_RETURNTRANSFER => true,
				CURLOPT_POST           => true,
				CURLOPT_HTTPHEADER     => [
					'Authorization: Bearer ' . trim( $token ),
					'Accept: application/vnd.github+json',
					'User-Agent: Pillar-CMS',
				],
				CURLOPT_POSTFIELDS     => json_encode( [
					'title' => $title,
					'body'  => $body,
					'head'  => $head,
					'base'  => $base,
				] ),
			] );

			$response = curl_exec( $ch );
			$httpCode = (int) curl_getinfo( $ch, CURLINFO_HTTP_CODE );
			curl_close( $ch );

			$data = is_string( $response ) ? json_decode( $response, true ) : null;

			if ( $httpCode >= 200 && $httpCode < 300 && is_array( $data ) && isset( $data['html_url'] ) ) {
				return [
					'ok'      => true,
					'message' => 'Pull request created: ' . $data['html_url'],
					'url'     => (string) $data['html_url'],
					'number'  => (int) ( $data['number'] ?? 0 ),
				];
			}

			if ( is_array( $data ) && isset( $data['message'] ) ) {
				return [ 'ok' => false, 'message' => 'GitHub API error: ' . $data['message'] ];
			}
		}

		// Fallback: Generate comparison / PR URL
		if ( null !== $githubRepo ) {
			$url = sprintf(
				'https://github.com/%s/compare/%s...%s?expand=1&title=%s&body=%s',
				$githubRepo,
				rawurlencode( $base ),
				rawurlencode( $head ),
				rawurlencode( $title ),
				rawurlencode( $body )
			);

			return [
				'ok'      => true,
				'message' => 'Ready to create pull request: ' . $url,
				'url'     => $url,
			];
		}

		return [ 'ok' => false, 'message' => 'No GitHub remote or GITHUB_TOKEN configured.' ];
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
