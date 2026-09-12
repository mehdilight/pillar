<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Dev;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\Content\ContentStore;
use Phpmystic\Pillar\Content\ContentType;
use Phpmystic\Pillar\Content\FrontmatterWriter;
use Phpmystic\Pillar\Content\MarkdownFile;
use Phpmystic\Pillar\Content\MenuStore;
use Phpmystic\Pillar\Git\LocalGit;
use Phpmystic\Pillar\Pillar;
use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Schema\ContentSchema;
use Phpmystic\Pillar\Schema\SchemaException;
use Phpmystic\Pillar\Schema\SectionSchema;
use Phpmystic\Pillar\Schema\Rules;
use Phpmystic\Pillar\Schema\Setting;
use Phpmystic\Pillar\Site\PathPolicy;
use Phpmystic\Pillar\Template\PageTemplate;
use Phpmystic\Pillar\Template\SectionInstance;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The JSON API the dashboard drives, over the working tree.
 *
 * The contract is the editor's own `api/client.ts` — written first, so this is
 * a passthrough rather than a translation layer. Every route reads or writes a
 * file: there is no database, and "saving" is `file_put_contents`.
 */
final class Api {

	public function __construct(
		private readonly string $root,
		private readonly LocalGit $git,
	) {}

	public function handle( Request $request, string $path ): Response {
		$segments = array_values( array_filter( explode( '/', trim( $path, '/' ) ) ) );
		$method   = $request->getMethod();

		try {
			return match ( true ) {
				[ 'health' ] === $segments => $this->json( [ 'ok' => true, 'site' => $this->pillar()->site->name ] ),

				[ 'templates' ] === $segments => $this->json( $this->templates() ),
				'templates' === ( $segments[0] ?? '' ) && isset( $segments[1] ) && 'GET' === $method
					=> $this->json( $this->template( $this->safeName( $segments[1] ) ) ),
				'templates' === ( $segments[0] ?? '' ) && isset( $segments[1] ) && 'PUT' === $method
					=> $this->saveTemplate( $this->safeName( $segments[1] ), $this->body( $request ) ),

				[ 'layout' ] === $segments && 'PUT' === $method => $this->saveTemplate( 'layout', $this->body( $request ) ),

				'editor' === ( $segments[0] ?? '' ) && 'preview' === ( $segments[1] ?? '' ) && 3 === count( $segments ) && 'POST' === $method
					=> $this->json( $this->pillar()->editor->resolvePreview( $segments[2], $this->body( $request ) ) ),
				[ 'editor', 'panels' ] === $segments => $this->json( (object) $this->pillar()->editor->contentPanels() ),
				[ 'editor', 'plugins' ] === $segments => $this->json( $this->editorPlugins() ),

				[ 'settings', 'schema' ] === $segments => $this->json( $this->settingsSchema() ),
				[ 'settings' ] === $segments && 'GET' === $method => $this->json( $this->settings() ),
				[ 'settings' ] === $segments && 'PUT' === $method => $this->saveSettings( $this->body( $request ) ),

				[ 'menus' ] === $segments && 'GET' === $method => $this->json( MenuStore::load( $this->pillar()->site ) ),
				[ 'menus' ] === $segments && 'PUT' === $method => $this->saveMenus( $this->body( $request ) ),

				[ 'content-types' ] === $segments && 'GET' === $method => $this->json( $this->collections() ),
				[ 'content-types' ] === $segments && 'POST' === $method
					=> $this->createCollection( $this->body( $request ) ),
				'content-types' === ( $segments[0] ?? '' ) && 2 === count( $segments ) && 'PUT' === $method
					=> $this->updateCollection( $segments[1], $this->body( $request ) ),
				[ 'content-types', 'presets' ] === $segments => $this->json( $this->presets() ),

				[ 'content' ] === $segments => $this->json( $this->collections() ),
				'content' === ( $segments[0] ?? '' ) && 2 === count( $segments ) && 'POST' === $method
					=> $this->saveItem( $segments[1], (string) ( $this->body( $request )['slug'] ?? '' ), $this->body( $request ), true ),
				'content' === ( $segments[0] ?? '' ) && 2 === count( $segments ) && 'GET' === $method
					=> $this->json( $this->items( $segments[1] ) ),
				'content' === ( $segments[0] ?? '' ) && 3 === count( $segments ) && 'PUT' === $method
					=> $this->saveItem( $segments[1], $segments[2], $this->body( $request ) ),
				'content' === ( $segments[0] ?? '' ) && 3 === count( $segments ) && 'DELETE' === $method
					=> $this->deleteItem( $segments[1], $segments[2] ),

				[ 'media' ] === $segments && 'GET' === $method => $this->json( ( new Media( $this->pillar()->site ) )->all() ),
				[ 'media' ] === $segments && 'DELETE' === $method => $this->deleteMedia( $this->body( $request ) ),
				[ 'media' ] === $segments && 'POST' === $method => $this->json( ( new Media( $this->pillar()->site ) )->upload( $this->body( $request ) ), 201 ),
				[ 'media', 'alt' ] === $segments && 'PUT' === $method => $this->json(
					( new Media( $this->pillar()->site ) )->setAlt( (string) ( $this->body( $request )['url'] ?? '' ), (string) ( $this->body( $request )['alt'] ?? '' ) )
				),

				[ 'status' ] === $segments => $this->json( $this->status() ),
				[ 'history' ] === $segments => $this->json( $this->git->history() ),
				[ 'publish' ] === $segments && 'POST' === $method => $this->publish( $this->body( $request ) ),
				[ 'discard' ] === $segments && 'POST' === $method => $this->discard(),
				[ 'build' ] === $segments && 'POST' === $method => $this->json( $this->build() ),
				[ 'markdown' ] === $segments && 'POST' === $method
					=> $this->json( [ 'html' => $this->markdown( (string) ( $this->body( $request )['body'] ?? '' ) ) ] ),

				default => $this->json( [ 'error' => 'No such endpoint.' ], 404 ),
			};
		} catch ( PillarException $error ) {
			return $this->json( [ 'error' => $error->getMessage() ], 422 );
		} catch ( \Throwable $error ) {
			return $this->json( [ 'error' => $error->getMessage(), 'type' => $error::class ], 500 );
		}
	}

	/* ── Templates ───────────────────────────────────────────────────── */

	/** @return list<array{name: string, label: string, route: string, group: string}> */
	private function templates(): array {
		$pillar   = $this->pillar();
		$content  = $pillar->content->collectionNames();
		$out      = [];

		foreach ( array_keys( $pillar->site->layers()->listing( 'templates', 'json' ) ) as $key ) {
			$name = (string) $key;

			if ( 'layout' === $name ) {
				continue;
			}

			$isContent = in_array( $name . 's', $content, true ) || 'page' === $name;

			$out[] = [
				'name'  => $name,
				'label' => ucfirst( str_replace( [ '-', '_' ], ' ', 'index' === $name ? 'Home page' : $name ) ),
				'route' => $this->routeFor( $name, $isContent, $pillar->content ),
				'group' => $isContent ? 'Content' : 'Pages',
			];
		}

		return $out;
	}

	private function routeFor( string $name, bool $isContent, ContentStore $content ): string {
		if ( $isContent ) {
			// A content template has no page of its own: previewing it means
			// previewing a real item, so the first one stands in.
			$collection = 'page' === $name ? 'pages' : $name . 's';
			$first      = ( $content->files()[ $collection ] ?? [] )[0] ?? null;

			return $first instanceof MarkdownFile ? $first->url() : '/';
		}

		return match ( $name ) {
			'index' => '/',
			'404'   => '/404.html',
			default => '/' . $name . '/',
		};
	}

	/** @return array<string, mixed> */
	private function template( string $name ): array {
		$pillar = $this->pillar();
		$errors = [];
		$schemas = $pillar->schemas->allSections( $errors );

		$files = $pillar->schemas->allBlocks( $errors );

		// `@theme` in an `accepts` list means every public block file — one
		// whose type does not start with `_` — expanded here, once, so the
		// dashboard only ever sees type names.
		$public = array_values( array_filter( array_map( 'strval', array_keys( $files ) ), static fn ( string $type ): bool => ! str_starts_with( $type, '_' ) ) );
		$expand = static fn ( array $accepts ): array => array_values( array_unique( array_merge(
			...array_map( static fn ( string $type ): array => '@theme' === $type ? $public : [ $type ], $accepts )
		) ) );

		$available = [];

		foreach ( $schemas as $type => $schema ) {
			$available[] = [ 'accepts' => $expand( $schema->accepts ) ] + $schema->toArray();
		}

		$blocks = [];

		foreach ( $files as $type => $schema ) {
			$blocks[] = [ 'accepts' => $expand( $schema->accepts ) ] + $schema->toArray();
		}

		return [
			'name'              => $name,
			'sections'          => $this->sectionsOf( $name, $schemas, $expand ),
			'layout'            => $this->sectionsOf( 'layout', $schemas, $expand, isLayout: true ),
			'availableSections' => $available,
			'availableBlocks'   => $blocks,
			'allTemplates'      => $this->templates(),
			// A section whose schema is broken is reported, not hidden: the
			// dashboard shows it rather than silently offering fewer sections.
			'schemaErrors'      => $errors,
		];
	}

	/**
	 * @param array<string, SectionSchema>          $schemas
	 * @param callable(list<string>): list<string>  $expand  resolves `@theme` in an accepts list
	 *
	 * @return list<array<string, mixed>>
	 */
	private function sectionsOf( string $name, array $schemas, callable $expand, bool $isLayout = false ): array {
		$path = $this->pillar()->site->layers()->resolve( 'templates/' . $name . '.json' );

		if ( null === $path ) {
			return [];
		}

		$out = [];

		foreach ( PageTemplate::fromFile( $path, $name )->sections as $index => $section ) {
			$schema = $schemas[ $section->type ] ?? null;

			$out[] = [
				'section_id'   => $section->id,
				'section_type' => $section->type,
				'settings'     => (object) $section->settings,
				'blocks'       => $section->blocks,
				'order'        => $index,
				'enabled'      => $section->enabled,
				'is_layout'    => $isLayout || $section->isLayout,
				'custom_css'   => $section->customCss,
				'schema'       => null === $schema ? null : [
					'name'       => $schema->name,
					'settings'   => array_map( static fn ( Setting $s ): array => $s->toArray(), $schema->settings ),
					'blocks'     => array_map( static fn ( $b ): array => $b->toArray(), $schema->blocks ),
					'max_blocks' => $schema->maxBlocks,
					'accepts'    => $expand( $schema->accepts ),
				],
			];
		}

		return $out;
	}

	/** @param array<string, mixed> $body */
	private function saveTemplate( string $name, array $body ): Response {
		$sections = [];
		$order    = [];

		foreach ( (array) ( $body['sections'] ?? [] ) as $index => $raw ) {
			if ( ! is_array( $raw ) ) {
				continue;
			}

			$id = (string) ( $raw['section_id'] ?? '' );

			if ( '' === $id ) {
				continue;
			}

			$entry = [
				'section_type' => (string) ( $raw['section_type'] ?? '' ),
				'settings'     => (object) ( (array) ( $raw['settings'] ?? [] ) ),
				'order'        => (int) ( $raw['order'] ?? $index ),
				'enabled'      => (bool) ( $raw['enabled'] ?? true ),
			];

			if ( [] !== (array) ( $raw['blocks'] ?? [] ) ) {
				$entry['blocks'] = $raw['blocks'];
			}

			if ( '' !== (string) ( $raw['custom_css'] ?? '' ) ) {
				$entry['custom_css'] = (string) $raw['custom_css'];
			}

			if ( true === ( $raw['is_layout'] ?? false ) ) {
				$entry['is_layout'] = true;
			}

			$sections[ $id ] = $entry;
			$order[]         = $id;
		}

		$path = $this->pillar()->site->layers()->resolve( 'templates/' . $name . '.json' );
		$existing = null === $path ? [] : json_decode( (string) file_get_contents( $path ), true );
		$this->write(
			'templates/' . $name . '.json',
			(string) json_encode( array_replace( (array) $existing, [ 'sections' => (object) $sections, 'order' => $order ] ), self::JSON )
		);

		return $this->json( [ 'ok' => true ] );
	}

	/* ── Settings ────────────────────────────────────────────────────── */

	/** @return list<array<string, mixed>> */
	private function settingsSchema(): array {
		$path = $this->pillar()->site->layers()->resolve( 'config/settings_schema.json' );

		$raw = null === $path ? [] : json_decode( (string) file_get_contents( $path ), true );

		if ( ! is_array( $raw ) ) {
			throw new SchemaException( 'config/settings_schema.json is not valid JSON.' );
		}

		$panels = [];

		foreach ( $raw as $panel ) {
			if ( ! is_array( $panel ) ) {
				continue;
			}

			$settings = [];

			foreach ( (array) ( $panel['settings'] ?? [] ) as $setting ) {
				if ( is_array( $setting ) ) {
					$settings[] = Setting::fromArray( $setting )->toArray();
				}
			}

			$panels[] = [ 'name' => (string) ( $panel['name'] ?? 'Settings' ), 'settings' => $settings ];
		}

		return array_merge( $panels, $this->pillar()->editor->schema() );
	}

	/** @return array<string, mixed> */
	private function settings(): array {
		$path = $this->pillar()->site->layers()->resolve( 'config/settings_data.json' );
		$raw  = null === $path ? [] : json_decode( (string) file_get_contents( $path ), true );

		return ( is_array( $raw ) ? $raw : [] ) + $this->pillar()->editor->values();
	}

	/** @param array<string, mixed> $body */
	private function saveSettings( array $body ): Response {
		$settings = (array) ( $body['settings'] ?? $body );

		foreach ( $this->pillar()->editor->extract( $settings ) as $path => $values ) {
			$this->write( $path, (string) json_encode( (object) $values, self::JSON ) );
		}

		$this->write( 'config/settings_data.json', (string) json_encode( (object) $settings, self::JSON ) );

		return $this->json( [ 'ok' => true ] );
	}

	/** @param array<string, mixed> $body */
	private function saveMenus( array $body ): Response {
		$menus = MenuStore::normalise( (array) ( $body['menus'] ?? $body ) );
		$this->write( 'data/menus.json', (string) json_encode( (object) $menus, self::JSON ) );

		return $this->json( [ 'ok' => true ] );
	}

	/* ── Content ─────────────────────────────────────────────────────── */

	/** @return list<array<string, mixed>> */
	private function collections(): array {
		$pillar = $this->pillar( drafts: true );
		$types  = ( new ContentType( $pillar->site ) )->all( $pillar->content );
		$out    = [];

		foreach ( $types as $name => $type ) {
			$schema = $type['schema'];

			$out[] = [
				'name'     => $name,
				'label'    => $type['label'],
				'icon'     => $schema->icon ?? 'file-text',
				'count'    => $type['count'],
				'template' => ContentType::singular( $name ),
				// A collection with no `schemas/<name>.json` still lists and
				// still edits — it simply has no declared fields.
				'fields'   => null === $schema
					? []
					: array_map( static fn ( Setting $f ): array => $f->toArray(), $schema->fields ),
			];
		}

		return $out;
	}

	/** The field presets the dashboard offers when creating a type. */
	private function presets(): array {
		$out = [];

		foreach ( ContentType::PRESETS as $key => $field ) {
			$out[] = [ 'key' => $key, 'default' => in_array( $key, ContentType::DEFAULT_FIELDS, true ) ] + $field;
		}

		return $out;
	}

	/** @param array<string, mixed> $body */
	private function createCollection( array $body ): Response {
		$fields = $this->fieldsFrom( $body );

		$result = ( new ContentType( $this->pillar()->site ) )->create(
			(string) ( $body['name'] ?? '' ),
			(string) ( $body['label'] ?? '' ),
			$fields,
			(bool) ( $body['template'] ?? true ),
			isset( $body['icon'] ) ? (string) $body['icon'] : null
		);

		return $this->json( $result, 201 );
	}

	/** @param array<string, mixed> $body */
	private function updateCollection( string $name, array $body ): Response {
		$written = ( new ContentType( $this->pillar()->site ) )->update(
			$name,
			(string) ( $body['label'] ?? ucfirst( $name ) ),
			$this->fieldsFrom( $body ) ?? [],
			isset( $body['icon'] ) ? (string) $body['icon'] : null
		);

		return $this->json( [ 'ok' => true, 'file' => $written ] );
	}

	/**
	 * Fields as given, or resolved from preset keys.
	 *
	 * The dashboard sends `["title","date"]`; a script may send whole field
	 * definitions. Both mean the same thing here.
	 *
	 * @param array<string, mixed> $body
	 *
	 * @return list<array<string, mixed>>|null
	 */
	private function fieldsFrom( array $body ): ?array {
		if ( ! isset( $body['fields'] ) || ! is_array( $body['fields'] ) ) {
			return null;
		}

		$fields = [];

		foreach ( $body['fields'] as $field ) {
			if ( is_string( $field ) ) {
				if ( ! isset( ContentType::PRESETS[ $field ] ) ) {
					throw new PillarException( sprintf( 'No such field preset: "%s".', $field ) );
				}

				$fields[] = ContentType::PRESETS[ $field ];

				continue;
			}

			if ( is_array( $field ) ) {
				$fields[] = $field;
			}
		}

		return $fields;
	}

	/** @return list<array<string, mixed>> */
	private function items( string $collection ): array {
		$out = [];

		foreach ( $this->pillar( drafts: true )->content->files()[ $collection ] ?? [] as $file ) {
			$out[] = [
				'collection'  => $file->collection,
				'slug'        => $file->slug,
				'title'       => $file->title(),
				'frontmatter' => (object) $file->frontmatter,
				'body'        => $file->body,
				'updated_at'  => date( DATE_ATOM, (int) filemtime( $file->path ) ),
			];
		}

		return $out;
	}

	/** @param array<string, mixed> $body */
	private function saveItem( string $collection, string $slug, array $body, bool $createOnly = false ): Response {
		$frontmatter = (array) ( $body['frontmatter'] ?? [] );
		$content     = (string) ( $body['body'] ?? '' );

		$relative = 'content/' . $this->safe( $collection ) . '/' . $this->safe( $slug ) . '.md';
		$existing = $this->root . '/' . PathPolicy::normalise( $relative );

		$this->checkRules( $collection, $frontmatter );

		// Written back as a normal markdown file a developer can edit by hand —
		// and without restyling it: frontmatter lines whose values did not
		// change are kept exactly as they were written. See FrontmatterWriter.
		$file = FrontmatterWriter::write(
			! $createOnly && is_file( $existing ) ? (string) file_get_contents( $existing ) : '',
			$frontmatter,
			$content
		);
		if ( $createOnly ) {
			if ( '' === trim( (string) ( $frontmatter['title'] ?? '' ) ) ) { throw new PillarException( 'Give this entry a title.' ); }
			$path = $this->root . '/' . PathPolicy::normalise( $relative );
			@mkdir( dirname( $path ), 0777, true );
			// Exclusive creation prevents a new-entry dialog from overwriting an existing file.
			$handle = @fopen( $path, 'x' );
			if ( false === $handle ) { throw new PillarException( is_file( $path ) ? 'An entry with this URL name already exists. Choose another.' : 'Could not create the entry. Check folder permissions.' ); }
			$written = fwrite( $handle, $file );
			fclose( $handle );
			if ( $written !== strlen( $file ) ) { unlink( $path ); throw new PillarException( 'Could not save the new entry.' ); }
		} else {
			$this->write( $relative, $file );
		}
		return $this->json( [ 'ok' => true ], $createOnly ? 201 : 200 );
	}

	/**
	 * A published entry must satisfy its fields' rules — required, limits,
	 * email addresses. A draft may be saved half-written; the rules apply when
	 * it is published. The form checks the same first (lib/fieldRules.ts);
	 * this is what a script or a stale tab cannot get past.
	 *
	 * @param array<mixed, mixed> $frontmatter
	 */
	private function checkRules( string $collection, array $frontmatter ): void {
		if ( filter_var( $frontmatter['draft'] ?? false, FILTER_VALIDATE_BOOL ) ) {
			return;
		}

		$schema = ContentSchema::all( $this->pillar()->site->layers() )[ $collection ] ?? null;
		$broken = null === $schema ? [] : Rules::violations( $schema->fields, $frontmatter );

		if ( [] !== $broken ) {
			throw new PillarException( 'Not published: ' . implode( ' ', array_column( $broken, 'message' ) ) );
		}
	}

	private function deleteItem( string $collection, string $slug ): Response {
		$path = $this->root . '/content/' . $this->safe( $collection ) . '/' . $this->safe( $slug ) . '.md';

		if ( is_file( $path ) ) {
			unlink( $path );
		}

		return $this->json( [ 'ok' => true ] );
	}

	/**
	 * The dashboard bundles the dashboard should load: one per enabled plugin
	 * that ships one. A disabled plugin is not in the list, so its panels do
	 * not exist — there is no flag to check anywhere in the frontend.
	 *
	 * Versioned by content hash, so a rebuilt bundle is never served stale.
	 *
	 * A plugin that declares a bundle it has not built is listed with no script,
	 * so the dashboard can say so rather than its panels silently not being
	 * there.
	 *
	 * @return list<array{slug: string, script: string|null, style: string|null}>
	 */
	private function editorPlugins(): array {
		$out = [];

		foreach ( $this->pillar()->plugins as $plugin ) {
			if ( null === $plugin->manifest->editor ) {
				continue;
			}

			$script = $plugin->manifest->editorScript();

			if ( null === $script ) {
				$out[] = [ 'slug' => $plugin->manifest->slug, 'script' => null, 'style' => null ];

				continue;
			}

			$slug  = $plugin->manifest->slug;
			$style = substr( $script, 0, -3 ) . '.css';
			$base  = '/_pillar/plugins/' . rawurlencode( $slug ) . '/';

			$out[] = [
				'slug'   => $slug,
				'script' => $base . basename( $script ) . '?v=' . substr( (string) md5_file( $script ), 0, 10 ),
				'style'  => is_file( $style ) ? $base . basename( $style ) . '?v=' . substr( (string) md5_file( $style ), 0, 10 ) : null,
			];
		}

		return $out;
	}

	/** @param array<string, mixed> $body */
	private function deleteMedia( array $body ): Response {
		( new Media( $this->pillar()->site ) )->delete( (string) ( $body['url'] ?? '' ) );
		return $this->json( [ 'ok' => true ] );
	}

	/* ── Git ─────────────────────────────────────────────────────────── */

	/** @return array<string, mixed> */
	private function status(): array {
		if ( ! $this->git->isRepository() ) {
			// Not a repository is a normal state for a new site, not an error:
			// the dashboard simply has nothing to publish.
			return [ 'count' => 0, 'files' => [], 'has_remote' => false, 'branch' => 'no repository' ];
		}

		$files = $this->git->changedFiles();

		return [
			'count'      => count( $files ),
			'files'      => $files,
			'has_remote' => $this->git->hasRemote(),
			'branch'     => $this->git->branch(),
		];
	}

	/** @param array<string, mixed> $body */
	private function publish( array $body ): Response {
		if ( ! $this->git->isRepository() ) {
			return $this->json( [ 'error' => 'This site is not a git repository, so there is nothing to publish to.' ], 422 );
		}

		// Pushed unless the author asked for a local commit only — to review
		// it first, or because there is no connection.
		$result = $this->git->commit(
			(string) ( $body['message'] ?? 'Update site content' ),
			push: filter_var( $body['push'] ?? true, FILTER_VALIDATE_BOOL )
		);

		return $this->json( [ 'message' => $result['message'] ], $result['ok'] ? 200 : 422 );
	}

	private function discard(): Response {
		if ( ! $this->git->isRepository() ) {
			return $this->json( [ 'error' => 'This site is not a git repository, so there is nothing to discard to.' ], 422 );
		}

		$this->git->discard();

		return $this->json( [ 'ok' => true ] );
	}

	/**
	 * Markdown, rendered for the editor's preview.
	 *
	 * Through the site's own converter rather than a copy in the browser: the
	 * point of a preview is that it matches what the build will write, and two
	 * markdown implementations do not agree about enough to promise that.
	 */
	private function markdown( string $body ): string {
		return \Phpmystic\Pillar\Content\Markdown::converter()
			->convert( $body )
			->getContent();
	}

	/** @return array<string, mixed> */
	private function build(): array {
		$pillar = Pillar::forSite( $this->root );
		$result = ( new Builder( $pillar ) )->build();

		return [
			'pages'  => $result['written'] + $result['skipped'],
			'ms'     => $result['ms'],
			'errors' => array_map(
				static fn ( array $failure ): array => [
					'route'   => $failure['route'],
					'section' => $failure['section'],
					'message' => $failure['error']->getMessage(),
				],
				$pillar->errors->all()
			),
		];
	}

	/* ── Plumbing ────────────────────────────────────────────────────── */

	private const JSON = JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

	/**
	 * A fresh Pillar per request.
	 *
	 * The dashboard's whole model is that files on disk are the truth, and it
	 * changes them between requests — a cached site would answer with what was
	 * true when the server booted.
	 */
	private function pillar( bool $drafts = true ): Pillar {
		return Pillar::forSite( $this->root, editor: true, drafts: $drafts, compile: false );
	}

	/** @return array<string, mixed> */
	private function body( Request $request ): array {
		$decoded = json_decode( (string) $request->getContent(), true );

		return is_array( $decoded ) ? $decoded : [];
	}

	private function write( string $relative, string $contents ): void {
		$path = $this->root . '/' . PathPolicy::normalise( $relative );

		@mkdir( dirname( $path ), 0777, true );

		if ( false === file_put_contents( $path, $contents ) ) {
			throw new PillarException( sprintf( 'Could not write %s', $relative ) );
		}
	}

	/**
	 * A name that may become a file name.
	 *
	 * Checked here rather than relying on `PathPolicy` alone: the policy
	 * refuses a path that escapes the site, but `templates/` + `..` + `.json`
	 * is `templates/...json` — inside the site, allowed by the policy, and
	 * still nonsense. A name has to be a name.
	 *
	 * Dots are allowed between segments so a specialised template
	 * (`product.landing`) still works; a bare `..` is not a name.
	 */
	private function safeName( string $name ): string {
		if ( ! preg_match( '/^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$/i', $name ) ) {
			throw new PillarException( sprintf( 'Not a usable name: "%s".', $name ) );
		}

		return $name;
	}

	private function safe( string $segment ): string {
		return $this->safeName( $segment );
	}

	private function json( mixed $data, int $status = 200 ): JsonResponse {
		return new JsonResponse( $data, $status, [], false );
	}
}
