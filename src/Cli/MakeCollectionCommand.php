<?php
declare( strict_types=1 );

namespace Pillar\Cli;

use Pillar\Content\ContentType;
use Pillar\PillarException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Scaffold a content type.
 *
 * Writes the same three files a person would write by hand, so a type made
 * here and one typed into an editor are the same thing.
 */
#[AsCommand( name: 'make:collection', description: 'Create a content type: its fields, its folder and its template' )]
final class MakeCollectionCommand extends SiteCommand {

	protected function configure(): void {
		parent::configure();

		$this->addArgument( 'name', InputArgument::REQUIRED, 'Plural, lowercase — e.g. "guides"' );
		$this->addOption( 'label', 'l', InputOption::VALUE_REQUIRED, 'What the dashboard calls it' );
		$this->addOption(
			'fields',
			null,
			InputOption::VALUE_REQUIRED,
			'Comma-separated field presets (' . implode( ', ', array_keys( ContentType::PRESETS ) ) . ')',
			implode( ',', ContentType::DEFAULT_FIELDS )
		);
		$this->addOption( 'no-template', null, InputOption::VALUE_NONE, 'Do not scaffold templates/<singular>.json' );
	}

	protected function execute( InputInterface $input, OutputInterface $output ): int {
		try {
			$site = $this->pillar( $input, compile: false )->site;

			$keys   = array_values( array_filter( array_map( 'trim', explode( ',', (string) $input->getOption( 'fields' ) ) ) ) );
			$fields = [];

			foreach ( $keys as $key ) {
				if ( ! isset( ContentType::PRESETS[ $key ] ) ) {
					$output->writeln( sprintf(
						'<error>No such field preset: "%s". Known: %s</error>',
						$key,
						implode( ', ', array_keys( ContentType::PRESETS ) )
					) );

					return self::FAILURE;
				}

				$fields[] = ContentType::PRESETS[ $key ];
			}

			$result = ( new ContentType( $site ) )->create(
				(string) $input->getArgument( 'name' ),
				(string) ( $input->getOption( 'label' ) ?? '' ),
				[] === $fields ? null : $fields,
				! (bool) $input->getOption( 'no-template' )
			);
		} catch ( PillarException $error ) {
			$output->writeln( '<error>' . $error->getMessage() . '</error>' );

			return self::FAILURE;
		}

		$output->writeln( sprintf( '<info>✓</info> Created the "%s" collection.', $result['name'] ) );

		foreach ( $result['files'] as $file ) {
			$output->writeln( '  ' . $file );
		}

		foreach ( $result['notes'] as $note ) {
			$output->writeln( '  <comment>' . $note . '</comment>' );
		}

		$output->writeln( '' );
		$output->writeln( sprintf(
			'Add an entry at <options=bold>content/%s/first-entry.md</> — it will serve at /%s/first-entry/.',
			$result['name'],
			$result['name']
		) );

		return self::SUCCESS;
	}
}
