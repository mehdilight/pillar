---
title: Never hash an mtime
date: 2026-09-09
tags: [build]
draft: true
---
Pillar's first incremental build compared modification times. It skipped every
page after a real edit.

Modification times have one-second granularity, and the entire dev loop happens
inside one second: save, rebuild, look. The check said nothing had changed
because, to the second, nothing had.

Dependencies are content-hashed now, memoized per path per build — thirty
templates read once each, however many of five hundred pages depend on them.
