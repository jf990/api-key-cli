# AGENTS.md

## Project Scope

This repository is a Node.js ESM CLI for inspecting and managing ArcGIS API keys and related developer credential items.

Read these first before making changes:

- [README.md](README.md) for supported actions, flags, and example commands.
- [.env.sample](.env.sample) for required environment variables.
- [api-key-attributes.yaml](api-key-attributes.yaml) for the YAML shape used by `genkeys` and `update`.

## Working Commands

- Install dependencies: `npm install`
- Run the CLI: `npm start`
- Pass action flags through npm: `npm start -- -a inspect -i <itemId>`
- Direct entrypoint: `node ./source/index.js ...`

There is no real automated test suite here. `npm test` is a placeholder and does not validate behavior.

## Code Map

- [source/index.js](source/index.js) is the main CLI entrypoint and action dispatcher.
- [source/arcGISItemHelpers.js](source/arcGISItemHelpers.js) wraps ArcGIS portal item operations and auth item lookup.
- [source/usageReport.js](source/usageReport.js) handles usage-report creation and CSV download.

## Repo Conventions

- Keep the code ESM-compatible. The project uses `"type": "module"`.
- Preserve the current CLI contract: short flags such as `-a`, `-i`, `-t`, `-k`, `-p`, `-r`, `-u` are used directly from `yargs(...).parse()`.
- Prefer small, local edits in the existing style. The code mixes `async` functions with `.then(...).catch(...)`; do not refactor broadly unless the task requires it.
- Use the existing `log(...)` helper in [source/index.js](source/index.js) for user-facing console output instead of adding ad hoc `console.log` calls.
- Environment variables can intentionally override CLI arguments, especially `ARCGIS_TOKEN` and `ARCGIS_ITEM_ID`.

## Validation Guidance

- Validate changes with a targeted CLI invocation when possible, not `npm test`.
- Prefer actions that do not mutate remote data unless the task specifically requires mutation.
- If a change touches credential handling, avoid printing secrets or copying values from local `.env` or `account-*.env` files.

## Known Pitfalls

- Assume Node 18+ in practice because the code relies on ESM and global `fetch`.
- The repository may contain local credential files at the root. Treat all `.env` and `account-*.env` files as sensitive.
- Report generation has a documented ArcGIS-side failure mode in [README.md](README.md).
