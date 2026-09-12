<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Cli;

use Phpmystic\Pillar\Build\Builder;
use Phpmystic\Pillar\PillarException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand( name: 'build', description: 'Render the site to dist/' )]
final class BuildCommand extends SiteCommand {

	protected function configure(): void {
		parent::configure();

		$this->addOption( 'force', 'f', InputOption::VALUE_NONE, 'Rebuild every page, ignoring the manifest' );
		$this->addOption( 'drafts', null, InputOption::VALUE_NONE, 'Include draft content' );
	}

	protected function execute( InputInterface $input, OutputInterface $output ): int {
		try {
			$pillar = $this->pillar( $input, drafts: (bool) $input->getOption( 'drafts' ) );
		} catch ( PillarException $error ) {
			$output->writeln( '<error>' . $error->getMessage() . '</error>' );

			return self::FAILURE;
		}

		$verbose = $output->isVerbose();
		$builder = new Builder( $pillar, (bool) $input->getOption( 'force' ) );

		try {
			$result = $builder->build(
				static function ( string $url, bool $rebuilt ) use ( $output, $verbose ): void {
					if ( $verbose ) {
						$output->writeln( sprintf( '  %s %s', $rebuilt ? '<info>build</info>' : '<comment>skip </comment>', $url ) );
					}
				}
			);
		} catch ( PillarException $error ) {
			$output->writeln( '<error>' . $error->getMessage() . '</error>' );

			return self::FAILURE;
		}

		$output->writeln( sprintf(
			'<info>✓</info> %d page(s) written, %d unchanged, %d asset(s), %d resized image(s) — %dms',
			$result['written'],
			$result['skipped'],
			$result['assets'],
			$result['images'],
			$result['ms']
		) );

		// A section that threw rendered as empty and the page still shipped —
		// but a build that quietly dropped a section is not a successful build.
		if ( ! $pillar->errors->isEmpty() ) {
			$output->writeln( '' );

			foreach ( $pillar->errors->all() as $failure ) {
				$output->writeln( sprintf(
					'<fg=red>error  </> <options=bold>%s</> section "%s" (%s): %s',
					$failure['route'],
					$failure['section'],
					$failure['type'],
					$failure['error']->getMessage()
				) );
			}

			$output->writeln( '' );
			$output->writeln( sprintf( '<error>%d section(s) failed to render.</error>', $pillar->errors->count() ) );

			return self::FAILURE;
		}

		return self::SUCCESS;
	}
}
