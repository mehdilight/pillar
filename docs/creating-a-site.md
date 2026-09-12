# Creating your own site

[Documentation index](README.md) · [Installation](installation.md)

First complete the [installation guide](installation.md), including the dashboard build. The commands below start in the Pillar package root, where `bin/pillar` and `examples/starter/` are located.

## Copy the starter

Choose a new destination outside the Pillar package. This example uses a sibling directory named `my-content-site`:

```bash
cp -R examples/starter ../my-content-site
./bin/pillar dev --site ../my-content-site
```

Open http://127.0.0.1:7788. Saving now updates files in `../my-content-site/`. Keep the installed Pillar package available: it supplies the CLI, dashboard, and bundled SEO plugin used by this site.

The starter includes a landing page, blog, documentation section, theme settings, and SEO configuration. Change its name and `base_url` in `../my-content-site/site.json`, then edit its entries and page sections in the dashboard.

See [site configuration](../website/content/docs/site-json.md) and [project structure](../website/content/docs/project-structure.md) for the file layout.

## Add Git history

A separate repository lets you track your site's content independently. From the Pillar package root:

```bash
printf 'dist/\n.pillar/\n' >> ../my-content-site/.gitignore
git -C ../my-content-site init
git -C ../my-content-site add .
git -C ../my-content-site commit -m "Create Pillar site"
```

Configure your Git author identity if Git requests it. Saving writes files; publishing commits changes and can push to a remote if one is configured. See [publishing](../website/content/docs/publishing.md).

## Validate and build

From the Pillar package root:

```bash
./bin/pillar check --site ../my-content-site
./bin/pillar build --site ../my-content-site
php -S 127.0.0.1:8080 -t ../my-content-site/dist
```

Open http://127.0.0.1:8080 to inspect the generated site. Draft entries are excluded by default. Use `--force` on the build command to regenerate every page.

Set the production `base_url` before the final build, then upload the contents of `../my-content-site/dist/` to a static host. Git publishing and deployment are separate operations. See [deployment](../website/content/docs/deploying.md).
