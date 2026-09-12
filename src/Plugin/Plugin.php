<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Plugin;

/**
 * A plugin: PHP that runs inside the build and the dev server.
 *
 * One method. Everything a plugin can do it does by reaching a registry on the
 * context and adding to it — which keeps the extension surface enumerable
 * (docs/backend.md §10.1) instead of scattered across hooks.
 */
interface Plugin {

	public function register( PluginContext $context ): void;
}
