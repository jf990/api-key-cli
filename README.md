# ArcGIS API key tool

Node.js CLI app to provide various helpers for working with ArcGIS API keys.

- Get a list of your API keys and OAuth apps.
- Get a report of your API key and OAuth app service usage.
- Get a list of your API keys that are about to expire.
- Revoke keys.
- Regenerate keys.
- Update the item meta data.
- Create new keys.
- Inspect a key or portal item to determine what attributes it has.

## Why

Working with API keys and developer credentials is typically done with either the [ArcGIS Location Platform dashboard](https://location.arcgis.com/dashboard/), the [ArcGIS Online home app](https://org.maps.arcgis.com/home/content.html#my), or with the [REST API](https://developers.arcgis.com/rest/). These options do not provide enough flexibility to manage access tokens in bulk and do not provide means to script and automate such as in CI/CD use cases. This tool is designed to help reduce the effort to manage ArcGIS access tokens for scripting and CI/CD use cases.

## Accounts

You need an ArcGIS account in order to use this tool. There are two possibilities:

* [ArcGIS Location Platform account](https://location.arcgis.com). You can [sign up for a free account](https://location.arcgis.com/sign-up/) if you do not have one.
* [ArcGIS Online account](https://www.esri.com/en-us/arcgis/products/user-types/overview) of type Creator (or high privilege level).

## Set up

[Node.js](https://nodejs.org) is required.

1. Run `npm install` to install the project dependencies.

2. Create or edit `.env` to set your ArcGIS account credentials. See `.env.sample` for a sample and [details below](#env-tokens). Edit this file with your information and save it as `.env`.

3. Run `npm start`. When passing command line arguments you need to separate them with `--`, so for example `npm start -- -a inspect -f json -t {my-access-token}`. 

## Command line arguments

* ✅ `-a genkeys`: generate new API keys using API key options template (see YAML file format below).
    `-n` numberOfKeys
    `-c` optionsFilePath to the API key options [YAML formatted file](#api-key-attributes), default is `./api-key-attributes.yaml`
    `-f` output format CSV|JSON|STDOUT
    `-o` output file path, if empty and not STDOUT then "api-keys"
* ✅ `-a inspect`: show properties for a single api key.
    `-t` token or an existing API key access token or user OAuth access token
    `-i` itemId and ArcGIS portal item identifier
    `-f` output format CSV|JSON|STDOUT
    `-o` output file path, if empty and not STDOUT then "api-keys"
* ✅ `-a report`: generate API keys report as CSV file.
    `-f` output format CSV|JSON|STDOUT
    `-o` output file path, if empty and not STDOUT then "api-keys"
* ✅ `-a expire`: generate API keys report ordered by expiration date.
    `-d` date or daysUntilExpiration, default is 30
    `-f` output format CSV|JSON|STDOUT
    `-o` output file path, if empty and not STDOUT then "api-keys-expiration"
* ✅ `-a revoke`: revoke a token on an existing api key.
    `-i` ArcGIS portal item identifier of the API key to revoke
    `-k` 1|2|all for which token to revoke, token 1, 2 or all tokens
* ✅ `-a regen`: generate new tokens for an existing api key.
    `-i` ArcGIS portal item identifier of the API key to update
    `-k` 1|2|all for which token to regenerate
    `-d` date or daysUntilExpiration key 1
    `-e` date or daysUntilExpiration key 2
* ✅ `-a update`: update an API key meta data such as title, description, tags, privileges, referrers, or redirect URIs.
    `-i` ArcGIS portal item identifier of the API key to update
    `-c` optionsFilePath to the API key options [YAML formatted file](#api-key-attributes), or use the following command line options (NOTE: not easy to do this on the CLI if using any special characters):
    `-t` title
    `-d` description
    `-k` tags comma separated string
    `-p` privileges comma separated string
    `-r` referrers comma separated string
    `-u` redirect URIs comma separated string
* ✅ `-a delete`: delete an existing api key.
    `-i` ArcGIS portal item identifier of the API key to delete
* ✅ `-a privchk`: check that a given API key has the required privileges assigned. Also verifies the subscription contains those requested privileges.
    `-t` token or an existing API key access token
    `-c` optionsFilePath to the API key options [YAML formatted file](#api-key-attributes), expect to find the `privileges` array. If not provided will look at `-p` (at least one of -p or -c is required).
    `-p` privileges list, a comma separated list of privileges. If not provided will look at `-c`.
* `-v` verbose output, will send extra information to STDOUT. Will mess up CSV or JSON output when not saving to a file.
* `--help` show help on CLI arguments.
* `--version` show version information.

## .env tokens

Certain parameters can be sent in via environment variables. These will override a command line parameter or default. Create or edit a `.env` file using the `.env.sample` for a sample.

- `ARCGIS_USER_NAME`: Set to the account user name of the account to use.
- `ARCGIS_USER_PASSWORD`: Password to account.
- `ARCGIS_TOKEN`: An ArcGIS access token or API key, this will override any `-t` CLI argument.
- `ARCGIS_ITEM_ID`: An ArcGIS portal item identifier, this will override any `-i` CLI argument.

## API key attributes

When using the `genkeys` or `update` actions, the `-c` CLI argument is a file path to the API key options YAML formatted file. This describes the meta data that defines your API key portal item. It uses the following format:

```yaml
options:
  title: "title" - string describing the title of the item.
  description: "description" - string providing the description of the item.
  tags: ["tag"] - array of strings, each string is a single tag.
  privileges: ["privilege"] - array of strings, each string is an ArcGIS privilege. See [Privileges](https://developers.arcgis.com/documentation/security-and-authentication/reference/privileges/location-platform/).
  httpReferrers: ["domain"] - array of strings, each string is a referring URL.
  redirect_uris: [] - array of string, each string is a redirect URI.
  generateToken1: true|false - optional boolean, true to generate access token 1. Then one of `apiToken1ExpirationDate` or `apiToken1ExpirationDays` is required.
  apiToken1ExpirationDate: "date" - string representing a date in the future when the generated access token will expire, e.g. "2026-12-31". Must be less than 1 year from today. Used only if `generateToken1` is true. If not provided, will look for `apiToken1ExpirationDays`. If neither is provided will default to 7 days from today.
  apiToken1ExpirationDays: 1 - integer number of days from today when the generated access token will expire. Must be less than 366. If not provided and `generateToken1` is true will look for `apiToken1ExpirationDate`. If neither is provided will default to 7 days from today.
  generateToken2: - same as `generateToken1` for access token 2.
  apiToken2ExpirationDate: - same as `apiToken1ExpirationDate` for access token 2.
  apiToken2ExpirationDays: - same as `apiToken1ExpirationDays` for access token 2.
```

### Exit codes

STDOUT and STDERR are honored for logged messages and errors, respectively. The tool returns an exit code that can be used to chain commands.

- 0: normal exit, operation completed without error (does not always mean it was successful, depending on the request).
- 90: service error, the request failed, additional details logged to STDERR.
- 98: authentication error, login failed, invalid access token.
- 99: invalid parameter. An argument you supplied could not be coerced to a valid parameter for the requested operation.

### Test cases

- `npm start -- -a inspect -o my_keys.csv -f csv -t YOUR_API_KEY`
- `npm start -- -a inspect -i YOUR_ITEM_ID`
- `npm start -- -a genkeys -n 5 -c api-key-attributes.yaml -o api-keys.json -f json`

### CLI

There are three ways to run this as a command line app. Note that in all cases you will need a `.env` file in your current directory if credentials are requrired (See `.env.sample` for the expected format).

1. Local project

When you have this project installed locally and you successfully completed `npm install`, then:

`npm link`

Then you can run the command as `api-key-cli`.

2. Global install

When you don't have this project installed locally, then:

`npm install -g api-key-cli`

Then you can run the command as `api-key-cli`.

3. npx

CLI tool and package runner

`npx api-key-cli ...`
