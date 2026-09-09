<?php
declare( strict_types=1 );

namespace Pillar\Render;

use Pillar\Template\SectionInstance;

/**
 * The page currently rendering.
 *
 * The `section()` global a layout calls has to reach the layout sections *and*
 * the scope of the page being rendered, but the Environment that owns that
 * global is built once per build and reused across every page. This holder is
 * the seam: the Environment closes over it, `PageRenderer` swaps its contents
 * per page.
 */
final class PageState {

	/** @var array<string, SectionInstance> */
	public array $layoutSections = [];

	/** @var array<string, mixed> */
	public array $scope = [];

	public string $route = '';
}
