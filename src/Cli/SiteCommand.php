<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Cli;

use Phpmystic\Pillar\Pillar;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;

/** Shared plumbing: every command works on a site directory. */
abstract class SiteCommand extends Command {

	protected function configure(): void {
		$this->addOption( 'site', 's', InputOption::VALUE_REQUIRED, 'The site directory', getcwd() ?: '.' );
	}

	protected function siteRoot( InputInterface $input ): string {
		return (string) $input->getOption( 'site' );
	}

	protected function pillar( InputInterface $input, bool $editor = false, bool $drafts = false, bool $compile = true ): Pillar {
		return Pillar::forSite( $this->siteRoot( $input ), $editor, $drafts, $compile );
	}
}
