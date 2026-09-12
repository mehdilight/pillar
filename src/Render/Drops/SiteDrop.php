<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render\Drops;

use Phpmystic\Pillar\Site\Site;

/** `{site.title}` — the site itself, as a theme sees it. */
final class SiteDrop extends Drop {

	public function __construct(
		private readonly Site $site,
		/** @var array<string, mixed> */
		private readonly array $settings,
	) {}

	public function title(): string {
		return (string) ( $this->settings['site_title'] ?? $this->site->name );
	}

	public function name(): string {
		return $this->site->name;
	}

	public function tagline(): string {
		return (string) ( $this->settings['tagline'] ?? '' );
	}

	public function url(): string {
		return $this->site->baseUrl;
	}

	public function buildTime(): int {
		return time();
	}
}
