# AGENTS.md

## Project Scope

This repository is a Node.js ESM and CLI for inspecting and managing ArcGIS API keys and related developer credential items.

Read these first before making changes:

- [README.md](README.md) for supported actions, flags, and example commands when developing code within this repository.
- [.env.sample](.env.sample) for required environment variables when testing the CLI tools and options.
- [api-key-attributes.yaml](api-key-attributes.yaml) for the YAML shape used by `genkeys` and `update`.

## Working Commands

- Install dependencies: `npm install`
- Run the CLI: `npm start` or `npx api-key-cli`
- Pass action flags through npm: `npm start -- -a inspect -i <itemId>`

## Known Pitfalls

- Assume Node 22+ in practice because the code relies on ESM and global `fetch`.
- The repository may contain local credential files at the root. Treat all `.env` and `account-*.env` files as sensitive.
- Report generation has a documented ArcGIS-side failure mode in [README.md](README.md).
