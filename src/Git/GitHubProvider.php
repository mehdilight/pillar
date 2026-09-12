<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Git;

/**
 * Remote Git provider communicating directly with GitHub's REST API.
 *
 * Used in headless or hosted environments (serverless, cloud containers,
 * Vercel, Netlify) where no local `git` binary or CLI repository exists.
 */
final class GitHubProvider implements GitProviderInterface {

	private string $activeBranch;

	public function __construct(
		private readonly string $root,
		private readonly string $owner,
		private readonly string $repo,
		private readonly string $token,
		string $branch = 'main',
		private readonly string $apiUrl = 'https://api.github.com'
	) {
		$this->activeBranch = $branch;
	}

	public function providerName(): string {
		return 'github';
	}

	public function isRepository(): bool {
		$res = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo );

		return 200 === $res['code'];
	}

	public function branch(): string {
		return $this->activeBranch;
	}

	/** @return list<string> */
	public function branches(): array {
		$res = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo . '/branches?per_page=100' );

		if ( 200 !== $res['code'] || ! is_array( $res['data'] ) ) {
			return [ $this->activeBranch ];
		}

		$branches = [];
		foreach ( $res['data'] as $b ) {
			if ( isset( $b['name'] ) && is_string( $b['name'] ) ) {
				$branches[] = $b['name'];
			}
		}

		return [] === $branches ? [ $this->activeBranch ] : $branches;
	}

	public function hasRemote(): bool {
		return true;
	}

	/** @return list<string> */
	public function changedFiles(): array {
		// Detect modified files under EDITOR_PATHS in the working tree
		$files = [];

		foreach ( self::EDITOR_PATHS as $dir ) {
			$path = $this->root . '/' . $dir;
			if ( ! is_dir( $path ) ) {
				continue;
			}

			$iterator = new \RecursiveIteratorIterator(
				new \RecursiveDirectoryIterator( $path, \FilesystemIterator::SKIP_DOTS )
			);

			foreach ( $iterator as $file ) {
				if ( $file->isFile() ) {
					$rel = substr( $file->getPathname(), strlen( $this->root ) + 1 );
					$files[] = $rel;
				}
			}
		}

		sort( $files );

		return $files;
	}

	/**
	 * @return list<array{hash: string, short: string, message: string, author: string, date: string}>
	 */
	public function history( int $limit = 30, ?string $path = null ): array {
		$endpoint = sprintf(
			'/repos/%s/%s/commits?sha=%s&per_page=%d',
			$this->owner,
			$this->repo,
			urlencode( $this->activeBranch ),
			$limit
		);

		if ( null !== $path && '' !== trim( $path ) ) {
			$endpoint .= '&path=' . urlencode( trim( $path ) );
		}

		$res = $this->api( 'GET', $endpoint );

		if ( 200 !== $res['code'] || ! is_array( $res['data'] ) ) {
			return [];
		}

		$entries = [];

		foreach ( $res['data'] as $item ) {
			$sha     = (string) ( $item['sha'] ?? '' );
			$commit  = (array) ( $item['commit'] ?? [] );
			$message = (string) ( $commit['message'] ?? '' );
			$author  = (array) ( $commit['author'] ?? [] );

			$entries[] = [
				'hash'    => $sha,
				'short'   => substr( $sha, 0, 7 ),
				'message' => strtok( $message, "\n" ) ?: '',
				'author'  => (string) ( $author['name'] ?? ( $item['author']['login'] ?? 'GitHub' ) ),
				'date'    => (string) ( $author['date'] ?? '' ),
			];
		}

		return $entries;
	}

	/** @return array{ok: bool, message: string} */
	public function commit( string $message, bool $push = false, ?string $author = null ): array {
		$changed = $this->changedFiles();

		if ( [] === $changed ) {
			return [ 'ok' => false, 'message' => 'Nothing to publish — the tree is clean.' ];
		}

		// 1. Get current commit on the active branch
		$refRes = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo . '/git/ref/heads/' . $this->activeBranch );
		if ( 200 !== $refRes['code'] ) {
			return [ 'ok' => false, 'message' => 'Could not get branch ref: ' . ( $refRes['data']['message'] ?? 'Not found' ) ];
		}

		$parentSha = (string) ( $refRes['data']['object']['sha'] ?? '' );

		// 2. Get tree of parent commit
		$commitRes = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo . '/git/commits/' . $parentSha );
		$baseTreeSha = (string) ( $commitRes['data']['tree']['sha'] ?? '' );

		// 3. Create tree items for each changed file
		$treeItems = [];

		foreach ( $changed as $file ) {
			$fullPath = $this->root . '/' . $file;
			if ( ! is_file( $fullPath ) ) {
				continue;
			}

			$content = (string) file_get_contents( $fullPath );

			$blobRes = $this->api( 'POST', '/repos/' . $this->owner . '/' . $this->repo . '/git/blobs', [
				'content'  => base64_encode( $content ),
				'encoding' => 'base64',
			] );

			if ( 201 !== $blobRes['code'] || ! isset( $blobRes['data']['sha'] ) ) {
				return [ 'ok' => false, 'message' => 'Failed to upload blob for ' . $file ];
			}

			$treeItems[] = [
				'path' => $file,
				'mode' => '100644',
				'type' => 'blob',
				'sha'  => (string) $blobRes['data']['sha'],
			];
		}

		// 4. Create new tree
		$newTreeRes = $this->api( 'POST', '/repos/' . $this->owner . '/' . $this->repo . '/git/trees', [
			'base_tree' => $baseTreeSha,
			'tree'      => $treeItems,
		] );

		if ( 201 !== $newTreeRes['code'] || ! isset( $newTreeRes['data']['sha'] ) ) {
			return [ 'ok' => false, 'message' => 'Failed to create git tree' ];
		}

		$newTreeSha = (string) $newTreeRes['data']['sha'];

		// 5. Create commit
		$commitPayload = [
			'message' => $message,
			'tree'    => $newTreeSha,
			'parents' => [ $parentSha ],
		];

		if ( null !== $author && '' !== trim( $author ) ) {
			$commitPayload['author'] = [
				'name'  => trim( $author ),
				'email' => 'cms@pillar.site',
				'date'  => date( 'c' ),
			];
		}

		$createCommitRes = $this->api( 'POST', '/repos/' . $this->owner . '/' . $this->repo . '/git/commits', $commitPayload );

		if ( 201 !== $createCommitRes['code'] || ! isset( $createCommitRes['data']['sha'] ) ) {
			return [ 'ok' => false, 'message' => 'Failed to create git commit' ];
		}

		$newCommitSha = (string) $createCommitRes['data']['sha'];

		// 6. Update reference
		$updateRefRes = $this->api( 'PATCH', '/repos/' . $this->owner . '/' . $this->repo . '/git/refs/heads/' . $this->activeBranch, [
			'sha' => $newCommitSha,
		] );

		if ( 200 !== $updateRefRes['code'] ) {
			return [ 'ok' => false, 'message' => 'Failed to update branch ref: ' . ( $updateRefRes['data']['message'] ?? 'unknown error' ) ];
		}

		return [ 'ok' => true, 'message' => 'Committed and published to GitHub.' ];
	}

	public function discard( ?string $path = null ): bool {
		$targetFiles = ( null !== $path && '' !== trim( $path ) )
			? [ trim( $path ) ]
			: $this->changedFiles();

		foreach ( $targetFiles as $file ) {
			$res = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo . '/contents/' . $file . '?ref=' . $this->activeBranch );
			if ( 200 === $res['code'] && isset( $res['data']['content'] ) ) {
				$decoded = base64_decode( (string) $res['data']['content'] );
				$local = $this->root . '/' . $file;
				@mkdir( dirname( $local ), 0777, true );
				file_put_contents( $local, $decoded );
			} elseif ( 404 === $res['code'] ) {
				// New file that does not exist in remote repository
				$local = $this->root . '/' . $file;
				if ( is_file( $local ) ) {
					unlink( $local );
				}
			}
		}

		return true;
	}

	/** @return array{ok: bool, message: string} */
	public function createBranch( string $name, ?string $from = null ): array {
		$name = trim( $name );
		$base = ( null !== $from && '' !== trim( $from ) ) ? trim( $from ) : $this->activeBranch;

		$refRes = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo . '/git/ref/heads/' . $base );
		if ( 200 !== $refRes['code'] ) {
			return [ 'ok' => false, 'message' => sprintf( 'Source branch %s not found.', $base ) ];
		}

		$sha = (string) ( $refRes['data']['object']['sha'] ?? '' );

		$createRes = $this->api( 'POST', '/repos/' . $this->owner . '/' . $this->repo . '/git/refs', [
			'ref' => 'refs/heads/' . $name,
			'sha' => $sha,
		] );

		if ( 201 === $createRes['code'] ) {
			$this->activeBranch = $name;

			return [ 'ok' => true, 'message' => sprintf( 'Created and switched to branch %s.', $name ) ];
		}

		return [ 'ok' => false, 'message' => (string) ( $createRes['data']['message'] ?? 'Failed to create branch.' ) ];
	}

	/** @return array{ok: bool, message: string} */
	public function switchBranch( string $name ): array {
		$name = trim( $name );
		$branches = $this->branches();

		if ( ! in_array( $name, $branches, true ) ) {
			return [ 'ok' => false, 'message' => sprintf( 'Branch %s does not exist.', $name ) ];
		}

		$this->activeBranch = $name;

		return [ 'ok' => true, 'message' => sprintf( 'Switched to branch %s.', $name ) ];
	}

	/** @return array{ok: bool, message: string} */
	public function deleteBranch( string $name ): array {
		$name = trim( $name );
		if ( $name === $this->activeBranch ) {
			return [ 'ok' => false, 'message' => 'Cannot delete the currently active branch.' ];
		}

		$res = $this->api( 'DELETE', '/repos/' . $this->owner . '/' . $this->repo . '/git/refs/heads/' . $name );

		return 204 === $res['code']
			? [ 'ok' => true, 'message' => sprintf( 'Deleted branch %s.', $name ) ]
			: [ 'ok' => false, 'message' => (string) ( $res['data']['message'] ?? 'Failed to delete branch.' ) ];
	}

	/** @return array{ok: bool, message: string} */
	public function mergeBranch( string $source, ?string $message = null ): array {
		$res = $this->api( 'POST', '/repos/' . $this->owner . '/' . $this->repo . '/merges', [
			'base'           => $this->activeBranch,
			'head'           => trim( $source ),
			'commit_message' => $message ?? sprintf( 'Merge branch %s into %s', $source, $this->activeBranch ),
		] );

		if ( 201 === $res['code'] ) {
			return [ 'ok' => true, 'message' => sprintf( 'Merged branch %s.', $source ) ];
		}

		return [ 'ok' => false, 'message' => (string) ( $res['data']['message'] ?? 'Merge conflict or failure.' ) ];
	}

	/** @return array{ok: bool, message: string, url?: string, number?: int} */
	public function createPullRequest( string $title, string $body, string $head, string $base ): array {
		$res = $this->api( 'POST', '/repos/' . $this->owner . '/' . $this->repo . '/pulls', [
			'title' => $title,
			'body'  => $body,
			'head'  => $head,
			'base'  => $base,
		] );

		if ( 201 === $res['code'] && is_array( $res['data'] ) ) {
			return [
				'ok'      => true,
				'message' => 'Pull request created: ' . ( $res['data']['html_url'] ?? '' ),
				'url'     => (string) ( $res['data']['html_url'] ?? '' ),
				'number'  => (int) ( $res['data']['number'] ?? 0 ),
			];
		}

		return [ 'ok' => false, 'message' => (string) ( $res['data']['message'] ?? 'Could not create pull request.' ) ];
	}

	public function diff( ?string $path = null ): string {
		$res = $this->api( 'GET', '/repos/' . $this->owner . '/' . $this->repo . '/compare/main...' . $this->activeBranch );

		if ( 200 !== $res['code'] || ! is_array( $res['data'] ) ) {
			return '';
		}

		$files = (array) ( $res['data']['files'] ?? [] );
		$diff = '';

		foreach ( $files as $f ) {
			$filename = (string) ( $f['filename'] ?? '' );
			if ( null !== $path && '' !== trim( $path ) && $filename !== trim( $path ) ) {
				continue;
			}

			$patch = (string) ( $f['patch'] ?? '' );
			if ( '' !== $patch ) {
				$diff .= "--- a/{$filename}\n+++ b/{$filename}\n{$patch}\n\n";
			}
		}

		return trim( $diff );
	}

	/**
	 * @param array<string, mixed>|null $body
	 *
	 * @return array{code: int, data: mixed}
	 */
	private function api( string $method, string $endpoint, ?array $body = null ): array {
		$url = rtrim( $this->apiUrl, '/' ) . '/' . ltrim( $endpoint, '/' );
		$ch  = curl_init( $url );

		$headers = [
			'Authorization: Bearer ' . $this->token,
			'Accept: application/vnd.github+json',
			'User-Agent: Pillar-CMS',
			'Content-Type: application/json',
		];

		curl_setopt_array( $ch, [
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_CUSTOMREQUEST  => $method,
			CURLOPT_HTTPHEADER     => $headers,
		] );

		if ( null !== $body ) {
			curl_setopt( $ch, CURLOPT_POSTFIELDS, json_encode( $body ) );
		}

		$response = curl_exec( $ch );
		$httpCode = (int) curl_getinfo( $ch, CURLINFO_HTTP_CODE );
		curl_close( $ch );

		$data = is_string( $response ) ? json_decode( $response, true ) : null;

		return [ 'code' => $httpCode, 'data' => $data ];
	}
}
