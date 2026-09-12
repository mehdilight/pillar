<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Git;

/**
 * Contract for Git providers (local CLI, GitHub REST API, etc.).
 *
 * Scoped to editor-owned paths to guarantee that code outside content,
 * templates, config, and media is never modified by CMS editorial actions.
 */
interface GitProviderInterface {

	/** The only paths the dashboard writes, and therefore the only ones it commits. */
	public const EDITOR_PATHS = [ 'templates', 'config', 'content', 'assets' ];

	/** Whether a valid git repository or remote provider is configured. */
	public function isRepository(): bool;

	/** Name of the active branch. */
	public function branch(): string;

	/**
	 * Available branches in the repository.
	 *
	 * @return list<string>
	 */
	public function branches(): array;

	/** Whether an upstream remote repository is reachable. */
	public function hasRemote(): bool;

	/**
	 * Uncommitted or modified files under editor-owned paths.
	 *
	 * @return list<string>
	 */
	public function changedFiles(): array;

	/**
	 * Commit history for the repository or a specific file path.
	 *
	 * @return list<array{hash: string, short: string, message: string, author: string, date: string}>
	 */
	public function history( int $limit = 30, ?string $path = null ): array;

	/**
	 * Stage and commit changes under editor-owned paths.
	 *
	 * @return array{ok: bool, message: string}
	 */
	public function commit( string $message, bool $push = false, ?string $author = null ): array;

	/**
	 * Discard uncommitted changes across all editor paths or for a single file.
	 */
	public function discard( ?string $path = null ): bool;

	/**
	 * Create a new branch (optionally branching from a specific ref).
	 *
	 * @return array{ok: bool, message: string}
	 */
	public function createBranch( string $name, ?string $from = null ): array;

	/**
	 * Switch the active working branch.
	 *
	 * @return array{ok: bool, message: string}
	 */
	public function switchBranch( string $name ): array;

	/**
	 * Delete a branch.
	 *
	 * @return array{ok: bool, message: string}
	 */
	public function deleteBranch( string $name ): array;

	/**
	 * Merge a source branch into the active branch.
	 *
	 * @return array{ok: bool, message: string}
	 */
	public function mergeBranch( string $source, ?string $message = null ): array;

	/**
	 * Create a Pull Request / Merge Request for review.
	 *
	 * @return array{ok: bool, message: string, url?: string, number?: int}
	 */
	public function createPullRequest( string $title, string $body, string $head, string $base ): array;

	/**
	 * Generate a diff for uncommitted changes or a specific file.
	 */
	public function diff( ?string $path = null ): string;

	/**
	 * The identifier of the provider ('local', 'github', etc.).
	 */
	public function providerName(): string;
}
