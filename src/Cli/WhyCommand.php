<?php
declare( strict_types=1 );

namespace Pillar\Cli;

use Pillar\Site\Site;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Which layer a file came from.
 *
 * Without this, an override that silently does nothing — an addon shadowed by
 * the theme, a site file in the wrong folder — is unanswerable.
 */
#[AsCommand( name: 'why', description: 'Show which layer provides a file, and what it shadows' )]
final class WhyCommand extends SiteCommand {

	protected function configure(): void {
		parent::configure();
		$this->addArgument( 'path', InputArgument::REQUIRED, 'e.g. sections/hero.liqx' );
	}

	protected function execute( InputInterface $input, OutputInterface $output ): int {
		$path       = (string) $input->getArgument( 'path' );
		$candidates = Site::load( $this->siteRoot( $input ) )->layers()->candidates( $path );

		if ( [] === $candidates ) {
			$output->writeln( sprintf( '<comment>%s</comment> is not provided by any layer.', $path ) );

			return self::FAILURE;
		}

		foreach ( $candidates as $index => $candidate ) {
			$output->writeln( sprintf(
				'%s <options=bold>%s</> %s',
				0 === $index ? '<info>wins   </info>' : '<comment>shadowed</comment>',
				$candidate['layer'],
				$candidate['path']
			) );
		}

		return self::SUCCESS;
	}
}
