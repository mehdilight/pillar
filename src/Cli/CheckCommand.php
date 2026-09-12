<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Cli;

use Phpmystic\Pillar\PillarException;
use Phpmystic\Pillar\Schema\Validator;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand( name: 'check', description: 'Validate schemas, templates and content' )]
final class CheckCommand extends SiteCommand {

	protected function execute( InputInterface $input, OutputInterface $output ): int {
		try {
			$pillar = $this->pillar( $input, drafts: true, compile: false );
		} catch ( PillarException $error ) {
			$output->writeln( '<error>' . $error->getMessage() . '</error>' );

			return self::FAILURE;
		}

		$validator = new Validator( $pillar->site, $pillar->schemas, $pillar->content );
		$problems  = $validator->run();

		if ( [] === $problems ) {
			$output->writeln( '<info>✓</info> No problems found.' );

			return self::SUCCESS;
		}

		$errors   = 0;
		$warnings = 0;

		foreach ( $problems as $problem ) {
			$isError = 'error' === $problem['level'];
			$isError ? $errors++ : $warnings++;

			$output->writeln( sprintf(
				'%s <options=bold>%s</> %s',
				$isError ? '<fg=red>error  </>' : '<fg=yellow>warning</>',
				$problem['where'],
				$problem['message']
			) );
		}

		$output->writeln( '' );
		$output->writeln( sprintf( '%d error(s), %d warning(s)', $errors, $warnings ) );

		// A warning is something to look at, not something to stop a build.
		return $validator->hasErrors() ? self::FAILURE : self::SUCCESS;
	}
}
