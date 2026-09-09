<?php
declare( strict_types=1 );

namespace Pillar\Cli;

use Symfony\Component\Console\Application as ConsoleApplication;

/** The `pillar` command. */
final class Application {

	public const VERSION = '0.1.0';

	public function run(): int {
		$application = new ConsoleApplication( 'pillar', self::VERSION );

		$application->add( new CheckCommand() );
		$application->add( new DevCommand() );
		$application->add( new MakeCollectionCommand() );
		$application->add( new BuildCommand() );
		$application->add( new WhyCommand() );

		return $application->run();
	}
}
