<?php
declare( strict_types=1 );

namespace Pillar\Dev;

use Pillar\Media\AltText;
use Pillar\PillarException;
use Pillar\Site\PathPolicy;
use Pillar\Site\Site;

/**
 * The media library: images chosen in the dashboard are ordinary site assets.
 *
 * Uploads land in `assets/uploads/`, where they are versioned with the rest of
 * the site and built through the same content-hashed asset pipeline — there is
 * no separate media store to back up or forget about.
 */
final class Media {

	private const IMAGE_EXTENSIONS = [ 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg' ];

	/**
	 * Files a `file` field can offer: downloads, not pages. Nothing a browser
	 * would run — no HTML, no SVG, no script — since an upload is served from
	 * the site's own origin.
	 */
	public const FILE_EXTENSIONS = [ 'pdf', 'zip', 'csv', 'txt', 'docx', 'xlsx', 'pptx', 'mp3', 'mp4', 'webm' ];

	private const MAX_FILE_BYTES = 25 * 1024 * 1024;

	/** Checked on the decoded bytes; the encoded payload may be a third larger. */
	private const MAX_BYTES = 10 * 1024 * 1024;

	private readonly AltText $alt;

	public function __construct( private readonly Site $site ) {
		$this->alt = new AltText( $site );
	}

	/**
	 * Every image and file in every layer, the site's own shadowing a theme's
	 * of the same name. Images from an addon or theme are listed read-only — they
	 * belong to their package, and deleting one would be undone on update.
	 *
	 * Each carries the site files that mention it, so the library can say an
	 * image is in use before someone deletes it.
	 *
	 * @return list<array{name: string, url: string, size: int, width: int|null, height: int|null, readonly: bool, modified: int, used_in: list<string>, alt: string, kind: string}>
	 */
	public function all(): array {
		$images = [];

		foreach ( $this->site->layers()->all() as $layer ) {
			$root = $layer['root'] . '/assets';

			if ( ! is_dir( $root ) ) {
				continue;
			}

			$files = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $root, \FilesystemIterator::SKIP_DOTS ) );

			foreach ( $files as $file ) {
				/** @var \SplFileInfo $file */
				if ( ! $file->isFile() || ! self::isMedia( $file->getFilename() ) ) {
					continue;
				}

				$name = substr( $file->getPathname(), strlen( $root ) + 1 );

				$images[ $name ] ??= $this->describe( $file->getPathname(), '/assets/' . $name, $layer['root'] !== $this->site->root );
			}
		}

		ksort( $images );

		$sources = $this->sources();

		foreach ( $images as $name => $image ) {
			$images[ $name ]['used_in'] = self::mentions( $name, $sources );
			$images[ $name ]['alt']     = $this->alt->for( $image['url'] );
		}

		return array_values( $images );
	}

	/**
	 * Save an uploaded image.
	 *
	 * The type comes from the bytes, never the file name: a script renamed
	 * `photo.png` is refused. The stored name carries a content hash, so two
	 * uploads called `image.png` do not overwrite each other and a re-upload of
	 * the same file is the same file.
	 *
	 * @param array<string, mixed> $input `name` and base64 `data`
	 *
	 * @return array{name: string, url: string, size: int, width: int|null, height: int|null, readonly: bool, modified: int, used_in: list<string>, alt: string, kind: string}
	 */
	public function upload( array $input ): array {
		$encoded = (string) ( $input['data'] ?? '' );

		if ( strlen( $encoded ) > self::MAX_FILE_BYTES * 1.4 ) {
			throw new PillarException( 'Choose a file smaller than 25 MB.' );
		}

		$data = base64_decode( $encoded, true );
		$info = false === $data ? false : @getimagesizefromstring( $data );

		if ( false !== $data && false === $info ) {
			return $this->uploadFile( (string) ( $input['name'] ?? 'file' ), $data );
		}

		$extension = match ( $info['mime'] ?? '' ) {
			'image/png'  => 'png',
			'image/jpeg' => 'jpg',
			'image/gif'  => 'gif',
			'image/webp' => 'webp',
			'image/avif' => 'avif',
			default      => null,
		};

		if ( null === $extension ) {
			throw new PillarException( 'Choose a PNG, JPG, GIF, WebP or AVIF image.' );
		}

		if ( strlen( (string) $data ) > self::MAX_BYTES ) {
			throw new PillarException( 'Choose an image smaller than 10 MB.' );
		}

		return $this->store( (string) ( $input['name'] ?? 'image' ), (string) $data, $extension );
	}

	/**
	 * A document, archive or recording. The extension must be one a `file`
	 * field offers, and the bytes must be what it claims: a PDF starts
	 * `%PDF-`, an Office file is a ZIP, a text file is text.
	 *
	 * @return array{name: string, url: string, size: int, width: int|null, height: int|null, readonly: bool, modified: int, used_in: list<string>, alt: string, kind: string}
	 */
	private function uploadFile( string $original, string $data ): array {
		$extension = strtolower( pathinfo( $original, PATHINFO_EXTENSION ) );

		if ( ! in_array( $extension, self::FILE_EXTENSIONS, true ) ) {
			throw new PillarException( 'Choose a PNG, JPG, GIF, WebP or AVIF image, or a PDF, ZIP, CSV, text, Word, Excel, PowerPoint, MP3, MP4 or WebM file.' );
		}

		$genuine = match ( $extension ) {
			'pdf'                                => str_starts_with( $data, '%PDF-' ),
			'zip', 'docx', 'xlsx', 'pptx'        => str_starts_with( $data, "PK\x03\x04" ) || str_starts_with( $data, "PK\x05\x06" ),
			'mp3'                                => str_starts_with( $data, 'ID3' ) || 1 === preg_match( '/^\xFF[\xE0-\xFF]/', $data ),
			'mp4'                                => 'ftyp' === substr( $data, 4, 4 ),
			'webm'                               => str_starts_with( $data, "\x1A\x45\xDF\xA3" ),
			default                              => ! str_contains( $data, "\0" ) && mb_check_encoding( $data, 'UTF-8' ),
		};

		if ( ! $genuine ) {
			throw new PillarException( sprintf( '%s is not a real .%s file.', basename( $original ), $extension ) );
		}

		return $this->store( $original, $data, $extension );
	}

	/** @return array{name: string, url: string, size: int, width: int|null, height: int|null, readonly: bool, modified: int, used_in: list<string>, alt: string, kind: string} */
	private function store( string $original, string $data, string $extension ): array {
		$stem = pathinfo( basename( $original ), PATHINFO_FILENAME );
		$stem = trim( (string) preg_replace( '/[^a-z0-9]+/', '-', strtolower( $stem ) ), '-' ) ?: 'file';
		$name = substr( $stem, 0, 60 ) . '-' . substr( hash( 'sha256', $data ), 0, 10 ) . '.' . $extension;

		$root = $this->site->absolute( 'assets/uploads' );

		@mkdir( $root, 0777, true );

		if ( false === file_put_contents( $root . '/' . $name, $data ) ) {
			throw new PillarException( 'Could not save the file. Check that the site folder is writable.' );
		}

		return $this->describe( $root . '/' . $name, '/assets/uploads/' . $name, false );
	}

	/**
	 * Remove one of the site's own images.
	 *
	 * Resolved through `realpath` and confined to the site's own `assets/`: a
	 * symlink out of the site, a `..`, or a file an addon ships are all refused.
	 */
	public function delete( string $url ): void {
		$relative = PathPolicy::normalise( ltrim( $url, '/' ) );

		if ( ! str_starts_with( $relative, 'assets/' ) || ! self::isMedia( $relative ) ) {
			throw new PillarException( 'Only images and files in the site media library can be deleted.' );
		}

		$path = realpath( $this->site->absolute( $relative ) );
		$root = realpath( $this->site->absolute( 'assets' ) );

		$owned = false !== $path
			&& false !== $root
			&& str_starts_with( $root, $this->site->root . '/' )
			&& str_starts_with( $path, $root . '/' )
			&& is_file( $path );

		if ( ! $owned ) {
			throw new PillarException( 'This image is not a file owned by this site.' );
		}

		if ( ! unlink( $path ) ) {
			throw new PillarException( 'Could not delete the image.' );
		}

		$this->alt->forget( $url );
	}

	/**
	 * The site's own text files, by path: what an image can be referenced
	 * from — content, settings, templates, stylesheets.
	 *
	 * @return array<string, string>
	 */
	private function sources(): array {
		$sources = [];
		$text    = [ 'liqx', 'json', 'md', 'yaml', 'yml', 'css', 'js', 'txt' ];

		foreach ( PathPolicy::ROOT_FILES as $file ) {
			if ( is_file( $this->site->root . '/' . $file ) ) {
				$sources[ $file ] = (string) file_get_contents( $this->site->root . '/' . $file );
			}
		}

		foreach ( PathPolicy::FOLDERS as $folder ) {
			$root = $this->site->root . '/' . $folder;

			if ( ! is_dir( $root ) ) {
				continue;
			}

			$files = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $root, \FilesystemIterator::SKIP_DOTS ) );

			foreach ( $files as $file ) {
				/** @var \SplFileInfo $file */
				if ( $file->isFile() && $file->getSize() <= 1024 * 1024 && in_array( strtolower( $file->getExtension() ), $text, true ) ) {
					$sources[ $folder . substr( $file->getPathname(), strlen( $root ) ) ] = (string) file_get_contents( $file->getPathname() );
				}
			}
		}

		ksort( $sources );

		return $sources;
	}

	/**
	 * Which sources name an image, by its path under `assets/` — which is how
	 * every form of reference ends: `/assets/uploads/a.png`, `assets/…`, or the
	 * bare `uploads/a.png` an image setting may hold. The name must not be the
	 * tail of a longer one: `logo.png` is not mentioned by `site-logo.png`.
	 *
	 * @param array<string, string> $sources
	 *
	 * @return list<string>
	 */
	private static function mentions( string $name, array $sources ): array {
		$pattern = '~(?<![\w.-])' . preg_quote( $name, '~' ) . '(?![\w.-]*\w)~';

		return array_keys( array_filter( $sources, static fn ( string $text ): bool => 1 === preg_match( $pattern, $text ) ) );
	}

	/**
	 * Set an image's alt text, returning the image. Theme images take alt text
	 * too — it is kept in the site's own `config/media.json`, not the theme.
	 *
	 * @return array{name: string, url: string, size: int, width: int|null, height: int|null, readonly: bool, modified: int, used_in: list<string>, alt: string, kind: string}
	 */
	public function setAlt( string $url, string $alt ): array {
		foreach ( $this->all() as $image ) {
			if ( $image['url'] === $url ) {
				$this->alt->set( $url, $alt );

				return [ 'alt' => $this->alt->for( $url ) ] + $image;
			}
		}

		throw new PillarException( 'There is no such image in the media library.' );
	}

	private static function isImage( string $path ): bool {
		return in_array( strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), self::IMAGE_EXTENSIONS, true );
	}

	private static function isMedia( string $path ): bool {
		return self::isImage( $path ) || in_array( strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), self::FILE_EXTENSIONS, true );
	}

	/** @return array{name: string, url: string, size: int, width: int|null, height: int|null, readonly: bool, modified: int, used_in: list<string>, alt: string, kind: string} */
	private function describe( string $path, string $url, bool $readonly ): array {
		$dimensions = @getimagesize( $path );

		return [
			'name'     => basename( $path ),
			'url'      => $url,
			'size'     => (int) filesize( $path ),
			'width'    => false === $dimensions ? null : $dimensions[0],
			'height'   => false === $dimensions ? null : $dimensions[1],
			'readonly' => $readonly,
			'modified' => (int) filemtime( $path ),
			'used_in'  => [],
			'alt'      => $this->alt->for( $url ),
			'kind'     => self::isImage( $path ) ? 'image' : 'file',
		];
	}
}
