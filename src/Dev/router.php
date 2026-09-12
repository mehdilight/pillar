<?php
/**
 * The entry point PHP's built-in server runs for every request.
 *
 * Kept tiny on purpose: it exists to boot the autoloader and hand the request
 * to `Server`, which is plain PHP and therefore testable without a server at
 * all.
 */
declare( strict_types=1 );

use Phpmystic\Pillar\Dev\Server;
use Symfony\Component\HttpFoundation\Request;

foreach ( [ __DIR__ . '/../../vendor/autoload.php', __DIR__ . '/../../../../autoload.php' ] as $autoload ) {
	if ( is_file( $autoload ) ) {
		require $autoload;

		break;
	}
}

$server = new Server(
	(string) getenv( 'PILLAR_SITE' ),
	(string) getenv( 'PILLAR_DASHBOARD' )
);

$server->handle( Request::createFromGlobals() )->send();
