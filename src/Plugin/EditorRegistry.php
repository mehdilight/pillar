<?php
declare( strict_types=1 );

namespace Pillar\Plugin;

use Pillar\PillarException;
use Pillar\Schema\Setting;

/**
 * What plugins add to the dashboard: settings panels, content-editor panels,
 * and preview resolvers.
 *
 * A plugin's settings panel appears beside the site's own under Site settings,
 * built from the same field vocabulary, so it needs no frontend code of its
 * own. Values are namespaced `plugin:<slug>:<field>` on the wire and written to
 * `config/plugins/<slug>.json` — the site's settings file never sees them.
 */
final class EditorRegistry {

	/** @var array<string, array{context: PluginContext, name: string, fields: list<array<string, mixed>>, defaults: array<string, mixed>}> */
	private array $panels = [];

	/** @var array<string, array<string, mixed>> */
	private array $contentPanels = [];

	/** @var array<string, callable(array<string, mixed>): array<string, mixed>> */
	private array $previews = [];

	/** @param callable(array<string, mixed>): array<string, mixed> $resolver */
	public function preview( string $slug, callable $resolver ): void {
		$this->previews[ $slug ] = $resolver;
	}

	/**
	 * @param array<string, mixed> $input
	 *
	 * @return array<string, mixed>
	 */
	public function resolvePreview( string $slug, array $input ): array {
		if ( ! isset( $this->previews[ $slug ] ) ) {
			throw new PillarException( 'No editor preview for plugin: ' . $slug );
		}

		return ( $this->previews[ $slug ] )( $input );
	}

	/**
	 * A settings panel.
	 *
	 * Every field is parsed here, at registration, so a plugin declaring a
	 * field type the dashboard cannot render fails loudly on load rather than
	 * showing a control that writes a value nothing reads.
	 *
	 * @param list<array<string, mixed>> $fields
	 * @param array<string, mixed> $defaults
	 */
	public function settings( PluginContext $context, string $name, array $fields, array $defaults = [] ): void {
		foreach ( $fields as $field ) {
			Setting::fromArray( $field );
		}

		$this->panels[ $context->manifest->slug ] = compact( 'context', 'name', 'fields', 'defaults' );
	}

	/** @param array<string, mixed> $panel */
	public function contentPanel( string $slug, array $panel ): void {
		$this->contentPanels[ $slug ] = $panel;
	}

	/** @return array<string, array<string, mixed>> */
	public function contentPanels(): array {
		return $this->contentPanels;
	}

	/** The panels, in the shape the dashboard's settings schema uses. @return list<array<string, mixed>> */
	public function schema(): array {
		$out = [];

		foreach ( $this->panels as $slug => $panel ) {
			$fields = [];

			foreach ( $panel['fields'] as $field ) {
				$field['default'] ??= $panel['defaults'][ $field['id'] ] ?? null;
				$field['id']        = self::key( $slug, (string) $field['id'] );
				$fields[]           = $field;
			}

			$out[] = [ 'name' => $panel['name'], 'plugin' => $slug, 'settings' => $fields ];
		}

		return $out;
	}

	/** Current values, namespaced for the wire. @return array<string, mixed> */
	public function values(): array {
		$out = [];

		foreach ( $this->panels as $slug => $panel ) {
			$values = $panel['context']->settings() + $panel['defaults'];

			foreach ( self::valued( $panel['fields'] ) as $field ) {
				$out[ self::key( $slug, (string) $field['id'] ) ] = $values[ $field['id'] ] ?? $field['default'] ?? null;
			}
		}

		return $out;
	}

	/**
	 * Pull plugin values out of a settings save, into their own files.
	 *
	 * Keys a plugin keeps in its config but does not expose in the form are
	 * preserved — the form is a view onto the file, not its owner.
	 *
	 * @param array<string, mixed> $values the incoming save; plugin keys are removed from it
	 *
	 * @return array<string, array<string, mixed>> relative path => values to write
	 */
	public function extract( array &$values ): array {
		$files = [];

		foreach ( $this->panels as $slug => $panel ) {
			$settings = $panel['context']->settings();
			$changed  = false;

			foreach ( self::valued( $panel['fields'] ) as $field ) {
				$key = self::key( $slug, (string) $field['id'] );

				if ( array_key_exists( $key, $values ) ) {
					$settings[ $field['id'] ] = $values[ $key ];
					unset( $values[ $key ] );
					$changed = true;
				}
			}

			if ( $changed ) {
				$files[ 'config/plugins/' . $slug . '.json' ] = $settings;
			}
		}

		// A stale browser tab must not leak a disabled plugin's settings into
		// the site's own settings file.
		foreach ( array_keys( $values ) as $key ) {
			if ( str_starts_with( (string) $key, 'plugin:' ) ) {
				unset( $values[ $key ] );
			}
		}

		return $files;
	}

	/**
	 * The fields that hold a value — not headings or notes, which exist to
	 * organise a panel and would otherwise be written to the config as nulls.
	 *
	 * @param list<array<string, mixed>> $fields
	 *
	 * @return list<array<string, mixed>>
	 */
	private static function valued( array $fields ): array {
		return array_values( array_filter(
			$fields,
			static fn ( array $field ): bool => ! Setting::fromArray( $field )->type->isDecorative()
		) );
	}

	private static function key( string $slug, string $field ): string {
		return 'plugin:' . $slug . ':' . $field;
	}
}
