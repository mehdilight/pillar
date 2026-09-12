<?php
declare( strict_types=1 );
namespace Phpmystic\Pillar\Tests\Unit;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\Build\RouteTable;
use Phpmystic\Pillar\Dev\Server;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Tests\SiteTestCase;
use Symfony\Component\HttpFoundation\Request;

final class SeoTest extends SiteTestCase {
	protected function setUp(): void {
		parent::setUp();
		$this->enable( [ 'seo' ] );
		file_put_contents( $this->root . '/layout/theme.liqx', '<html><head>{content_for_header}</head><body>{content_for_layout}</body></html>' );
	}
	private function enable( array $plugins ): void {
		$config = json_decode( (string) file_get_contents( $this->root . '/site.json' ), true );
		$config['plugins'] = $plugins;
		$config['base_url'] = 'https://example.test';
		file_put_contents( $this->root . '/site.json', json_encode( $config ) );
	}
	private function settings( array $settings ): void {
		@mkdir( $this->root . '/config/plugins', 0777, true );
		file_put_contents( $this->root . '/config/plugins/seo.json', json_encode( $settings ) );
	}
	private function post( array $meta = [], bool $draft = false ): void {
		file_put_contents( $this->root . '/content/posts/hello-world.md', "---\n" . \Symfony\Component\Yaml\Yaml::dump( [ 'title' => 'Hello world', 'date' => '2026-08-01', 'author' => 'A Writer', 'seo' => $meta, 'draft' => $draft ], 4, 2 ) . "---\nA useful article about static sites.\n" );
	}
	private function renderPost( bool $preview = false ): string {
		$pillar = $this->pillar( editor: $preview, drafts: $preview );
		$page = $pillar->content->page( $pillar->content->find( 'posts', 'hello-world' ) );
		return $pillar->render( 'post', '/posts/hello-world/', [ 'page' => $page ] );
	}
	private function build(): array { return ( new Builder( $this->pillar() ) )->build(); }
	private function api( string $path, string $method = 'GET', array $body = [] ): \Symfony\Component\HttpFoundation\Response {
		return ( new Server( $this->root, dirname( __DIR__, 2 ) . '/public/editor' ) )->handle( Request::create( $path, $method, [], [], [], [], json_encode( $body ) ) );
	}

	public function test_port_emits_one_title_canonical_social_and_connected_graph(): void {
		$this->post();
		$this->settings( [ 'site_name' => 'Writing' ] );
		$html = $this->renderPost();
		self::assertSame( 1, substr_count( $html, '<title>' ) );
		self::assertStringContainsString( '<title>Hello world · Writing</title>', $html );
		self::assertSame( 1, substr_count( $html, 'rel="canonical"' ) );
		self::assertStringContainsString( 'href="https://example.test/posts/hello-world/"', $html );
		self::assertStringContainsString( 'property="og:type" content="article"', $html );
		preg_match( '#<script type="application/ld\+json">(.*?)</script>#s', $html, $match );
		$graph = json_decode( $match[1], true, flags: JSON_THROW_ON_ERROR )['@graph'];
		$nodes = array_column( $graph, null, '@type' );
		self::assertSame( $nodes['WebSite']['@id'], $nodes['WebPage']['isPartOf']['@id'] );
		self::assertSame( $nodes['WebPage']['@id'], $nodes['BlogPosting']['mainEntityOfPage']['@id'] );
		self::assertSame( 'A Writer', $nodes['BlogPosting']['author']['name'] );
	}
	public function test_overrides_escape_markup_and_json_ld_cannot_close_its_script(): void {
		$this->post( [ 'title' => 'A "quote" & <script>oops</script>', 'description' => '</script><img src=x onerror=alert(1)>', 'og_title' => 'Social override' ] );
		$this->settings( [ 'organization_name' => '</script><img src=x>' ] );
		$html = $this->renderPost();
		self::assertStringContainsString( '&quot;quote&quot; &amp;', $html );
		self::assertStringNotContainsString( '</script><img', $html );
		self::assertStringContainsString( '\u003C/script\u003E', $html );
		self::assertStringContainsString( 'property="og:title" content="Social override"', $html );
	}
	public function test_preview_is_noindex_with_no_public_canonical_or_graph(): void {
		$html = $this->renderPost( true );
		self::assertStringContainsString( 'content="noindex, nofollow"', $html );
		self::assertStringNotContainsString( 'rel="canonical"', $html );
		self::assertStringNotContainsString( 'application/ld+json', $html );
		$response = $this->api( '/preview/posts/hello-world/' );
		self::assertSame( 'noindex, nofollow', $response->headers->get( 'X-Robots-Tag' ) );
	}
	public function test_sitemap_filters_drafts_noindex_404_and_other_canonicals(): void {
		$this->post( [ 'noindex' => true ] );
		file_put_contents( $this->root . '/content/posts/draft.md', "---\ntitle: Draft\ndraft: true\n---\nPrivate" );
		file_put_contents( $this->root . '/templates/404.json', '{}' );
		$this->settings( [ 'routes' => [ '/about/' => [ 'canonical' => 'https://elsewhere.test/about/' ] ] ] );
		$this->build();
		$xml = file_get_contents( $this->root . '/dist/sitemap.xml' );
		self::assertStringNotContainsString( 'hello-world', $xml );
		self::assertStringNotContainsString( '/draft/', $xml );
		self::assertStringNotContainsString( '404', $xml );
		self::assertStringNotContainsString( '/about/', $xml );
		self::assertStringContainsString( '/posts/why-static/', $xml );
		self::assertStringContainsString( '<loc>https://example.test/</loc>', $xml );
		self::assertFileDoesNotExist( $this->root . '/dist/posts/draft/index.html' );
		self::assertStringContainsString( "\nSitemap: https://example.test/sitemap.xml\n", file_get_contents( $this->root . '/dist/robots.txt' ) );
	}
	public function test_sitemap_chunks_are_removed_when_the_setting_changes(): void {
		$this->settings( [ 'sitemap_page_size' => 2 ] );
		$this->build();
		self::assertStringContainsString( '<sitemapindex', file_get_contents( $this->root . '/dist/sitemap.xml' ) );
		self::assertFileExists( $this->root . '/dist/sitemap-2.xml' );
		$this->settings( [ 'sitemap_enabled' => false ] );
		$this->build();
		self::assertFileDoesNotExist( $this->root . '/dist/sitemap.xml' );
		self::assertFileDoesNotExist( $this->root . '/dist/sitemap-2.xml' );
		self::assertStringNotContainsString( 'Sitemap:', file_get_contents( $this->root . '/dist/robots.txt' ) );
	}
	public function test_disabling_the_plugin_removes_its_artifacts_and_keeps_a_default_title(): void {
		$this->build();
		$this->enable( [] );
		$this->build();
		self::assertFileDoesNotExist( $this->root . '/dist/sitemap.xml' );
		self::assertFileDoesNotExist( $this->root . '/dist/robots.txt' );
		self::assertStringContainsString( '<title>', file_get_contents( $this->root . '/dist/index.html' ) );
		self::assertStringNotContainsString( 'og:title', file_get_contents( $this->root . '/dist/index.html' ) );
	}
	public function test_settings_create_and_edit_invalidate_incremental_output(): void {
		$this->build();
		self::assertSame( 0, $this->build()['written'] );
		$this->settings( [ 'site_name' => 'New name' ] );
		self::assertSame( 4, $this->build()['written'] );
		self::assertStringContainsString( 'New name', file_get_contents( $this->root . '/dist/index.html' ) );
		self::assertSame( 0, $this->build()['written'] );
	}
	public function test_social_images_use_real_hashed_assets(): void {
		file_put_contents( $this->root . '/assets/card.svg', '<svg xmlns="http://www.w3.org/2000/svg" />' );
		$this->settings( [ 'social_image' => '/assets/card.svg', 'organization_logo' => 'card.svg' ] );
		$this->build();
		$file = basename( glob( $this->root . '/dist/assets/card.*.svg' )[0] );
		$html = file_get_contents( $this->root . '/dist/index.html' );
		self::assertStringContainsString( 'content="https://example.test/assets/' . $file . '"', $html );
		self::assertStringContainsString( '"logo":{"@type":"ImageObject","url":"https://example.test/assets/' . $file . '"}', $html );
	}
	public function test_paginated_canonical_keeps_page_two_and_ignores_tracking_query(): void {
		$pillar = $this->pillar();
		$html = $pillar->render( 'index', '/blog/page/2/?utm_source=test' );
		self::assertStringContainsString( 'href="https://example.test/blog/page/2/"', $html );
		self::assertStringNotContainsString( 'utm_source', $html );
	}
	public function test_unsafe_canonical_falls_back_to_the_page_url(): void {
		$this->post( [ 'canonical' => 'javascript:alert(1)' ] );
		self::assertStringContainsString( 'href="https://example.test/posts/hello-world/"', $this->renderPost() );
	}
	public function test_settings_and_content_preview_use_the_public_editor_api(): void {
		$this->settings( [ 'routes' => [ '/' => [ 'title' => 'Home override' ] ] ] );
		$schema = $this->api( '/api/settings/schema' );
		self::assertStringContainsString( 'plugin:seo:title_page', $schema->getContent() );
		$response = $this->api( '/api/settings', 'PUT', [ 'settings' => [ 'site_title' => 'Theme name', 'plugin:seo:site_name' => 'SEO name' ] ] );
		self::assertSame( 200, $response->getStatusCode() );
		$settings = json_decode( file_get_contents( $this->root . '/config/plugins/seo.json' ), true );
		self::assertSame( 'SEO name', $settings['site_name'] );
		self::assertSame( 'Home override', $settings['routes']['/']['title'] );
		self::assertStringNotContainsString( 'plugin:', file_get_contents( $this->root . '/config/settings_data.json' ) );
		$response = $this->api( '/api/editor/preview/seo', 'POST', [ 'collection' => 'docs', 'slug' => 'intro', 'frontmatter' => [ 'title' => 'Introduction', 'seo' => [ 'description' => 'A custom description' ] ], 'body' => '**Read** this.' ] );
		$data = json_decode( $response->getContent(), true );
		self::assertSame( 'Introduction · SEO name', $data['title'] );
		self::assertSame( 'A custom description', $data['description'] );
		self::assertStringContainsString( '<strong>Read</strong>', $data['html'] );
	}
	public function test_content_save_keeps_seo_with_markdown_and_build_api_excludes_drafts(): void {
		$response = $this->api( '/api/content/posts/hello-world', 'PUT', [ 'frontmatter' => [ 'title' => 'Saved', 'seo' => [ 'title' => 'Saved SEO' ] ], 'body' => 'My body' ] );
		self::assertSame( 200, $response->getStatusCode() );
		self::assertStringContainsString( 'Saved SEO', file_get_contents( $this->root . '/content/posts/hello-world.md' ) );
		file_put_contents( $this->root . '/content/posts/draft.md', "---\ntitle: Draft\ndraft: true\n---\nPrivate" );
		self::assertSame( 200, $this->api( '/api/build', 'POST' )->getStatusCode() );
		self::assertFileDoesNotExist( $this->root . '/dist/posts/draft/index.html' );
		self::assertStringNotContainsString( 'data-pillar-section-id', file_get_contents( $this->root . '/dist/index.html' ) );
	}
	public function test_plugin_theme_addon_and_liqx_global_work(): void {
		$pillar = $this->pillar();
		self::assertNotNull( $pillar->site->layers()->resolve( 'sections/breadcrumbs.liqx' ) );
		$template = \Phpmystic\Liqx\Template::parse( '{seo_breadcrumbs(page, route)}', $pillar->environment );
		$html = $template->render( [ 'route' => '/about/', 'page' => $pillar->content->page( $pillar->content->find( 'pages', 'about' ) ) ] );
		self::assertStringContainsString( 'aria-label="Breadcrumb"', $html );
		self::assertStringContainsString( 'aria-current="page"', $html );
	}
	public function test_a_missing_base_url_does_not_emit_relative_canonicals_or_sitemap(): void {
		$config = json_decode( file_get_contents( $this->root . '/site.json' ), true );
		$config['base_url'] = '';
		file_put_contents( $this->root . '/site.json', json_encode( $config ) );
		$this->build();
		self::assertFileDoesNotExist( $this->root . '/dist/sitemap.xml' );
		self::assertStringNotContainsString( 'rel="canonical"', file_get_contents( $this->root . '/dist/index.html' ) );
	}
	public function test_invalid_plugin_settings_fail_visibly(): void {
		$this->settings( [] );
		file_put_contents( $this->root . '/config/plugins/seo.json', '{broken' );
		$this->expectException( PillarException::class );
		$this->pillar();
	}
	public function test_plain_home_description_is_used_in_both_preview_and_build(): void {
		$preview = $this->api( '/api/editor/preview/seo', 'POST', [ 'kind' => 'home', 'settings' => [ 'home_description' => 'Helpful guides for everyday projects.' ] ] );
		self::assertSame( 'Helpful guides for everyday projects.', json_decode( $preview->getContent(), true )['description'] );
		$this->settings( [ 'home_description' => 'Helpful guides for everyday projects.' ] );
		$this->build();
		self::assertStringContainsString( 'name="description" content="Helpful guides for everyday projects."', file_get_contents( $this->root . '/dist/index.html' ) );
	}

	public function test_authors_can_upload_choose_and_build_a_sharing_image(): void {
		$image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
		$response = $this->api( '/api/media', 'POST', [ 'name' => 'My picture.png', 'data' => $image ] );
		self::assertSame( 201, $response->getStatusCode() );
		$url = json_decode( $response->getContent(), true )['url'];
		self::assertFileExists( $this->root . $url );
		self::assertStringContainsString( $url, str_replace( '\\/', '/', $this->api( '/api/media' )->getContent() ) );
		$this->post( [ 'og_image' => $url ] );
		$this->build();
		$html = file_get_contents( $this->root . '/dist/posts/hello-world/index.html' );
		self::assertMatchesRegularExpression( '#property="og:image" content="https://example.test/assets/uploads/my-picture-[a-f0-9]+\.[a-f0-9]+\.png"#', $html );
	}

	public function test_a_sharing_image_carries_its_media_library_alt_text(): void {
		$image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
		$url   = json_decode( $this->api( '/api/media', 'POST', [ 'name' => 'Card.png', 'data' => $image ] )->getContent(), true )['url'];
		$this->post( [ 'og_image' => $url ] );

		self::assertStringNotContainsString( 'og:image:alt', $this->renderPost() );

		self::assertSame( 200, $this->api( '/api/media/alt', 'PUT', [ 'url' => $url, 'alt' => 'A card "for" sharing' ] )->getStatusCode() );

		$html = $this->renderPost();
		self::assertStringContainsString( '<meta property="og:image:alt" content="A card &quot;for&quot; sharing">', $html );
		self::assertStringContainsString( '<meta name="twitter:image:alt" content="A card &quot;for&quot; sharing">', $html );
	}

	public function test_an_upload_must_be_an_image_even_with_an_image_filename(): void {
		$response = $this->api( '/api/media', 'POST', [ 'name' => 'photo.png', 'data' => base64_encode( '<?php echo 123;' ) ] );
		self::assertSame( 422, $response->getStatusCode() );
		self::assertDirectoryDoesNotExist( $this->root . '/assets/uploads' );
	}

	public function test_saving_sections_preserves_pagination_and_other_template_metadata(): void {
		file_put_contents( $this->root . '/templates/blog.json', json_encode( [ 'paginate' => [ 'collection' => 'posts', 'per_page' => 1 ], 'custom' => 'keep me', 'sections' => [] ] ) );
		$response = $this->api( '/api/templates/blog', 'PUT', [ 'sections' => [] ] );
		self::assertSame( 200, $response->getStatusCode() );
		$template = json_decode( file_get_contents( $this->root . '/templates/blog.json' ), true );
		self::assertSame( 1, $template['paginate']['per_page'] );
		self::assertSame( 'keep me', $template['custom'] );
	}

	public function test_media_delete_removes_owned_images_and_their_built_copies(): void {
		$image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
		$response = $this->api( '/api/media', 'POST', [ 'name' => 'Remove me.png', 'data' => $image ] );
		$media = json_decode( $response->getContent(), true );
		self::assertSame( 1, $media['width'] );
		self::assertFalse( $media['readonly'] );
		$this->build();
		$built = glob( $this->root . '/dist/assets/uploads/*.png' )[0];
		self::assertSame( 200, $this->api( '/api/media', 'DELETE', [ 'url' => $media['url'] ] )->getStatusCode() );
		self::assertFileDoesNotExist( $this->root . $media['url'] );
		$this->build();
		self::assertFileDoesNotExist( $built );
	}

	public function test_media_delete_rejects_traversal_and_non_image_files(): void {
		foreach ( [ '/assets/../site.json', '/assets/base.css', '/content/pages/about.md' ] as $url ) {
			self::assertSame( 422, $this->api( '/api/media', 'DELETE', [ 'url' => $url ] )->getStatusCode() );
		}
		self::assertFileExists( $this->root . '/assets/base.css' );
	}

	public function test_media_image_filter_uses_the_built_asset_path(): void {
		$pillar = $this->pillar();
		$pillar->filters->setAssetHashes( [ 'photo.jpg' => 'photo.1234.jpg' ] );
		$filter = $pillar->environment->filter( 'image_url' );
		self::assertSame( '/assets/photo.1234.jpg', $filter( '/assets/photo.jpg' ) );
	}

	public function test_new_entry_creation_never_overwrites_an_existing_markdown_file(): void {
		$body = [ 'slug' => 'new-guide', 'frontmatter' => [ 'title' => 'New guide', 'draft' => true ], 'body' => '' ];
		self::assertSame( 201, $this->api( '/api/content/posts', 'POST', $body )->getStatusCode() );
		$before = file_get_contents( $this->root . '/content/posts/new-guide.md' );
		$body['frontmatter']['title'] = 'Overwrite';
		self::assertSame( 422, $this->api( '/api/content/posts', 'POST', $body )->getStatusCode() );
		self::assertSame( $before, file_get_contents( $this->root . '/content/posts/new-guide.md' ) );
		$body['slug'] = '../escape';
		self::assertSame( 422, $this->api( '/api/content/posts', 'POST', $body )->getStatusCode() );
	}

}
