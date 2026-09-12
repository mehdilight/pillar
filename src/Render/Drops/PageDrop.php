<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render\Drops;

use Phpmystic\Pillar\Content\MarkdownFile;

/**
 * One content item — a post, a page — as a template sees it.
 *
 * Frontmatter keys the drop does not declare are answered dynamically, so a
 * theme can read `{post.subtitle}` the moment someone puts `subtitle:` in a
 * markdown file, with no PHP change.
 */
final class PageDrop extends Drop {

	/** @param (\Closure(string, mixed): mixed)|null $augment turns a field's stored value into what a template reads */
	public function __construct(
		private readonly MarkdownFile $file,
		private readonly string $html,
		private readonly ?\Closure $augment = null,
	) {}

	public function title(): string {
		return (string) ( $this->file->frontmatter['title'] ?? $this->file->slug );
	}

	public function slug(): string {
		return $this->file->slug;
	}

	public function collection(): string {
		return $this->file->collection;
	}

	public function url(): string {
		return $this->file->url();
	}

	public function content(): string {
		return $this->html;
	}

	public function excerpt(): string {
		$text = trim( (string) preg_replace( '/\s+/', ' ', strip_tags( $this->html ) ) );

		return mb_strlen( $text ) > 200 ? mb_substr( $text, 0, 200 ) . '…' : $text;
	}

	public function date(): ?string {
		$date = $this->file->frontmatter['date'] ?? null;

		return null === $date ? null : (string) $date;
	}

	/** @return list<string> */
	public function tags(): array {
		return array_values( array_map( 'strval', (array) ( $this->file->frontmatter['tags'] ?? [] ) ) );
	}

	public function draft(): bool {
		return (bool) ( $this->file->frontmatter['draft'] ?? false );
	}

	/** Any other frontmatter key — a relationship's references read as the entries they name. */
	protected function methodMissing( string $name ): mixed {
		$value = $this->file->frontmatter[ $name ] ?? null;

		return null === $value || null === $this->augment ? $value : ( $this->augment )( $name, $value );
	}
}
