<?php
declare( strict_types=1 );

namespace Pillar\Tests\Unit;

use Pillar\Dev\Server;
use Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;

/**
 * Publish commits the dashboard's changes and pushes them — or, when asked,
 * commits locally only, to be reviewed or pushed later.
 */
final class PublishTest extends SiteTestCase {

	private string $remote;

	protected function setUp(): void {
		parent::setUp();

		$this->remote = $this->root . '-remote.git';

		$this->git( 'init -q -b main' );
		$this->git( 'config user.email pillar@example.test' );
		$this->git( 'config user.name Pillar' );
		$this->git( 'add -A' );
		$this->git( 'commit -q -m Initial' );
		exec( 'git init -q --bare ' . escapeshellarg( $this->remote ) );
		$this->git( 'remote add origin ' . escapeshellarg( $this->remote ) );
		$this->git( 'push -q -u origin main 2>&1' );
	}

	protected function tearDown(): void {
		self::remove( $this->remote );
		parent::tearDown();
	}

	public function test_a_local_publish_commits_without_pushing(): void {
		file_put_contents( $this->root . '/content/posts/hello-world.md', "---\ntitle: Changed\n---\nBody\n" );

		self::assertSame( 200, $this->publish( [ 'message' => 'Local only', 'push' => false ] )->getStatusCode() );

		self::assertSame( 'Local only', $this->git( 'log -1 --format=%s' ) );
		self::assertSame( 'Initial', trim( (string) shell_exec( 'git --git-dir=' . escapeshellarg( $this->remote ) . ' log -1 --format=%s main' ) ) );
	}

	public function test_publishing_pushes_by_default(): void {
		file_put_contents( $this->root . '/content/posts/hello-world.md', "---\ntitle: Changed\n---\nBody\n" );

		self::assertSame( 200, $this->publish( [ 'message' => 'Pushed' ] )->getStatusCode() );

		self::assertSame( 'Pushed', trim( (string) shell_exec( 'git --git-dir=' . escapeshellarg( $this->remote ) . ' log -1 --format=%s main' ) ) );
	}

	/** @param array<string, mixed> $body */
	private function publish( array $body ): \Symfony\Component\HttpFoundation\Response {
		return ( new Server( $this->root, $this->root . '/no-dashboard' ) )->handle(
			Request::create( '/api/publish', 'POST', [], [], [], [], (string) json_encode( $body ) )
		);
	}

	private function git( string $arguments ): string {
		return trim( (string) shell_exec( 'git -C ' . escapeshellarg( $this->root ) . ' ' . $arguments ) );
	}
}
