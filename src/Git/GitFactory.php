<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Git;

/**
 * Resolves the appropriate Git provider (Local CLI or Remote API).
 */
final class GitFactory {

	public static function create( string $root ): GitProviderInterface {
		$configFile = $root . '/config/git.json';
		$config = [];

		if ( is_file( $configFile ) ) {
			$decoded = json_decode( (string) file_get_contents( $configFile ), true );
			if ( is_array( $decoded ) ) {
				$config = $decoded;
			}
		}

		$provider = (string) ( getenv( 'PILLAR_GIT_PROVIDER' ) ?: ( $_SERVER['PILLAR_GIT_PROVIDER'] ?? ( $config['provider'] ?? 'auto' ) ) );
		$token    = (string) ( getenv( 'GITHUB_TOKEN' ) ?: ( $_SERVER['GITHUB_TOKEN'] ?? ( $config['github']['token'] ?? '' ) ) );
		$repo     = (string) ( getenv( 'GITHUB_REPO' ) ?: ( $_SERVER['GITHUB_REPO'] ?? ( $config['github']['repo'] ?? '' ) ) );
		$branch   = (string) ( getenv( 'GITHUB_BRANCH' ) ?: ( $_SERVER['GITHUB_BRANCH'] ?? ( $config['github']['branch'] ?? 'main' ) ) );

		if ( 'github' === $provider || ( 'auto' === $provider && '' !== $token && '' !== $repo && ! is_dir( $root . '/.git' ) ) ) {
			[ $owner, $repository ] = array_pad( explode( '/', $repo, 2 ), 2, '' );
			if ( '' !== $owner && '' !== $repository ) {
				return new GitHubProvider( $root, $owner, $repository, $token, $branch );
			}
		}

		return new LocalGit( $root );
	}
}
