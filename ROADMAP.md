# Forge roadmap

This is a list of development priorities, not a promised release schedule.

## Available in v0.1.0

- Convex brush creation and editing, perspective/orthographic views and transform gizmos.
- Scene hierarchy, inspector, grid snapping, per-face material paths and entity properties/outputs.
- Room/stair/platform insertion, project-based prefabs, undo/redo and recovery autosave.
- Native VMF import/export with protection for unsupported data.
- Local map checks and a desktop VBSP → VVIS → VRAD build bridge.
- Classic gray theme and MIT-licensed source.

## Next: game-aware editing

- Load FGDs for class-aware entity properties and input/output lists.
- Mount game assets and provide material/model browsing and previews.
- Validate VMF exports against real Half-Life 2, Garry's Mod and Counter-Strike: Source toolchains.
- Improve compile diagnostics, leak pointfile inspection and game launch.

## Geometry and authoring

- Face picking and UV/texture-lock tools.
- Brush clipping/CSG and vertex editing.
- Displacement authoring and accurate previews.
- Multi-selection, reusable multi-object prefabs and instance expansion.

## Reliability and distribution

- Incremental geometry updates and large-map performance profiling.
- More malformed-input and round-trip fixtures from supported SDK branches.
- Native runtime validation on Windows and Linux.
- Signed installers and reproducible release packaging.
- In-game live iteration after the map/build pipeline has been validated.
