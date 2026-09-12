# Pillar Git-Based CMS Roadmap

This roadmap outlines the evolution of Pillar's Git-based CMS architecture, transforming it from a local-only CLI repository manager into a versatile, collaborative, headless-capable Git CMS.

---

## Architecture Overview

Pillar's CMS uses Git as the single source of truth:
- **Drafts** live in the working tree (or draft branches).
- **Publishing** creates standard Git commits and pushes to upstream remotes.
- **History** is powered by `git log`.
- **Reversion & Rollback** use Git's checkout, revert, and clean operations.
- **Content Paths** are scoped to editor-owned directories (`templates/`, `config/`, `content/`, `assets/`), preventing code or developer files from being swept into editorial commits.

---

## Milestones

### Milestone 1: Git Provider API Mode (Headless / Hosted Deployments) — *In Progress*
Enable Pillar to operate in environments where local `git` CLI binaries or filesystem writes are unavailable (e.g., serverless platforms, Vercel, Netlify, Cloudflare, containerized environments):
- **Provider Interface (`GitProviderInterface`)**: Formal contract abstracting Git operations (`status`, `history`, `commit`, `discard`, `branches`, `diff`).
- **Local CLI Provider (`LocalGitProvider`)**: High-performance local binary driver using `proc_open`.
- **Remote GitHub API Provider (`GitHubProvider`)**:
  - Direct interaction with the GitHub REST / Git Data API (refs, trees, blobs, commits, pull requests).
  - Authentication via Personal Access Token (`GITHUB_TOKEN`) or OAuth app.
  - Commits authored and attributed to authenticated users.
- **Remote GitLab API Provider (`GitLabProvider`)**:
  - GitLab REST API adapter (`/repository/commits`, `/repository/branches`).
- **Provider Auto-Detection & Configuration (`config/git.json`)**: Seamless fallback between local repository operations and remote API mode based on environment variables or configuration.

---

### Milestone 2: Editorial Workflow & Branch Management — *In Progress*
Enable content teams to write and preview drafts in isolated branches rather than committing directly to `main`:
- **Branch Management in CMS & API**:
  - List available local and remote branches (`GET /api/git/branches`).
  - Create new feature/draft branches from `main` (`POST /api/git/branches`).
  - Switch active working branch (`POST /api/git/branches/switch`).
- **Draft Branching**:
  - Automatically or manually create a branch per article or campaign (e.g., `cms/post-summer-release`).
  - Live preview against the active branch.
- **Editorial Review Pipeline**:
  - Status progression: **Draft** → **In Review** → **Ready to Publish**.
  - Pull Request / Merge Request integration: open PR directly from the CMS when moving a draft to review.
  - Direct branch merging for authorized publishers.

---

### Milestone 3: Granular & Selective Publishing
Move beyond "all-or-nothing" site-wide commits:
- **Selective Staging**: Checkboxes on the Publish screen allowing authors to select which modified entries, templates, or media files to include in a commit.
- **Per-Entry Quick Publish**: Ability to publish a single content entry immediately from its editing screen.
- **Scheduled Publishing**: Storing release timestamps in metadata with automated CI or webhook triggers to merge/publish when the schedule arrives.

---

### Milestone 4: Entry-Level History, Diffs & Rollbacks
Provide granular visibility and control over content changes:
- **Per-File Revision Timeline**: View commits and authors specific to the currently viewed content entry (`git log -- content/<collection>/<slug>.md`).
- **Visual Diff Inspector**: Side-by-side or unified diff viewer showing changes in Markdown body and YAML frontmatter prior to committing.
- **Single-File Discard & Restore**: Revert uncommitted changes on a single file without discarding work on other files.
- **Point-in-Time Restore**: Restore any historical version of an entry directly into the current draft.

---

### Milestone 5: Remote Synchronization & Conflict Resolution
Handle distributed multi-user editing gracefully:
- **Upstream Fetch Alerts**: Periodic background check (`git fetch`) warning when `origin/main` has new commits ahead of the local working tree.
- **Fast-Forward & Pull in UI**: One-click pull to update the working tree with upstream changes.
- **Merge Conflict Detection**: Surface conflict markers visually with side-by-side conflict resolution tools instead of failing with raw Git errors.

---

### Milestone 6: Collaboration, File Locks & Attribution
Facilitate teams editing the same repository:
- **Concurrent Editing Awareness & Soft Locks**: Ephemeral lock markers (via temporary branch, metadata file, or WebSocket heartbeat) warning users when an entry is being edited by another author.
- **Multi-User Attribution**: Commit author names and emails matched to the logged-in CMS user or GitHub/GitLab account rather than a global server default.

---

### Milestone 7: Media Storage & Large File Optimization
Prevent repository bloat caused by heavy media assets:
- **Git LFS Integration**: Automatic pointer generation for audio, video, and large binary media files.
- **External Storage Drivers**: Configurable adapters for S3, Cloudflare R2, or Cloudinary with Git storing only URLs and metadata.

---

### Milestone 8: Deployment Visibility & Webhooks
Bridge the gap between Git push and live site deployment:
- **Deployment Status Badges**: Query GitHub Actions, Vercel, or Netlify deployment status APIs to show "Building", "Live", or "Failed" states in the CMS header.
- **Outgoing Webhooks**: Trigger custom URLs upon publish (rebuild hooks, cache purges, Slack notifications).
