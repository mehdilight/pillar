<?php
declare( strict_types=1 );

namespace Phpmystic\Pillar\Render\Head;

/**
 * Every `<head>` contributor, and the one place their output is ordered,
 * de-duplicated and rendered.
 *
 * Two rules make the output deterministic no matter what order plugins were
 * installed in:
 *
 *   - contributors run in ascending `priority()`, ties broken by registration
 *     order;
 *   - the first tag claiming a `HeadTag::$key` wins, and later ones for the
 *     same key are dropped.
 *
 * Together those mean "the highest-precedence contributor wins the canonical",
 * rather than "whichever plugin was installed last wins". A contributor that
 * throws is skipped with its tags discarded: a broken SEO plugin must degrade
 * the head, never blank the page.
 */
final class HeadRegistry {

	/** @var list<array{contributor: HeadContributor, seq: int}> */
	private array $contributors = [];

	private int $sequence = 0;

	public function __construct( private readonly ?\Phpmystic\Pillar\Render\RenderErrors $errors = null ) {}

	public function register( HeadContributor $contributor ): void {
		$this->contributors[] = [ 'contributor' => $contributor, 'seq' => $this->sequence++ ];
	}

	public function isEmpty(): bool {
		return [] === $this->contributors;
	}

	/** @return list<HeadContributor> in the order they will run */
	public function all(): array {
		$sorted = $this->contributors;

		usort(
			$sorted,
			static fn ( array $a, array $b ): int =>
				$a['contributor']->priority() <=> $b['contributor']->priority()
					?: $a['seq'] <=> $b['seq']
		);

		return array_map( static fn ( array $entry ): HeadContributor => $entry['contributor'], $sorted );
	}

	/**
	 * The winning tag per key, in the order they will render.
	 *
	 * @return list<HeadTag>
	 */
	public function tags( HeadContext $context ): array {
		$claimed = [];
		$tags    = [];

		foreach ( $this->all() as $contributor ) {
			try {
				$emitted = $contributor->tags( $context );
			} catch ( \Throwable $error ) {
				$this->errors?->add( $context->url, 'head', $contributor::class, $error );
				// A contributor that throws contributes nothing — not even a
				// partial list: half a JSON-LD graph is worse than none.
				continue;
			}

			foreach ( $emitted as $tag ) {
				if ( isset( $claimed[ $tag->key ] ) ) {
					continue;
				}

				$claimed[ $tag->key ] = true;
				$tags[]               = $tag;
			}
		}

		return $tags;
	}

	/** The markup to splice into `<head>`, or `''` when nothing contributed. */
	public function render( HeadContext $context ): string {
		$rendered = [];

		foreach ( $this->tags( $context ) as $tag ) {
			$markup = $tag->render();

			if ( '' !== trim( $markup ) ) {
				$rendered[] = $markup;
			}
		}

		return implode( "\n", $rendered );
	}
}
