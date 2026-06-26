# Coral Island Save Editor

Browser-based save editor for Coral Island. Open a local save file, inspect decoded save paths, make supported edits, and export a downloaded copy that you can test in-game.

The app runs entirely in the browser. It does not upload save files, use a backend service, or write back into Steam save folders automatically.

## What It Can Edit

- World fields such as date and weather.
- Player fields such as name, money, gender, and body type.
- Existing primitive save values exposed through the Explorer when they can be edited without creating new save structures.
- Known enum wrapper values where the editor can preserve the expected save shape.

The Explorer is intentionally conservative. Objects, arrays, maps, raw wrappers, and missing deep structures are inspect-only unless there is a focused safe editor for them.

## Save Safety

Always keep a backup of your original save before testing an exported file. The editor performs parser inspection and round-trip validation before enabling export, but Coral Island saves are complex and game updates can change save formats.

No tool can guarantee that an edited save will remain internally consistent, accepted by the game, or free from gameplay side effects. Use exported saves at your own risk.

## Local Use

1. Open the editor in your browser.
2. Choose or drop a local Coral Island save file.
3. Review the decoded save data and edit supported fields.
4. Export a new save file as a browser download.
5. Keep your original save until you have confirmed the exported copy works in-game.

On Windows, Steam save files are commonly stored under:

```text
%LOCALAPPDATA%\ProjectCoral\Saved\SaveGames
```

## Development

Install dependencies:

```bash
npm ci
```

Build the Rust/WASM save parser:

```bash
npm run build-save-parser
```

Run the editor locally:

```bash
npx nx serve editor
```

Useful verification commands:

```bash
npm run test-editor-explorer
npm run test-save-parser
npm run build-save-parser
npx nx run editor:build --skip-nx-cache
```

Build the static GitHub Pages artifact:

```bash
npm run build-editor-pages
```

See [GitHub Pages Deployment](docs/github-pages-deployment.md) for deployment details.

## Fork And AI Disclosure

This repository is a fork of the original [na-ji/coral-save-editor](https://github.com/na-ji/coral-save-editor) project. This fork includes additional parser safety work, editor reliability fixes, UI updates, Explorer functionality, and deployment tooling.

AI-assisted development tools were used to help inspect the codebase, draft changes, improve documentation, and evolve this fork from the original project. Changes were reviewed, tested, and committed through the normal development workflow.

## Fixture Saves

Local save fixtures may be copied into `fixtures/saves` for parser testing, but actual save files in that directory are ignored by git and should not be committed.
