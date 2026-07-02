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
 *
 * Requires a logged in ArcGIS user. Update .env with your credentials and make
 * sure to keep that file secure.
 */
import path from "path";
import { createApiKey, updateApiKey, invalidateApiKey, getApiKey } from '@esri/arcgis-rest-developer-credentials';
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { createServiceUsageReport } from "./usageReport.js";
import { 
    ArcGISPrivileges,
    getAuthenticationItems,
    getAPIKeyItems,
    getUserAuthenticationItems,
    getUserAPIKeyItems,
    updatePortalItem,
    getPortalItem,
    deletePortalItem
} from "./arcGISItemHelpers.js";
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
    geocodeAddress
} from "./utils.js";
import fsExtra from "fs-extra";
import YAML from "yaml";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { fileURLToPath } from "url";
let showVerbose = false;

/**
 * Pick up command line arguments and invoke the requested tasks. See the README for details on command line arguments.
 */
async function performRequestAction() {
    dotenv.config();
    const args = getCommandLineParameters();
    const action = args.a ?? "help";
    let outputFile;
    let outputFileFormat;
    showVerbose = args.v ?? false;
    setVerbose(showVerbose);

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
            process.exit(99);
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
        outputFileFormat = args.f ?? "json";
        outputFile = args.o ?? "stdout";
        if (token != "") {
            inspectAPIKeyToken(token, outputFile, outputFileFormat.toLowerCase());
        } else {
            const itemID = getItemIDParameter(args);
            if (itemID != "") {
                inspectAPIKeyItem(itemID, outputFile, outputFileFormat.toLowerCase());
            } else {
                log("Inspect requires either a token (-t) or item id (-i) parameter.", "error");
                process.exit(99);
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
        process.exit(0);
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
        log(`.    : -v`, "warn");
        log(`.    : -h`, "warn");
        process.exit(0);
        break;
      default:
        log(`Unknown action ${action}. Action is required. Valid actions are genkeys, report, inspect, update, delete, revoke. Try -h for help.`, "error");
        process.exit(99);
        break;
    }
}

/**
 * Normalize the handing of the output desitination and format so that we can easily output to the console (STDOUT)
 * or to a file in either JSON or CSV format.
 * @param {object|Array} results Data to save to output destination.
 * @param {string} outputFile Output file name. Ignored if format is stdout.
 * @param {string} outputFileFormat Supported output formats are json|csv|stdout, the default is csv.
 */
function outputResults(results, outputFile, outputFileFormat) {
    let outputFormat = outputFileFormat.toLowerCase();
    if (["json", "csv", "stdout"].indexOf(outputFormat) < 0) {
        outputFormat = "csv";
    }
    if (outputFormat === "json") {
        if (path.extname(outputFile).toLowerCase() === "") {
            outputFile += ".json";
        }
        saveJSONFile(results, outputFile);
    } else if (outputFormat === "csv") {
        if (path.extname(outputFile).toLowerCase() === "") {
            outputFile += ".csv";
        }
        saveCSVFile(results, outputFile);
    } else {
        log(JSON.stringify(results, null, 2), "data");
    }
}

/**
 * Read the options YAML file and validate and copy options into the options
 * template used to create or update API keys.
 * @param {string} filePath Path to a YAML file with API key option attributes.
 * @return {object|null} an object created from the YAML data, or null if error.
 */
function loadOptions(filePath) {
    let optionsFile;
    try {
        optionsFile = fsExtra.readFileSync(filePath, "utf8");
    } catch (exception) {
        log(`Error reading options file ${filePath}: ${exception.message}`, "error");
    }
    try {
        const options = YAML.parse(optionsFile);
        if (options) {
            const apiKeyOptions = {
                title: "",
                description: "",
                tags: [],
                privileges: [],
                httpReferrers: [],
                redirect_uris: [],
                generateToken1: false,
                apiToken1ExpirationDate: "",
                apiToken1ExpirationDays: 0,
                generateToken2: false,
                apiToken2ExpirationDate: "",
                apiToken2ExpirationDays: 0,
                authentication: null,
            };
            let localOptions = options.options ?? options;
            apiKeyOptions.title = localOptions.title ?? "No title";
            apiKeyOptions.description = localOptions.description ?? "No description provided.";
            apiKeyOptions.tags = localOptions.tags ?? [];
            apiKeyOptions.privileges = localOptions.privileges ?? [];
            apiKeyOptions.httpReferrers = localOptions.referrers ?? [];
            apiKeyOptions.redirect_uris = localOptions.redirect_uris ?? [];
            apiKeyOptions.generateToken1 = localOptions.generateToken1 ?? true;
            apiKeyOptions.apiToken1ExpirationDate = dateFromOptions(localOptions.apiToken1ExpirationDate ?? "", localOptions.apiToken1ExpirationDays ?? 0);
            apiKeyOptions.generateToken2 = localOptions.generateToken2 ?? false;
            apiKeyOptions.apiToken2ExpirationDate = dateFromOptions(localOptions.apiToken2ExpirationDate ?? "", localOptions.apiToken2ExpirationDays ?? 0);
            return apiKeyOptions;
        } else {
            log(`Invalid or missing API key options in ${filePath}.`, "error");
        }
    } catch (exception) {
        log(`Error parsing options file YAML: ${exception.message}`, "error");
    }
    return null;
}

/**
 * Log in a user with the credentials set in the credentials store.
 * @returns {Promise} A Promise that will resolve with an ArcGISIdentityManager object for the logged in user.
 */
function signIn() {
    if (process.env.ARCGIS_USER_NAME && process.env.ARCGIS_USER_PASSWORD) {
        return ArcGISIdentityManager.signIn({
            username: process.env.ARCGIS_USER_NAME,
            password: process.env.ARCGIS_USER_PASSWORD
        })
        .then(function(identityManager) {
            return identityManager;
        })
        .catch(function(exception) {
            throw exception;
        });
    } else {
        throw new Error("Missing credentials. Update .env with your ArcGIS credentials.");
    }
}

/**
 * Generate a usage report for the logged in user.
 * @param {ArcGISIdentityManager} authentication The authentication object of the logged in user.
 * @returns {Promise} Resolves when the report is created and an item id is assigned.
 */
 function createUsageReport(authentication) {
    const reportOptions = {
        subType: "serviceUsages",
        timeDuration: "monthly",
        timeOffset: 1,
        title: "Usage-last-month"
    };
    return createServiceUsageReport(reportOptions, authentication);
}

/**
 * Generate a usage report of all developer credentials for the logged in user.
 * @param {string} outputFile Path to save the report CSV file.
 * @param {string} outputFileFormat Format of the output file (e.g., "csv" or "json").
 */
async function usageReport(outputFile, outputFileFormat) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getUserAuthenticationItems(authentication)
                .then(function(items) {
                    log(`${process.env.ARCGIS_USER_NAME} has ${items.length} developer credentials:`, "info");
                    const reducedItems = [];
                    items.forEach(function(item) {
                        reducedItems.push({
                            itemId: item.id,
                            title: item.title,
                            type: normalizeItemType(item.type, item.typeKeywords),
                            created: localDateFormat(item.created),
                            modified: localDateFormat(item.modified),
                            apiToken1ExpirationDate: localDateFormat(item.apiToken1ExpirationDate),
                            apiToken2ExpirationDate: localDateFormat(item.apiToken2ExpirationDate)
                        });
                    });
                    outputResults(reducedItems, outputFile, outputFileFormat);
                    createUsageReport(authentication)
                    .then(function() {
                        log("done.", "success");
                        process.exit(0);
                    })
                    .catch(function(exception) {
                        log("Report generation failed: " + exception.toString(), "error");
                        process.exit(90);
                    });
                });
            } else {
                log("Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("Login error: " + loginError.toString(), "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * Generate a expiration report of all API keys that will expire within a certain number of days, sorted by expiration date.
 * @param {integer|string} expireDate Number of days until expiration, or specific date, to use as a cutoff for the report. For example, if 30 is passed, the report will include all API keys that have an expiration date within the next 30 days.
 * @param {string} outputFile Path to save the report CSV file.
 * @param {string} outputFileFormat Format of the output file (e.g., "csv" or "json").
 */
async function expirationReport(expireDate, outputFile, outputFileFormat) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getUserAPIKeyItems(authentication)
                .then(function(items) {
                    log(`${process.env.ARCGIS_USER_NAME} has ${items.length} developer credentials:`, "info");
                    if (isNumeric(expireDate)) {
                        if (expireDate < 366) {
                            // convert number of days to a date
                            expireDate = getRelativeExpireDate(expireDate);
                        }
                    } else {
                        expireDate = new Date(expireDate).getTime();
                    }
                    const reducedItems = [];
                    items.forEach(function(item) {
                        const itemType = normalizeItemType(item.type, item.typeKeywords);
                        if (itemType.toLowerCase().startsWith("api key")) {
                            let sortDate = item.apiToken1ExpirationDate > item.apiToken2ExpirationDate ? item.apiToken1ExpirationDate : item.apiToken2ExpirationDate;
                            if (sortDate > 1 && sortDate < expireDate) {
                                const dateDiff = Math.abs(sortDate - Date.now()); 
                                const days = Math.floor(dateDiff / 86400000);
                                const expireMessage = sortDate > Date.now() ? localDateFormat(sortDate) + " (in " + days + " days)" : "EXPIRED";
                                reducedItems.push({
                                    itemId: item.id,
                                    title: item.title,
                                    type: itemType,
                                    expires: expireMessage,
                                    created: localDateFormat(item.created),
                                    modified: localDateFormat(item.modified),
                                    sortDate: sortDate,
                                    apiToken1ExpirationDate: localDateFormat(item.apiToken1ExpirationDate),
                                    apiToken2ExpirationDate: localDateFormat(item.apiToken2ExpirationDate)
                                });
                            }
                            reducedItems.sort(function(a, b) {
                                return a.sortDate - b.sortDate;
                            });
                        }
                    });
                    outputResults(reducedItems, outputFile, outputFileFormat);
                    process.exit(0);
                });
            } else {
                log("Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("Login error: " + loginError.toString(), "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * Create API key(s) given object of apiKeyOptions and numberOfKeys.
 * @param {object} apiKeyOptions API attributes.
 * @param {integer} numberOfKeys Number of keys to create.
 * @param {string} outputFile Path to save the report CSV file.
 * @param {string} outputFileFormat Format of the output file (e.g., "csv" or "json").
 */
async function createNewAPIKeys(apiKeyOptions, numberOfKeys, outputFile, outputFileFormat) {
    if (numberOfKeys < 1) {
        numberOfKeys = 1;
    }
    try {
        signIn()
        .then(async function(authentication) {
            if (authentication && authentication.username) {
                const newKeys = [];
                apiKeyOptions.authentication = authentication;
                const title = apiKeyOptions.title;
                for (let i = 1; i <= numberOfKeys; i ++) {
                    apiKeyOptions.title = title + (numberOfKeys > 1 ? ` - (${i})` : "");
                    createApiKey(apiKeyOptions)
                    .then(function(registeredAPIKey) {
                        const itemId = registeredAPIKey.itemId;
                        const accessToken = registeredAPIKey.accessToken1;
                        const expireTime = registeredAPIKey.item.apiToken1ExpirationDate;
                        log(`New API key ${itemId} expires ${expireTime} token ${accessToken}`, "info");
                        newKeys.push({
                            itemID: itemId,
                            title: registeredAPIKey.item.title,
                            expires: expireTime,
                            token: accessToken,
                            privileges: apiKeyOptions.privileges
                        });
                        if (newKeys.length >= numberOfKeys) {
                            outputResults(newKeys, outputFile, outputFileFormat);
                            process.exit(0);
                        }
                    }).catch(function(error) {
                        log(`createAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                        process.exit(90);
                    });
                    if (i > 1) {
                        await sleeper(1000);
                    }
                }
            } else {
                log("createAPIKey Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("createAPIKey Login error: " + loginError.toString() + " Check your credentials.", "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("createAPIKey Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * Update an existing API key. @todo: untested!
 * Command line options
 * -i: item ID (required)
 * -t: title
 * -d: description
 * -k: tags, comma separated string, e.g. "tag1,tag2"
 * -p: privileges to add, comma separated string, e.g. "basemaps,places"
 * -r: referrers to add, comma separated string, e.g. "https://myapp.com/*"
 * -u: redirect URIs to add, comma separated string, e.g. "https://myapp.com/callback"
 * @param {object} args Command line arguments.
 */
async function updateAPIKeyProperties(args) {
    // based on the command line options determine if the item needs to be updated, or if the API key properties need to be updated,
    // as they are two different API calls.
    let hasAPIKeyUpdateOptions = false;
    let hasItemUpdateOptions = false;
    const itemId = getItemIDParameter(args);
    if (isEmpty(itemId)) {
        log("updateAPIKey error: item ID is required.", "error");
        process.exit(99);
    }
    let apiKeyOptions = {
        itemId: itemId,
        generateToken1: false,
        generateToken2: false,
        authentication: null,
    };
    const privileges = args.p ?? null;
    if (privileges !== null) {
        apiKeyOptions.privileges = privileges.split(",").map(function(element) { return element.trim(); });
        hasAPIKeyUpdateOptions = true;
        if (apiKeyOptions.privileges.length === 1 && apiKeyOptions.privileges[0] === "") {
            apiKeyOptions.privileges = [];
        }
    }
    const referrers = args.r ?? null;
    if (referrers !== null) {
        apiKeyOptions.httpReferrers = referrers.split(",").map(function(element) { return element.trim(); });
        hasAPIKeyUpdateOptions = true;
        if (apiKeyOptions.httpReferrers.length === 1 && apiKeyOptions.httpReferrers[0] === "") {
            apiKeyOptions.httpReferrers = [];
        }
    }
    const redirectURIs = args.u ?? null;
    if (redirectURIs !== null) {
        apiKeyOptions.redirectURIs = redirectURIs.split(",").map(function(element) { return element.trim(); });
        hasAPIKeyUpdateOptions = true;
        if (apiKeyOptions.redirectURIs.length === 1 && apiKeyOptions.redirectURIs[0] === "") {
            apiKeyOptions.redirectURIs = [];
        }
    }
    let itemUpdateOptions = {};
    const title = args.t ?? "";
    if (!isEmpty(title)) {
        itemUpdateOptions.title = title;
        hasItemUpdateOptions = true;
    }
    const description = args.d ?? "";
    if (!isEmpty(description)) {
        itemUpdateOptions.description = description;
        hasItemUpdateOptions = true;
    }
    const tags = args.k ?? "";
    if (!isEmpty(tags)) {
        itemUpdateOptions.tags = tags.split(",").map(function(tag) { return tag.trim(); });
        hasItemUpdateOptions = true;
    }
    try {
        signIn()
        .then(async function(authentication) {
            if (authentication && authentication.username) {
                const updateTasks = [];
                if (hasAPIKeyUpdateOptions) {
                    apiKeyOptions.authentication = authentication;
                    log(`updateAPIKey with options ${JSON.stringify(apiKeyOptions)}`, "info");
                    updateTasks.push(
                        updateApiKey(apiKeyOptions)
                        .then(function(registeredAPIKey) {
                            log(`updateAPIKey updated item ${itemId} with response ${JSON.stringify(registeredAPIKey)}`, "success");
                        })
                    );
                }
                if (hasItemUpdateOptions) {
                    // update the item title, description, or tags
                    itemUpdateOptions.id = itemId;
                    updateTasks.push(
                        updatePortalItem(itemId, itemUpdateOptions, authentication)
                        .then(function(updatedItem) {
                            log(`Updated item ${itemId} with response ${JSON.stringify(updatedItem)}`, "success");
                        })
                    );
                }

                const updateResults = await Promise.allSettled(updateTasks);
                const failedUpdates = updateResults.filter(function(result) {
                    return result.status === "rejected";
                });

                // Determine if any of the updates failed and log the errors and exit code.
                if (failedUpdates.length > 0) {
                    failedUpdates.forEach(function(result) {
                        const error = result.reason ?? {};
                        log(`update error ${error.code}: ${error.originalMessage ?? error.message} ${JSON.stringify(error.response)}`, "error");
                    });
                    process.exit(90);
                }
                // no failures, log success and exit.
                process.exit(0);
            } else {
                log("updateAPIKey Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("updateAPIKey Login error: " + loginError.toString() + " Check your credentials.", "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("updateAPIKey Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * Delete an API key given its item identifier. This will delete the item and revoke any tokens generated from that item.
 * @todo: untested!
 * @param {string} itemID ArcGIS item identifier of the API key to delete.
 */
 async function deleteItem(itemID) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                deletePortalItem(itemID, authentication)
                .then(function(serverResponse) {
                    log(`deleteItem says ` + JSON.stringify(serverResponse), "success");
                    process.exit(0);
                })
                .catch(function(error) {
                    log("deleteItem error: " + error.toString(), "error");
                    process.exit(90);
                })
            } else {
                log("deleteItem Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("deleteItem Login error: " + loginError.toString(), "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("deleteItem Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * Inspect an API key, given its access token, to determine its properties. This can be used to check the owner,
 * privileges, and expiration date of an API key.
 * @param {string} token ArcGIS access token (API key or OAuth user token).
 * @param {string} outFile Optional. If provided, will save the output to a file instead of logging to the console. Default is "stdout".
 * @param {string} format Optional. If outputting to a file, can specify the format as "json" or "csv". Default is "json".
 */
async function inspectAPIKeyToken(token, outFile = "stdout", format = "json") {
    const serviceURL = "https://www.arcgis.com/sharing/rest/portals/self?f=json&token=";

    if (token !== "") {
        try {
            const response = await fetch(`${serviceURL}${encodeURIComponent(token)}`, {
                method: "GET",
                headers: {
                    Accept: "application/json"
                }
            });
            if (!response.ok) {
                log(`Request failed with status ${response.status} ${response.statusText}`, "error");
                process.exit(90);
            }
            const jsonResponse = await response.json();
            if (jsonResponse.error) {
                // { error: { code: 498, message: 'Invalid token.', details: [] } }
                log(`Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`, "error");
                process.exit(90);
            } else {
                const reducedResponse = {
                    owner: jsonResponse.name,
                    subscriptionId: jsonResponse.subscriptionInfo.id,
                    subscriptionType: jsonResponse.subscriptionInfo.type,
                    appId: jsonResponse.appInfo.appId,
                    appTitle: jsonResponse.appInfo.appTitle,
                    itemId: jsonResponse.appInfo.itemId,
                    expirationDate: jsonResponse.appInfo.expirationDate,
                    privileges: jsonResponse.appInfo.privileges
                };
                if (format === "json") {
                    saveJSONFile(reducedResponse, outFile);
                } else if (format === "csv") {
                    saveCSVFile(reducedResponse, outFile);
                } else {
                    log(JSON.stringify(reducedResponse, null, 2), "data");
                }
                process.exit(0);
            }
        } catch (exception) {
            log(`inspectAPIKey request failed: ${exception.message}`, "error");
            process.exit(90);
        }
    } else {
        log("inspectAPIKey requires a non-empty token.", "error");
        process.exit(99);
    }
}

/**
 * Inspect an API key, given its ArcGIS item identifier, to determine its properties. This can be used
 * to check the owner, privileges, and expiration date of an API key.
 * @param {string} itemID ArcGIS item identifier.
 * @param {string} outFile Optional. If provided, will save the output to a file instead of logging to the console. Default is "stdout".
 * @param {string} format Optional. If outputting to a file, can specify the format as "json" or "csv". Default is "json".
 */
async function inspectAPIKeyItem(itemID, outFile = "stdout", format = "json") {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getApiKey({
                    itemId: itemID,
                    authentication: authentication
                })
                .then(function(apiKeyResponse) {
                    const apiKeyInfo = {
                        itemId: apiKeyResponse.itemId,
                        clientId: apiKeyResponse.clientId,
                        title: apiKeyResponse.item.title,
                        description: apiKeyResponse.item.description,
                        owner: apiKeyResponse.item.owner,
                        created: apiKeyResponse.item.created > 0 ? localDateFormat(apiKeyResponse.item.created) : "",
                        tags: apiKeyResponse.item.tags,
                        privileges: apiKeyResponse.privileges,
                        referrers: apiKeyResponse.httpReferrers,
                        redirectURIs: apiKeyResponse.redirectURIs,
                        apiToken1Active: apiKeyResponse.apiToken1Active,
                        apiToken1ExpirationDate: apiKeyResponse.item.apiToken1ExpirationDate > 0 ? localDateFormat(apiKeyResponse.item.apiToken1ExpirationDate) : "",
                        apiToken2Active: apiKeyResponse.apiToken2Active,
                        apiToken2ExpirationDate: apiKeyResponse.item.apiToken2ExpirationDate > 0 ? localDateFormat(apiKeyResponse.item.apiToken2ExpirationDate) : "",
                        isPersonalAPIToken: apiKeyResponse.isPersonalAPIToken,
                    };
                    if (format === "json") {
                        saveJSONFile(apiKeyInfo, outFile);
                    } else if (format === "csv") {
                        saveCSVFile(apiKeyInfo, outFile);
                    } else {
                        log(JSON.stringify(apiKeyInfo, null, 2), "data");
                    }
                    process.exit(0);
                })
                .catch(function(error) {
                    log(`getApiKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                    process.exit(90);
                });
            } else {
                log("inspectAPIKeyItem Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("inspectAPIKeyItem Login error: " + loginError.toString(), "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("inspectAPIKeyItem Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * Revoke API key access tokens. Pass -i itemId for which API key item, and pass -k 1, 2, or all for which token to revoke.
 * @param {object} args CLI arguments. We are looking for -i and -k.
 */
async function revokeAPIKey(args) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                const itemId = getItemIDParameter(args);
                const whichToken = args.k ?? "all";
                if (whichToken == "1" || whichToken == "all") {
                    invalidateApiKey({
                        itemId: itemId,
                        apiKey: 1,
                        authentication: authentication
                    })
                    .then(function(apiKeyResponse) {
                        if (apiKeyResponse.success) {
                            log(`Token 1 revoked for item ${itemId}.`, "success");
                            process.exit(0);
                        } else {
                            log(`Failed to revoke token 1 for item ${itemId}. Response: ${JSON.stringify(apiKeyResponse)}`, "error");
                            process.exit(90);
                        }
                    })
                    .catch(function(error) {
                        log(`revokeAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                        process.exit(90);
                    });
                }
                if (whichToken == "2" || whichToken == "all") {
                    invalidateApiKey({
                        itemId: itemId,
                        apiKey: 2,
                        authentication: authentication
                    })
                    .then(function(apiKeyResponse) {
                        if (apiKeyResponse.success) {
                            log(`Token 2 revoked for item ${itemId}.`, "success");
                            process.exit(0);
                        } else {
                            log(`Failed to revoke token 2 for item ${itemId}. Response: ${JSON.stringify(apiKeyResponse)}`, "error");
                            process.exit(90);
                        }
                    })
                    .catch(function(error) {
                        log(`revokeAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                        process.exit(90);
                    });
                }
            } else {
                log("revokeAPIKey Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("revokeAPIKey Login error: " + loginError.toString(), "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("revokeAPIKey Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
}

/**
 * generate new tokens for api key 1, 2 or both, given the item ID.
 * command line options: -i itemID of the API key to update, -k 1/2/* for which token to regenerate, -d date or daysUntilExpiration for token 1, -e date or daysUntilExpiration for token 2.
 * @param {object} args Command line arguments.
 */
async function regenerateAPIKey(args) {
    try {
        signIn()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                const itemId = getItemIDParameter(args);
                const whichToken = args.k ?? "all";
                const token1Expiration = args.d ?? "";
                const token2Expiration = args.e ?? "";
                let updateOptions = {
                    itemId: itemId,
                    authentication: authentication
                }
                if (whichToken == "1" || whichToken == "all") {
                    updateOptions.generateToken1 = true;
                    updateOptions.apiToken1ExpirationDate = dateFromOptions( ! isNumeric(token1Expiration) ? token1Expiration : "", isNumeric(token1Expiration) ? parseInt(token1Expiration) : 7);
                }
                if (whichToken == "2" || whichToken == "all") {
                    updateOptions.generateToken2 = true;
                    updateOptions.apiToken2ExpirationDate = dateFromOptions( ! isNumeric(token2Expiration) ? token2Expiration : "", isNumeric(token2Expiration) ? parseInt(token2Expiration) : 7);
                }
                updateApiKey(updateOptions)
                .then(function(registeredAPIKey) {
                    const apiKeyResponse = {};
                    if (whichToken == "1" || whichToken == "all") {
                        apiKeyResponse.token1 = {
                            accessToken: registeredAPIKey.accessToken1,
                            expires: localDateFormat(registeredAPIKey.item.apiToken1ExpirationDate)
                        };
                    }
                    if (whichToken == "2" || whichToken == "all") {
                        apiKeyResponse.token2 = {
                            accessToken: registeredAPIKey.accessToken2,
                            expires: localDateFormat(registeredAPIKey.item.apiToken2ExpirationDate)
                        };
                    }
                    log(`Regenerated API key tokens for item ${itemId}: ${JSON.stringify(apiKeyResponse)}`, "success");
                    process.exit(0);
                }).catch(function(error) {
                    log(`regenerateAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                    process.exit(90);
                });
            } else {
                log("revokeAPIKey Login error: invalid login.", "error");
                process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("revokeAPIKey Login error: " + loginError.toString(), "error");
            process.exit(98);
        });
    } catch (loginError) {
        log("revokeAPIKey Login error: " + loginError.toString(), "error");
        process.exit(98);
    }
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
