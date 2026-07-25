---
name: api-key-cli
description: "Use when working on this repository's ArcGIS API key CLI: implementing or debugging actions, tracing CLI flags, updating YAML-driven key creation, reviewing credential-handling logic, or validating changes with safe non-destructive commands. Do not use for general Node.js questions unrelated to this repo."
---

# API Key CLI Skill

## Purpose

This repository is a Node.js ESM CLI for inspecting and managing ArcGIS API keys and related developer credential items.

Use this skill when you need to:

- debug or extend a CLI action in `source/index.js`
- trace how short flags map into runtime behavior
- work on API key inspection, reporting, expiration, privilege, referrer, or geocode behavior
- update YAML-driven API key creation or update flows
- validate changes with targeted CLI commands while avoiding unsafe mutations

Do not use this skill for:

- generic JavaScript or Node.js questions that do not depend on this repo
- browser UI work
- unrelated ArcGIS SDK usage outside this CLI

## Read First

Read these files before making changes:

- `README.md` for supported actions, flags, examples, and YAML format
- `.env.sample` for required environment variables
- `api-key-attributes.yaml` for the options shape used by `genkeys` and `update`
- `source/index.js` for the action dispatcher and argument defaults

## Repository Facts

- The project uses ESM with `"type": "module"`.
- Node 18+ should be assumed because the code relies on ESM and global `fetch`.
- The CLI entrypoint is `source/index.js`.
- The codebase mixes `async` functions with `.then(...).catch(...)`; preserve the local style unless the task requires a targeted refactor.
- Environment variables can intentionally override CLI args, especially `ARCGIS_TOKEN` and `ARCGIS_ITEM_ID`.

## Sensitive Data Rules

- Treat `.env` and `account-*.env` files as sensitive.
- Do not print, quote, or copy credentials, passwords, tokens, or API keys into chat output.
- Avoid commands that would echo secrets to the terminal.
- If a task touches authentication or credential flow, describe behavior without exposing values.

## Code Map

- `source/index.js`: main CLI entrypoint, argument parsing, action dispatch, YAML option loading
- `source/apiKeyOperations.js`: action implementations such as inspect, update, revoke, regenerate, reports, and checks
- `source/arcGISItemHelpers.js`: ArcGIS portal item and authentication helper logic
- `source/usageReport.js`: usage report creation and CSV download
- `source/utils.js`: shared helpers for args, output, dates, geocoding, and formatting
- `test/index.helpers.test.js`: existing Jest coverage for utility helpers

## CLI Actions

Current action surface implemented by `source/index.js`:

- `-a genkeys`: create API keys from YAML options
- `-a report`: generate usage report output
- `-a expire`: report credentials ordered by expiration date
- `-a inspect`: inspect by token or item id
- `-a update`: update API key metadata or properties
- `-a delete`: delete an API key item
- `-a revoke`: revoke one or more tokens on an API key
- `-a regen`: regenerate one or more tokens on an API key
- `-a geocode`: geocode a single-line address using ArcGIS services
- `-a privchk`: verify expected privileges
- `-a refchk`: verify an allowed referrer

Preserve the current short-flag CLI contract. Flags such as `-a`, `-i`, `-t`, `-k`, `-p`, `-r`, `-u`, `-f`, `-o`, and `-c` are part of the public interface.

## Working Commands

- Install dependencies: `npm install`
- Run the CLI: `npm start`
- Pass action flags through npm: `npm start -- -a inspect -i <itemId>`
- Direct entrypoint: `node ./source/index.js ...`
- Show help: `npm start -- --help`

## Validation Strategy

- Prefer targeted CLI invocations over broad validation.
- Prefer non-mutating actions for validation, such as `inspect`, `privchk`, `refchk`, or `geocode` when safe credentials are already configured.
- Use Jest only for utility-level tests and existing unit coverage.
- Do not treat `npm test` as sufficient validation for runtime CLI behavior.

Recommended validation order:

1. Run the narrowest affected unit test if the change is isolated to helper logic.
2. Run a targeted non-destructive CLI command for the touched action.
3. Fall back to static review only if live validation is impossible without secrets or remote mutation.

## Mutation Risk

These actions can change remote state and should not be run casually:

- `genkeys`
- `update`
- `delete`
- `revoke`
- `regen`

Prefer read-only validation first. If mutation is required, use the smallest safe target and state the risk clearly.

## Implementation Notes

- `loadOptions(...)` in `source/index.js` normalizes YAML input for create and update flows.
- Output format handling lives in `source/utils.js` and supports `json`, `csv`, and `stdout`.
- Helper logic around env-var precedence, date coercion, and token appending is covered in `test/index.helpers.test.js`.
- Report generation has a documented ArcGIS-side failure mode described in `README.md`.

## Exit Codes

- `0`: normal exit
- `90`: service error
- `98`: authentication error
- `99`: invalid parameter

## Useful Starting Points

- If a task is about command routing or missing flags, start in `source/index.js`.
- If a task is about API key item behavior, start in `source/apiKeyOperations.js`.
- If a task is about data formatting, env precedence, date handling, or URL manipulation, start in `source/utils.js`.
- If a task is about the YAML options contract, compare `api-key-attributes.yaml`, `README.md`, and `loadOptions(...)` in `source/index.js`.
