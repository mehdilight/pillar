<?php
declare( strict_types=1 );

namespace Pillar\Schema;

/**
 * The setting types a `<schema>` block may declare.
 *
 * GENERATED from schema/field-types.json by tools/generate-field-types.php.
 * Do not edit by hand — the editor's TypeScript union is generated from the
 * same file, and hand-editing one side is how the two drift.
 */
enum FieldType: string {

	case Text = 'text';
	case Textarea = 'textarea';
	case Richtext = 'richtext';
	case Markdown = 'markdown';
	case Html = 'html';
	case Code = 'code';
	case Url = 'url';
	case Number = 'number';
	case Range = 'range';
	case Checkbox = 'checkbox';
	case Select = 'select';
	case Radio = 'radio';
	case Color = 'color';
	case Image = 'image';
	case Video = 'video';
	case Date = 'date';
	case Tags = 'tags';
	case Menu = 'menu';
	case Page = 'page';
	case Collection = 'collection';
	case CollectionItem = 'collection_item';
	case Header = 'header';
	case Paragraph = 'paragraph';

	/** Types that carry no value — they exist to organise the sidebar. */
	public function isDecorative(): bool {
		return in_array( $this, [ self::Header, self::Paragraph ], true );
	}

	/** The value stored when nothing was ever chosen and the schema gave no default. */
	public function emptyValue(): mixed {
		return match ( $this ) {
			self::Text => '',
			self::Textarea => '',
			self::Richtext => '',
			self::Markdown => '',
			self::Html => '',
			self::Code => '',
			self::Url => '',
			self::Number => 0,
			self::Range => 0,
			self::Checkbox => false,
			self::Select => '',
			self::Radio => '',
			self::Color => '',
			self::Image => NULL,
			self::Video => NULL,
			self::Date => '',
			self::Tags => array (
),
			self::Menu => '',
			self::Page => '',
			self::Collection => '',
			self::CollectionItem => '',
			self::Header => NULL,
			self::Paragraph => NULL,
		};
	}
}
