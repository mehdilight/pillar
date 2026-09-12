<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Dev\Server;
use Phpmystic\Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * B4: the dashboard's API, over the working tree.
 *
 * `Server` takes a Request and returns a Response, so the whole surface is
 * testable without starting a server — which is why the router script is four
 * lines and holds no logic.
 */
final class DevApiTest extends SiteTestCase {

	public function test_health_answers_with_the_site(): void {
		$body = $this->json( 'GET', '/api/health' );

		self::assertTrue( $body['ok'] );
		self::assertSame( 'Fixture site', $body['site'] );
	}

	public function test_templates_lists_pages_with_the_route_each_previews(): void {
		$templates = $this->json( 'GET', '/api/templates' );
		$byName    = array_column( $templates, null, 'name' );

		self::assertSame( '/', $byName['index']['route'] );
		// A content template has no page of its own, so it previews a real item.
		self::assertSame( '/posts/unfinished/', $byName['post']['route'] );
		self::assertSame( 'Content', $byName['post']['group'] );
	}

	public function test_a_section_accepting_theme_blocks_is_offered_every_public_block_file(): void {
		@mkdir( $this->root . '/blocks', 0777, true );
		file_put_contents( $this->root . '/blocks/card.liqx', "<div>{block.settings.title}</div>\n<schema>{\"name\": \"Card\", \"settings\": [{\"id\": \"title\", \"type\": \"text\"}]}</schema>" );
		file_put_contents( $this->root . '/blocks/_internal.liqx', "<div></div>\n<schema>{\"name\": \"Internal\"}</schema>" );
		file_put_contents( $this->root . '/sections/cards.liqx', "<div></div>\n<schema>{\"name\": \"Cards\", \"accepts\": [\"@theme\"]}</schema>" );

		$payload   = $this->json( 'GET', '/api/templates/index' );
		$available = array_column( $payload['availableSections'], null, 'type' );

		self::assertSame( [ 'card' ], $available['cards']['accepts'] );
		self::assertContains( 'card', array_column( $payload['availableBlocks'], 'type' ) );
	}

	public function test_a_template_carries_its_sections_and_their_schemas(): void {
		$payload = $this->json( 'GET', '/api/templates/index' );
		$hero    = $payload['sections'][0];

		self::assertSame( 'hero_a1', $hero['section_id'] );
		self::assertSame( 'Build sites that outlive their tools', $hero['settings']['heading'] );
		self::assertSame( 'Hero', $hero['schema']['name'] );
		self::assertSame( [ 'heading', 'subheading', 'padding' ], array_column( $hero['schema']['settings'], 'id' ) );

		// Layout sections travel with the page: the sidebar shows one list.
		self::assertSame( [ 'header', 'footer' ], array_column( $payload['layout'], 'section_type' ) );
		self::assertContains( 'hero', array_column( $payload['availableSections'], 'type' ) );
	}

	public function test_saving_a_template_writes_the_file(): void {
		$payload  = $this->json( 'GET', '/api/templates/index' );
		$sections = $payload['sections'];

		$sections[0]['settings']['heading'] = 'Written by the dashboard';

		$this->request( 'PUT', '/api/templates/index', [ 'sections' => $sections ] );

		$written = json_decode( (string) file_get_contents( $this->root . '/templates/index.json' ), true );

		self::assertSame( 'Written by the dashboard', $written['sections']['hero_a1']['settings']['heading'] );
		self::assertSame( [ 'hero_a1', 'features_b2', 'posts_c3', 'hidden_d4' ], $written['order'], 'order is preserved' );
	}

	public function test_saving_a_paginated_template_syncs_per_page_with_section_limit(): void {
		file_put_contents(
			$this->root . '/templates/blog.json',
			(string) json_encode( [
				'paginate' => [ 'collection' => 'posts', 'per_page' => 10 ],
				'sections' => [
					'list' => [
						'section_type' => 'post-list',
						'settings'     => [ 'source' => 'posts', 'limit' => 10 ],
					],
				],
				'order'    => [ 'list' ],
			] )
		);

		$this->request( 'PUT', '/api/templates/blog', [
			'sections' => [
				[
					'section_id'   => 'list',
					'section_type' => 'post-list',
					'settings'     => [ 'source' => 'posts', 'limit' => 2 ],
				],
			],
		] );

		$written = json_decode( (string) file_get_contents( $this->root . '/templates/blog.json' ), true );

		self::assertSame( 2, $written['paginate']['per_page'] );
		self::assertSame( 2, $written['sections']['list']['settings']['limit'] );
	}


	public function test_navigation_lists_are_saved_and_available_to_templates(): void {
		$this->request( 'PUT', '/api/menus', [ 'menus' => [
			'main' => [
				'title' => 'Main navigation',
				'items' => [ [ 'title' => 'About', 'url' => '/about/' ] ],
			],
		] ] );

		$menus = $this->json( 'GET', '/api/menus' );
		self::assertSame( 'Main navigation', $menus['main']['title'] );
		self::assertSame( '/about/', $menus['main']['items'][0]['url'] );

		file_put_contents( $this->root . '/sections/header.liqx', '<nav>{menus.main.items.map((link) => <a href={link.url}>{link.title}</a>)}</nav>' );

		self::assertStringContainsString( '<a href="/about/">About</a>', $this->pillar()->render( 'index' ) );
		self::assertFileExists( $this->root . '/data/menus.json' );
	}

	public function test_content_is_listed_with_the_fields_its_schema_declares(): void {
		$collections = array_column( $this->json( 'GET', '/api/content' ), null, 'name' );

		self::assertSame( 3, $collections['posts']['count'], 'drafts included — the editor edits them' );
		self::assertSame( [ 'title', 'date', 'tags', 'layout', 'draft' ], array_column( $collections['posts']['fields'], 'id' ) );
		self::assertSame( [], $collections['pages']['fields'], 'a collection with no schema still lists' );
	}

	public function test_saving_content_writes_a_normal_markdown_file(): void {
		$this->request( 'PUT', '/api/content/posts/hello-world', [
			'frontmatter' => [ 'title' => 'Renamed', 'date' => '2026-08-01', 'tags' => [ 'meta' ] ],
			'body'        => "# Renamed\n\nEdited.\n",
		] );

		$file = (string) file_get_contents( $this->root . '/content/posts/hello-world.md' );

		self::assertStringStartsWith( "---\n", $file );
		self::assertStringContainsString( 'title: Renamed', $file );
		self::assertStringContainsString( "# Renamed", $file );
		// It has to stay a file a developer can open in an editor.
		self::assertSame( 'Renamed', $this->pillar( drafts: true )->content->find( 'posts', 'hello-world' )?->title() );
	}

	public function test_deleting_content_removes_the_file(): void {
		$this->request( 'DELETE', '/api/content/posts/why-static' );

		self::assertFileDoesNotExist( $this->root . '/content/posts/why-static.md' );
	}

	public function test_a_path_that_tries_to_escape_the_site_is_refused(): void {
		$response = $this->request( 'PUT', '/api/templates/..%2F..%2Fescaped', [ 'sections' => [] ] );

		self::assertSame( 422, $response->getStatusCode() );
		self::assertFileDoesNotExist( dirname( $this->root ) . '/escaped.json' );
	}

	public function test_status_is_honest_when_the_site_is_not_a_repository(): void {
		$status = $this->json( 'GET', '/api/status' );

		self::assertSame( 0, $status['count'] );
		self::assertSame( 'no repository', $status['branch'] );
	}

	public function test_the_preview_renders_with_the_editor_attributes(): void {
		$response = $this->request( 'GET', '/preview/' );

		self::assertSame( 200, $response->getStatusCode() );
		self::assertStringContainsString( 'data-pillar-section-id="hero_a1"', (string) $response->getContent() );
	}

	public function test_the_preview_names_the_routes_it_has_when_asked_for_one_it_does_not(): void {
		$response = $this->request( 'GET', '/preview/nope/' );

		self::assertSame( 404, $response->getStatusCode() );
		self::assertStringContainsString( '/posts/hello-world/', (string) $response->getContent() );
	}

	public function test_a_broken_section_surfaces_in_the_preview_rather_than_leaving_a_hole(): void {
		file_put_contents( $this->root . '/sections/hero.liqx', '<div>{ broken' );

		$html = (string) $this->request( 'GET', '/preview/' )->getContent();

		self::assertStringContainsString( 'section(s) failed to render', $html );
		self::assertStringContainsString( '© Fixture', $html, 'the rest of the page still renders' );
	}

	public function test_git_branch_endpoints(): void {
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' init -q -b main' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' config user.email pillar@example.test' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' config user.name Pillar' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' add -A' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' commit -q -m Initial' );

		$branches = $this->json( 'GET', '/api/git/branches' );
		self::assertSame( 'local', $branches['provider'] );
		self::assertIsArray( $branches['branches'] );

		// Create branch
		$createRes = $this->request( 'POST', '/api/git/branches', [ 'name' => 'editorial/review-1' ] );
		self::assertSame( 200, $createRes->getStatusCode() );

		// List branches includes new branch
		$updated = $this->json( 'GET', '/api/git/branches' );
		self::assertContains( 'editorial/review-1', $updated['branches'] );
		self::assertSame( 'editorial/review-1', $updated['current'] );

		// Switch back
		$switchRes = $this->request( 'POST', '/api/git/branches/switch', [ 'name' => 'main' ] );
		self::assertSame( 200, $switchRes->getStatusCode() );

		// Delete branch
		$deleteRes = $this->request( 'POST', '/api/git/branches/delete', [ 'name' => 'editorial/review-1' ] );
		self::assertSame( 200, $deleteRes->getStatusCode() );
	}

	public function test_git_diff_endpoint(): void {
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' init -q -b main' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' config user.email pillar@example.test' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' config user.name Pillar' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' add -A' );
		exec( 'git -C ' . escapeshellarg( $this->root ) . ' commit -q -m Initial' );

		file_put_contents( $this->root . '/content/posts/api-diff.md', "---\ntitle: Diff\n---\nInitial\n" );
		$this->request( 'POST', '/api/publish', [ 'message' => 'Diff base' ] );

		file_put_contents( $this->root . '/content/posts/api-diff.md', "---\ntitle: Diff\n---\nUpdated\n" );

		$diff = $this->json( 'GET', '/api/git/diff?path=content/posts/api-diff.md' );
		self::assertStringContainsString( 'Updated', $diff['diff'] );
	}

	public function test_git_config_endpoint(): void {
		$initial = $this->json( 'GET', '/api/git/config' );
		self::assertArrayHasKey( 'provider', $initial );
		self::assertArrayHasKey( 'active_provider', $initial );
		self::assertArrayHasKey( 'author_name', $initial );

		$saveRes = $this->request( 'POST', '/api/git/config', [
			'provider'     => 'local',
			'author_name'  => 'Test Editor',
			'author_email' => 'editor@example.com',
			'github'       => [
				'repo'   => 'acme/mysite',
				'branch' => 'main',
				'token'  => 'ghp_secret123',
			],
		] );
		self::assertSame( 200, $saveRes->getStatusCode() );

		$updated = $this->json( 'GET', '/api/git/config' );
		self::assertSame( 'local', $updated['provider'] );
		self::assertSame( 'Test Editor', $updated['author_name'] );
		self::assertSame( 'editor@example.com', $updated['author_email'] );
		self::assertSame( 'acme/mysite', $updated['github']['repo'] );
		self::assertTrue( $updated['github']['has_token'] );
		self::assertArrayNotHasKey( 'token', $updated['github'], 'raw token is never returned' );
	}

	public function test_site_assets_are_served_with_their_real_content_type(): void {
		$response = $this->request( 'GET', '/assets/base.css' );

		self::assertSame( 200, $response->getStatusCode() );
		// A module script served as text/html is refused outright by the
		// browser, with a blank page and nothing in the console as the symptom.
		self::assertSame( 'text/css; charset=utf-8', $response->headers->get( 'Content-Type' ) );
	}

	/** @param array<string, mixed>|null $body */
	private function request( string $method, string $uri, ?array $body = null ): Response {
		$request = Request::create( $uri, $method, [], [], [], [], null === $body ? null : (string) json_encode( $body ) );

		return ( new Server( $this->root, $this->root . '/no-dashboard' ) )->handle( $request );
	}

	/** @return array<mixed> */
	private function json( string $method, string $uri ): array {
		return (array) json_decode( (string) $this->request( $method, $uri )->getContent(), true );
	}
}
