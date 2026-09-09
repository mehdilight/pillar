<?php
declare( strict_types=1 );

namespace Pillar\Render;

use Phpmystic\Liqx\Environment;
use Phpmystic\Liqx\Template;
use Pillar\Render\Drops\SectionDrop;
use Pillar\Schema\SchemaParser;
use Pillar\Schema\SettingsCaster;
use Pillar\Template\SectionInstance;

/**
 * One section, rendered.
 *
 * The wrapping element is emitted by Liqx itself: `Template::render()` takes a
 * wrapper, so the tag, its id and the editor's `data-pillar-section-id` are
 * applied here rather than hand-written into every theme. A theme author
 * cannot forget them, and cannot get them wrong.
 */
final class SectionRenderer {

	public function __construct(
		private readonly Environment $environment,
		private readonly LayeredFileSystem $sections,
		private readonly SchemaParser $schemas,
		private readonly SettingsCaster $caster,
		private readonly RenderErrors $errors,
		/** Adds the editor's selection attributes. Off for a production build. */
		private readonly bool $editorAttributes = false,
	) {}

	/**
	 * @param array<string, mixed> $scope the page scope this section renders inside
	 */
	public function render( SectionInstance $section, array $scope, string $route = '' ): string {
		try {
			$template = Template::parse(
				$this->sections->load( $section->type ),
				$this->environment,
				'sections/' . $section->type
			);

			// Cast through the section's own `<schema>`: JSON round-trips a
			// range into a string, and a theme writing
			// `{section.settings.padding + 8}` should not have to care. A
			// setting the stored JSON never had falls back to its default, so
			// adding one does not mean touching every page already using it.
			$schema   = $this->schemas->forSection( $section->type );
			$settings = $this->caster->cast( $schema, $section->settings );
			$blocks   = $this->castBlocks( $schema, $section->blocks );

			$data = $scope + [
				'section' => new SectionDrop( $section->id, $section->type, $settings, $blocks ),
			];

			$html = $template->render( $data, false, $this->wrapper( $section ) );

			return '' === $section->customCss ? $html : $this->withCustomCss( $section, $html );
		} catch ( \Throwable $error ) {
			// The merchant's other sections still have to ship.
			$this->errors->add( $route, $section->id, $section->type, $error );

			return '';
		}
	}

	/**
	 * @param list<array<string, mixed>> $blocks
	 *
	 * @return list<array<string, mixed>>
	 */
	private function castBlocks( ?\Pillar\Schema\SectionSchema $schema, array $blocks ): array {
		if ( null === $schema ) {
			return $blocks;
		}

		$byType = [];

		foreach ( $schema->blocks as $block ) {
			$byType[ $block->type ] = $block;
		}

		foreach ( $blocks as $index => $block ) {
			$type = (string) ( $block['type'] ?? '' );
			// A block type from `blocks/<type>.liqx` rather than this section's
			// own schema still casts — the file is the other place a block may
			// declare its settings.
			$declared = $byType[ $type ] ?? $this->schemas->forBlock( $type );

			if ( null !== $declared ) {
				$blocks[ $index ]['settings'] = $this->caster->castBlock(
					$declared->settings,
					(array) ( $block['settings'] ?? [] )
				);
			}
		}

		return $blocks;
	}

	/**
	 * @return array{tag: string, attrs: array<string, mixed>}
	 */
	private function wrapper( SectionInstance $section ): array {
		$attrs = [
			'id'            => 'pillar-section-' . $section->id,
			'class'         => 'pillar-section pillar-section--' . $section->type,
			'data-section-type' => $section->type,
		];

		if ( $this->editorAttributes ) {
			// What the dashboard's canvas clicks on. Only in the preview: a
			// built page carries no editor scaffolding.
			$attrs['data-pillar-section-id'] = $section->id;
		}

		return [ 'tag' => 'section', 'attrs' => $attrs ];
	}

	/**
	 * Per-section CSS from the editor, scoped by replacing `&` with the
	 * section's own id — the convention the settings panel documents.
	 */
	private function withCustomCss( SectionInstance $section, string $html ): string {
		$selector = '#shopify-section-' . $section->id;
		$css      = str_replace( '&', $selector, $section->customCss );

		return '<style>' . $css . '</style>' . $html;
	}
}
