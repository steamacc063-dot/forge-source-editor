# Changelog

## v0.1.1 — 2026-10-13

- Native world settings, sky enclosure, sunlight, fog and sky camera helpers.
- Sky diagnostics and separate VMF codec and brush geometry modules.
- Extracted scene hierarchy, vector fields and editor utilities.
- Automated macOS, Windows and Linux release packages with checksums.

## v0.1.0 — 2026-10-13

Initial open-source preview release.

- Modern Source 1 editor workflows with a classic gray desktop theme.
- Convex brush reconstruction/editing, transform gizmos and grid snapping.
- Perspective and orthographic views, free camera navigation and resizable panels.
- Material paths, entity properties and repeated entity output connections.
- Room, staircase and platform prefabs; project saves, undo/redo and local recovery.
- VMF import/export preserving unknown chunks, UV axes, entity data and protected displacement blocks.
- SDK build process bridge with logs and cancellation, plus local map checks.
- MIT license, contribution guide, issue templates, roadmap and CI configuration.

### Validation and limits

The local test suite and production build pass. The Mac desktop app was previously smoke-tested; browser editing flows were exercised. Windows runtime, real SDK compilation and in-game compatibility are not claimed as verified. Game asset mounting, FGD loading, clipping/CSG, displacement editing and live synchronization are not yet implemented.
