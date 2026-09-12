<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Git\GitFactory;
use Phpmystic\Pillar\Git\GitHubProvider;
use Phpmystic\Pillar\Git\LocalGit;
use Phpmystic\Pillar\Tests\SiteTestCase;

final class GitTest extends SiteTestCase {

	private LocalGit $git;

	protected function setUp(): void {
		parent::setUp();

		exec( 'git -C ' . escapeshellarg( $this->root ) . ' init -q -b main' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' config user.email pillar@example.test' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' config user.name Pillar' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' add -A' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' commit -q -m Initial' );

		$this->git = new LocalGit( $this->root );
	}

	public function test_it_identifies_as_local_provider(): void {
		self::assertSame( 'local', $this->git->providerName() );
	}

	public function test_it_lists_branches(): void {
		$branches = $this->git->branches();

		self::assertIsArray( $branches );
		self::assertContains( $this->git->branch(), $branches );
	}

	public function test_it_creates_and_switches_branches(): void {
		$created = $this->git->createBranch( 'cms/draft-post' );

		self::assertTrue( $created['ok'] );
		self::assertSame( 'cms/draft-post', $this->git->branch() );
		self::assertContains( 'cms/draft-post', $this->git->branches() );

		// Switch back to original branch
		$switched = $this->git->switchBranch( 'main' );
		if ( ! $switched['ok'] ) {
			// Fallback if main is named master in repo
			$branches = $this->git->branches();
			$switched = $this->git->switchBranch( $branches[0] );
		}
		self::assertTrue( $switched['ok'] );

		// Clean up branch
		$deleted = $this->git->deleteBranch( 'cms/draft-post' );
		self::assertTrue( $deleted['ok'] );
		self::assertNotContains( 'cms/draft-post', $this->git->branches() );
	}

	public function test_it_generates_diff_for_uncommitted_changes(): void {
		file_put_contents( $this->root . '/content/posts/test-diff.md', "---\ntitle: Diff Test\n---\nInitial content.\n" );
		$this->git->commit( 'Add diff test' );

		file_put_contents( $this->root . '/content/posts/test-diff.md', "---\ntitle: Diff Test\n---\nModified content.\n" );

		$diff = $this->git->diff( 'content/posts/test-diff.md' );

		self::assertStringContainsString( 'Modified content', $diff );
	}

	public function test_it_discards_single_file(): void {
		file_put_contents( $this->root . '/content/posts/keep-me.md', "---\ntitle: Keep\n---\nOriginal.\n" );
		file_put_contents( $this->root . '/content/posts/discard-me.md', "---\ntitle: Discard\n---\nOriginal.\n" );
		$this->git->commit( 'Setup discard test' );

		file_put_contents( $this->root . '/content/posts/keep-me.md', "---\ntitle: Keep\n---\nChanged.\n" );
		file_put_contents( $this->root . '/content/posts/discard-me.md', "---\ntitle: Discard\n---\nChanged.\n" );

		self::assertTrue( $this->git->discard( 'content/posts/discard-me.md' ) );

		self::assertStringContainsString( 'Original.', (string) file_get_contents( $this->root . '/content/posts/discard-me.md' ) );
		self::assertStringContainsString( 'Changed.', (string) file_get_contents( $this->root . '/content/posts/keep-me.md' ) );
	}

	public function test_git_factory_resolves_providers(): void {
		$local = GitFactory::create( $this->root );
		self::assertInstanceOf( LocalGit::class, $local );
		self::assertSame( 'local', $local->providerName() );

		// Configure github provider
		putenv( 'PILLAR_GIT_PROVIDER=github' );
		putenv( 'GITHUB_TOKEN=test-token' );
		putenv( 'GITHUB_REPO=acme/site' );

		$github = GitFactory::create( $this->root );
		self::assertInstanceOf( GitHubProvider::class, $github );
		self::assertSame( 'github', $github->providerName() );

		// Clean up env
		putenv( 'PILLAR_GIT_PROVIDER' );
		putenv( 'GITHUB_TOKEN' );
		putenv( 'GITHUB_REPO' );
	}
}
