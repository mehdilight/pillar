# Installing Pillar

[Documentation index](README.md) · [Next: create your site](creating-a-site.md)

Packagist lists PHP packages and their releases. Composer is the command-line tool that downloads those packages and installs their dependencies.

## Requirements

- PHP 8.2+ with `mbstring` and `json`.
- Composer 2.
- Node.js 22+ and npm to build the dashboard and plugin interfaces.
- Git for installation from source and optional content publishing.

PHP's `gd` extension enables image resizing; `exif` enables photo orientation correction. A generated static site needs neither PHP nor Node.js on its host.

## Install a release with Composer

Once `phpmystic/pillar` is indexed on [Packagist](https://packagist.org/packages/phpmystic/pillar), run:

```bash
composer create-project phpmystic/pillar my-site "^0.1"
cd my-site
npm --prefix apps/editor ci
npm --prefix apps/editor run build
./bin/pillar dev --site examples/starter
```

Open http://127.0.0.1:7788 for the dashboard, or http://127.0.0.1:7788/preview/ for the live site.

`create-project` creates the destination directory and installs PHP dependencies. The `^0.1` constraint selects a stable 0.1.x release. See [Composer's create-project reference](https://getcomposer.org/doc/03-cli.md#create-project).

The destination contains the full Pillar package, including source, examples, and documentation. Your example site's content is in `my-site/examples/starter/`. The destination root is not itself a site: pass `--site examples/starter` when running the CLI there.

The initial release does not include prebuilt dashboard assets. Both npm commands are required to use the dashboard; the build also compiles the bundled SEO plugin interface.

## Install from Git

Use a checkout to work on Pillar itself, or while waiting for Packagist registration:

```bash
git clone https://github.com/mehdilight/pillar.git pillar
cd pillar
composer install
npm --prefix apps/editor ci
npm --prefix apps/editor run build
./bin/pillar dev --site examples/starter
```

Composer downloads Liqx from Packagist. A neighboring Liqx checkout is not required.

## Installing as a dependency

In an existing Composer project, `composer require phpmystic/pillar:^0.1` installs the engine under `vendor/phpmystic/pillar/` and exposes `vendor/bin/pillar`.

It does not create site files or build the dashboard. For the current release, the complete-package installation above is the documented starting point. Do not store your site's editable content under `vendor/`, where dependency updates can replace files.

## Troubleshooting

- **Package not found:** check that the package and its release appear on Packagist. If registration is pending, use the Git installation.
- **Missing PHP extension:** enable the named extension for your command-line PHP, then rerun Composer. `php --ini` identifies the CLI configuration.
- **Dashboard is not built:** run the two npm commands from the package root, then restart `./bin/pillar dev --site examples/starter`.
- **Site configuration not found:** run from the package root and include `--site examples/starter`, or provide the path to your own site.
- **Port already in use:** add `--port 7790` and open http://127.0.0.1:7790.

## Future initialization workflow

A dedicated `phpmystic/pillar-starter` package is a proposed improvement. It would put site files at the project root, depend on the Pillar engine, and support this shorter flow:

```bash
# Proposed workflow — not available in the initial release
composer create-project phpmystic/pillar-starter my-site
cd my-site
vendor/bin/pillar dev
```

This requires a starter package and prebuilt dashboard assets. There is currently no `pillar init` command.
