# AGENTS.md

## Project Scope

This repository is a Node.js ESM and CLI for inspecting and managing ArcGIS API keys and related developer credential items.

Read these first before making changes:

- [README.md](README.md) for supported actions, flags, and example commands when developing code within this repository.
- [.env.sample](.env.sample) for required environment variables when testing the CLI tools and options.
- [api-key-attributes.yaml](api-key-attributes.yaml) for the YAML shape used by `genkeys` and `update`.

## Working Commands

- Install dependencies: `npm install`
- Run the CLI: `npm start`
- Pass action flags through npm: `npm start -- -a inspect -i <itemId>`
- Direct entrypoint: `node ./source/index.js ...`

The test suite is run with `npm test`. It will test and validate the helper functions found in ./source/utils.js.

## Code Map

- [source/index.js](source/index.js) is the main CLI entrypoint and action dispatcher.
- [source/arcGISItemHelpers.js](source/arcGISItemHelpers.js) wraps ArcGIS portal item operations and developer credential item lookup.
- [source/usageReport.js](source/usageReport.js) handles usage-report creation and CSV download.
- [source/utils.js](source/utils.js) are helper functions that support the core API.

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

- Assume Node 22+ in practice because the code relies on ESM and global `fetch`.
- The repository may contain local credential files at the root. Treat all `.env` and `account-*.env` files as sensitive.
- Report generation has a documented ArcGIS-side failure mode in [README.md](README.md).
