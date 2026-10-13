# Contributing to Forge

Forge is an early Source 1 editor. Contributions should improve a concrete editing workflow or compatibility with a real Source SDK branch.

## Development

Use Node.js 24, then run:

```sh
npm ci
npx install-electron
npm run dev
```

Run `npm run desktop` for the native app. Run `npm test` and `npm run build` before submitting a pull request. The compiler process tests use fake executable fixtures on POSIX systems; they are skipped on Windows and do not verify real SDK compatibility. CI checks tests and compilation on Linux, macOS and Windows.

## Pull requests

- Keep each change focused and explain the user-visible result.
- Add a regression test for map format or geometry changes. For visual changes, include a screenshot.
- Preserve imported map information. Protect unsupported data rather than silently dropping it.
- Explain any game/SDK-specific behavior, including the engine branch and tool versions used to validate it.
- Update documentation when a capability, shortcut or limitation changes.
- Do not commit generated builds, game assets, SDK executables, tokens, personal maps or local settings.

Code contributions are accepted under the repository's MIT license. Include attribution and compatible licensing for any third-party source you introduce.

## Bug reports

Include your operating system, Forge version, target game/SDK, reproduction steps and expected behavior. Use a small shareable VMF or synthetic example where possible. Check that screenshots and logs contain no private paths or credentials.

## Project structure

- `src/model.ts`: project data, convex brush geometry, VMF parsing/export and validation.
- `src/Viewport.tsx`: Three.js cameras, controls, object rendering and transform gizmos.
- `src/App.tsx`: editor workflows and panels.
- `src/Commands.tsx`: original native disclosure-based command picker.
- `src/classic-theme.css`: classic gray desktop theme.
- `electron/`: desktop file dialogs, preferences and SDK process bridge.
- `tests/`: map data and compiler bridge regression tests.
- `examples/`: generated blockout project and matching VMF.

Review [ROADMAP.md](ROADMAP.md) for the current development priorities. Report vulnerabilities according to [SECURITY.md](SECURITY.md).
