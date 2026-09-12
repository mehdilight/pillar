---
title: Plugins, and the SEO plugin
date: 2026-09-10T10:56
summary: A plugin API for head tags, routes, build hooks, template functions and dashboard panels — and an SEO plugin that uses all of it.
tags: [release, plugins]
---
Plugins register into the head, the route table, the build, the Liqx environment and the dashboard, and declare what they read so incremental builds stay correct. Their dashboard bundles load at runtime, never compiled in. The SEO plugin — titles, social cards, structured data, sitemap, robots.txt and writing suggestions — was ported to prove the API.
