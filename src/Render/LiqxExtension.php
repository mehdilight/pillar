<?php
declare( strict_types=1 );

namespace Pillar\Render;

use Phpmystic\Liqx\Environment;

/**
 * Filters and globals a *theme* asks for by name.
 *
 * The seam plugins extend (docs/backend.md §10.1). It exists from the first
 * milestone, applied to an initially empty list, so the render path never has
 * to be reworked to accommodate one.
 */
interface LiqxExtension {

	public function extend( Environment $environment ): void;
}
