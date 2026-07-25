#!/usr/bin/env node
/**
 * ArcGIS API key helper CLI tool to help manage your ArcGIS Platform developer credentials
 * (API keys and OAuth apps) in a way friendly to CLI apps and CI/CD workflows.
 * - inspect API key tokens and Developer Credential portal items.
 * - check expire dates.
 * - update developer credential portal item meta data (title, summary, tags, privileges, referrers, redirect URIs.)
 * - delete developer credential portal items.
 * - revoke access tokens.
 * - regenerate access tokens.
 * - create new API keys.
 * - Generate usage reports of your ArcGIS Platform authentication (OAuth apps and API keys.)
 * - Check assigned privileges match expected privilege set.
 *
 * Requires a logged in ArcGIS user. Update .env with your credentials and make
 * sure to keep that file secure.
 */
import {
    setVerbose,
    log,
    getAccessTokenParameter,
    getItemIDParameter,
    dateFromOptions,
    localDateFormat,
    isEmpty,
    sleeper,
    isNumeric,
    saveJSONFile,
    saveCSVFile,
    getRelativeExpireDate,
    normalizeItemType,
    geocodeAddress,
    appendToken,
    loadOptions
} from "./utils.js";
import {
    usageReport,
    expirationReport,
    createNewAPIKeys,
    updateAPIKeyProperties,
    deleteItem,
    inspectAPIKeyToken,
    inspectAPIKeyItem,
    revokeAPIKey,
    regenerateAPIKey,
    checkPrivileges,
    checkReferrer

} from "./apiKeyOperations.js";

import fsExtra from "fs-extra";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * Pick up command line arguments and invoke the requested tasks. See the README for details on command line arguments.
 */
async function performRequestAction() {
    dotenv.config();
    const args = getCommandLineParameters();
    const action = args.a ?? "help";
    let outputFile;
    let outputFileFormat;
    setVerbose(args.v ?? false);

    switch(action) {
      case "genkeys":
        // create new API keys
        const numberOfKeys = args.n ?? 1;
        const optionsFile = args.c ?? "./api-key-attributes.yaml";
        const sessionApiKeyOptions = loadOptions(optionsFile);
        outputFileFormat = args.f ?? "csv";
        outputFile = args.o ?? "api-keys";
        if (sessionApiKeyOptions) {
            log(`generate ${numberOfKeys} keys with options ${optionsFile} that will expire on ${sessionApiKeyOptions.apiToken1ExpirationDate}`, "info");
            createNewAPIKeys(sessionApiKeyOptions, numberOfKeys, outputFile, outputFileFormat);
        } else {
            return process.exit(99);
        }
        break;
      case "report":
        // generate a report of all developer credentials
        outputFileFormat = args.f ?? "csv";
        outputFile = args.o ?? "./api-keys";
        usageReport(outputFile, outputFileFormat);
        break;
      case "expire":
        // generate a report of all developer credentials in order of expiration date.
        expirationReport(
            args.d ?? 30,
            args.o ?? "./api-keys-expiration",
            args.f ?? "csv"
        );
        break;
      case "inspect":
        // inspect properties of a single api key
        const token = getAccessTokenParameter(args);
        const referrer = args.r ?? "";
        outputFileFormat = args.f ?? "json";
        outputFile = args.o ?? "stdout";
        if (token != "") {
            log(`Inspecting API key token ${token} with referrer ${referrer} and saving results to ${outputFile} in ${outputFileFormat} format.`, "info");
            inspectAPIKeyToken(token, referrer, outputFile, outputFileFormat.toLowerCase());
        } else {
            const itemID = getItemIDParameter(args);
            if (itemID != "") {
                log(`Inspecting API key item ${itemID} and saving results to ${outputFile} in ${outputFileFormat} format.`, "info");
                inspectAPIKeyItem(itemID, outputFile, outputFileFormat.toLowerCase());
            } else {
                log("Inspect requires either a token (-t) or item id (-i) parameter.", "error");
                return process.exit(99);
            }
        }
        break;
      case "update":
        // update properties of a single api key
        updateAPIKeyProperties(args);
        break;
      case "delete":
        // delete an api key given its item ID
        deleteItem(getItemIDParameter(args));
        break;
      case "revoke":
        // revoke both tokens of a single api key
        revokeAPIKey(args);
        break;
      case "regen":
        // generate new tokens for api key 1, 2 or both, given the item ID.
        regenerateAPIKey(args);
        break;
      case "geocode":
        // geocode an address
        const a = await geocodeAddress(getAccessTokenParameter(args), args.s ?? "");
        log(`Geocode result: ${JSON.stringify(a)}`, "data");
        return process.exit(0);
        break;
      case "privchk":
        // check privileges of a single API key against the expected privilege set.
        checkPrivileges(args);
        break;
      case "refchk":
        // check if a specific referrer is allowed for a specific API key.
        checkReferrer(args);
        break;
      case "teams":
        // list all teams in random order
        const randomTeams = generateRandomList();
        log(`Randomized teams: \n\n${randomTeams.join("\n")}\n\n`, "data");
        break;
      case "help":
        const version = process.env.npm_package_version;
        log(`ArcGIS API key helper version ${version}\nUsage: api-key-helper -a [action] [options]`, "warn");
        log(`.    : -a inspect -i <item-id>`, "warn");
        log(`.    : -a inspect -t <token>`, "warn");
        log(`.    : -a expire -d <days|date> -o <output-file> -f <output-format>`, "warn");
        log(`.    : -a report -o <output-file> -f <output-format>`, "warn");
        log(`.    : -a update -i <item-id> -c <options-file>`, "warn");
        log(`.    : -a delete -i <item-id>`, "warn");
        log(`.    : -a revoke -i <item-id>`, "warn");
        log(`.    : -a regen -i <item-id> -t <token>`, "warn");
        log(`.    : -a genkeys -n <number-of-keys> -c <options-file> -o <output-file> -f <output-format>`, "warn");
        log(`.    : -a privchk -t <token> -p <privileges-list> -c <options-file>`, "warn");
        log(`.    : -a refchk -t <token> -r <referrer>`, "warn");
        log(`.    : -v`, "warn");
        log(`.    : -h`, "warn");
        return process.exit(0);
        break;
      default:
        log(`Unknown action ${action}. Action is required. Valid actions are genkeys, report, inspect, update, delete, revoke. Try -h for help.`, "error");
        return process.exit(99);
        break;
    }
}

function generateRandomList() {
    const teams = [
"1 Hackers Without (State) Borders",
"2 Voters in Ctrl",
"3 PinPals",
"4 Plate Shifters",
"5 Fire Seekers",
"6 No GIStakes (Just Mappy Accidents)",
"7 Raster Blaster",
"8 Koi PONDerers",
"9 Arcitects",
"10 Arc-xolotyl",
"11 Just Keep Rowi(a)n",
"12 SpareBytes",
"13 The Chameleons"
];
    const teamCount = teams.length;
    const randomList = [];
    for (let i = 0; i < teamCount; i++) {
        const randomTeam = teams[Math.floor(Math.random() * teams.length)];
        randomList.push(randomTeam);
        // Remove the selected team from the array to avoid duplicates
        teams.splice(teams.indexOf(randomTeam), 1);
    }
    return randomList;
}


/**
 * Read the command line to pick up any processing options.
 * @returns {Object} Options are returned as an object of key/value pairs.
 */
function getCommandLineParameters() {
    const args = yargs(hideBin(process.argv)).parse();
    return args;
}

performRequestAction();
