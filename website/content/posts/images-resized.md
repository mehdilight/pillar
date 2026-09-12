---
title: Images resized at build time
date: 2026-09-10T21:04
summary: Every image gets smaller WebP copies when the site is built, and pages point browsers at them with srcset.
tags: [images, build]
---
The build copies every JPEG, PNG and WebP at the configured widths, caches the copies by content, and writes `srcset`, dimensions and lazy loading into markdown images and `image_tag`. A 96 KB screenshot shown at 720 pixels now costs 28 KB. See [Images](/docs/images/).
