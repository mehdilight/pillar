<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Cli;

use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Site\Site;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * The dashboard, the API and the live site, on one port.
 *
 * PHP's built-in server is single-threaded, and the dashboard's preview iframe
 * issues a request while the dashboard's own API call is still in flight —
 * which deadlocks a one-worker server. `PHP_CLI_SERVER_WORKERS` is why this
 * command exists rather than a line in a readme telling people to run `php -S`.
 */
#[AsCommand( name: 'dev', description: 'Serve the dashboard, the API and a live preview' )]
final class DevCommand extends SiteCommand {

	protected function configure(): void {
		parent::configure();

		$this->addOption( 'port', 'p', InputOption::VALUE_REQUIRED, 'Port to listen on', '7788' );
		$this->addOption( 'host', null, InputOption::VALUE_REQUIRED, 'Host to bind', '127.0.0.1' );
		$this->addOption( 'workers', null, InputOption::VALUE_REQUIRED, 'Concurrent request workers', '4' );
	}

	protected function execute( InputInterface $input, OutputInterface $output ): int {
		$root = $this->siteRoot( $input );

		try {
			$site = Site::load( $root );
		} catch ( PillarException $error ) {
			$output->writeln( '<error>' . $error->getMessage() . '</error>' );

			return self::FAILURE;
		}

		$host    = (string) $input->getOption( 'host' );
		$port    = (string) $input->getOption( 'port' );
		$workers = max( 2, (int) $input->getOption( 'workers' ) );
		$router  = dirname( __DIR__ ) . '/Dev/router.php';

		$dashboard = $this->dashboardDir();

		$output->writeln( sprintf( '<info>Pillar</info> — %s', $site->name ) );
		$output->writeln( sprintf( '  dashboard  http://%s:%s/', $host, $port ) );
		$output->writeln( sprintf( '  preview    http://%s:%s/preview/', $host, $port ) );
		$output->writeln( sprintf( '  site       %s', $site->root ) );

		if ( ! is_file( $dashboard . '/index.html' ) ) {
			$output->writeln( '' );
			$output->writeln( '<comment>The dashboard is not built — run `npm install && npm run build` in apps/editor.</comment>' );
			$output->writeln( '<comment>The preview works either way.</comment>' );
		}

		$output->writeln( '' );

		$descriptors = [ 1 => STDOUT, 2 => STDERR ];
		$environment = [
			'PILLAR_SITE'            => $site->root,
			'PILLAR_DASHBOARD'       => $dashboard,
			'PHP_CLI_SERVER_WORKERS' => (string) $workers,
			'PATH'                   => (string) getenv( 'PATH' ),
		];

		$process = proc_open(
			sprintf( '%s -S %s:%s %s', escapeshellarg( PHP_BINARY ), $host, $port, escapeshellarg( $router ) ),
			$descriptors,
			$pipes,
			$site->root,
			$environment
		);

		if ( ! is_resource( $process ) ) {
			$output->writeln( '<error>Could not start the server.</error>' );

			return self::FAILURE;
		}

		return proc_close( $process );
	}

	/** Built by `apps/editor`'s Vite build; shipped inside the package. */
	private function dashboardDir(): string {
		return dirname( __DIR__, 2 ) . '/public/editor';
	}
}
