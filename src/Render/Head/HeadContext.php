<?php
declare( strict_types=1 );

namespace Pillar\Render\Head;

use Pillar\Site\Site;

/**
 * What a contributor knows about the page being rendered.
 *
 * Deliberately read-only and small: a contributor answers "what should be in
 * this page's head", and everything it needs for that is here — which page,
 * which drops, and whether this is a real page or the editor's canvas.
 */
final class HeadContext {

	/** @param array<string, mixed> $data the render scope: page, collections, settings… */
	public function __construct(
		public readonly Site $site,
		public readonly string $template,
		public readonly string $url,
		public readonly array $data,
		/** @var array<string, mixed> */
		public readonly array $settings = [],
		/** The editor's canvas, not a page anyone indexes. */
		public readonly bool $preview = false,
	) {}

	public function is( string $template ): bool {
		return $this->template === $template;
	}

	public function drop( string $name ): mixed {
		return $this->data[ $name ] ?? null;
	}

	/** The page's absolute URL, when the site declares a base. */
	public function absoluteUrl(): string {
		return '' === $this->site->baseUrl ? $this->url : $this->site->baseUrl . $this->url;
	}

	public function setting( string $id, mixed $fallback = null ): mixed {
		return $this->settings[ $id ] ?? $fallback;
	}
}
