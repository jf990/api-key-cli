---
name: api-key-cli
description: "Use this skill when your application or CI/CD workflow needs an ArcGIS API key, or when you want to inquire about the properties of an existing API key."
---

# ArcGIS API Key CLI Developer Skill

## Purpose

This repository is the source code fora Node.js ESM CLI for inspecting and managing ArcGIS API keys and related developer credential items. It provides a command-line interface for creating, updating, inspecting, and managing ArcGIS API keys and their associated properties. It also provides a JavaScript ESM module for programmatic access to the same functionality. It follows best practices for handling API keys as described in the documentation at [How to use an API key](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/how-to-use-an-api-key/).

Use this skill when you need to:

- implement ArcGIS API Key management creating, updating, inspecting, and managing API keys.
- work on API key inspection, reporting, expiration, privilege, referrer, or account properties.

Do not use this skill for:

- generic JavaScript or Node.js questions that do not depend on this repo.
- browser UI work.
- unrelated ArcGIS SDK usage outside this CLI.

## Read First

Read these files before making changes:

- `README.md` for supported actions, flags, examples, and YAML format
- `.env.sample` for required environment variables
- `api-key-attributes.yaml` for the options shape used by `genkeys` and `update`

## Repository Facts

- The project uses ESM with `"type": "module"`.
- Node 22+ should be assumed because the code relies on ESM and global `fetch`.
- Environment variables can intentionally override CLI args, especially `ARCGIS_TOKEN` and `ARCGIS_ITEM_ID`.

## Sensitive Data Rules

- Treat `.env` and `account-*.env` files as sensitive.
- Do not print, quote, or copy credentials, passwords, tokens, or API keys into chat output.
- Avoid commands that would echo secrets to the terminal.
- If a task touches authentication or credential flow, describe behavior without exposing values.

## CLI Actions

All CLI actions are listed in README.md

## Working Commands

- Install dependencies: `npm install`
- Run the CLI: `npm start`
- Pass action flags through npm: `npm start -- -a inspect -i <itemId>`
- Show help: `npm start -- --help`

## Exit Codes

- `0`: normal exit
- `90`: service error
- `98`: authentication error
- `99`: invalid parameter
