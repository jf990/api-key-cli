/**
 * Utility functions to work with API key items in an ArcGIS Organization.
 */
import { searchItems, SearchQueryBuilder, createItem, updateItem, getItem, removeItem, getSelf } from "@esri/arcgis-rest-portal";
import { createApiKey, updateApiKey, invalidateApiKey, getApiKey } from '@esri/arcgis-rest-developer-credentials';
import { request, ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import {
    setVerbose,
    log,
    getAccessTokenParameter,
    getItemIDParameter,
    dateFromOptions,
    localDateFormat,
    getRelativeExpireDate,
    isEmpty,
    sleeper,
    isNumeric,
    normalizeItemType,
    geocodeAddress,
    saveJSONFile,
    saveCSVFile,
    appendToken,
    outputResults,
    loadOptions
} from "./utils.js";
import {
    signInWithArcGIS,
    ArcGISPrivileges,
    getAuthenticationItems,
    getAPIKeyItems,
    getUserAuthenticationItems,
    getUserAPIKeyItems,
    getSubscriptionPrivileges,
    updatePortalItem,
    getPortalItem,
    deletePortalItem,
    getLocationServiceEndpointFromPrivilege
} from "./arcGISItemHelpers.js";
import { createServiceUsageReport } from "./usageReport.js";
const serviceURL = "https://www.arcgis.com/sharing/rest/portals/self?f=json&token=";

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
        signInWithArcGIS()
        .then(async function(authentication) {
            if (authentication && authentication.username) {
                getUserAuthenticationItems(authentication)
                .then(async function(items) {
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
                    await outputResults(reducedItems, outputFile, outputFileFormat);
                    createUsageReport(authentication)
                    .then(function() {
                        log("done.", "success");
                        return process.exit(0);
                    })
                    .catch(function(exception) {
                        log("Report generation failed: " + exception.toString(), "error");
                        return process.exit(90);
                    });
                });
            } else {
                log("Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("Login error: " + loginError.toString(), "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("Login error: " + loginError.toString(), "error");
        return process.exit(98);
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
        signInWithArcGIS()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                getUserAPIKeyItems(authentication)
                .then(async function(items) {
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
                    log(`Saving expired keys report to ${outputFile} ${outputFileFormat} with ${items.length} developer credentials:`, "info");
                    await outputResults(reducedItems, outputFile, outputFileFormat);
                    return process.exit(0);
                });
            } else {
                log("Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("Login error: " + loginError.toString(), "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("Login error: " + loginError.toString(), "error");
        return process.exit(98);
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
        signInWithArcGIS()
        .then(async function(authentication) {
            if (authentication && authentication.username) {
                const newKeys = [];
                apiKeyOptions.authentication = authentication;
                const title = apiKeyOptions.title;
                for (let i = 1; i <= numberOfKeys; i ++) {
                    apiKeyOptions.title = title + (numberOfKeys > 1 ? ` - (${i})` : "");
                    createApiKey(apiKeyOptions)
                    .then(async function(registeredAPIKey) {
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
                            await outputResults(newKeys, outputFile, outputFileFormat);
                            return process.exit(0);
                        }
                    }).catch(function(error) {
                        log(`createAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                        return process.exit(90);
                    });
                    if (i > 1) {
                        await sleeper(1000);
                    }
                }
            } else {
                log("createAPIKey Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("createAPIKey Login error: " + loginError.toString() + " Check your credentials.", "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("createAPIKey Login error: " + loginError.toString(), "error");
        return process.exit(98);
    }
}

/**
 * Update an existing API key.
 * Command line options
 * -i: item ID (required)
 * -t: title
 * -d: description
 * -k: tags, comma separated string, e.g. "tag1,tag2"
 * -p: privileges to add, comma separated string, e.g. "basemaps,places"
 * -r: referrers to add, comma separated string, e.g. "https://myapp.com/*"
 * @param {object} args Command line arguments.
 */
async function updateAPIKeyProperties(args) {
    // based on the command line options determine if the item needs to be updated, or if the API key properties need to be updated,
    // as they are two different API calls.
    let hasAPIKeyUpdateOptions = false;
    let hasItemUpdateOptions = false;
    let fileOptions = null;
    const itemId = getItemIDParameter(args);
    if (isEmpty(itemId)) {
        log("updateAPIKey error: item ID is required.", "error");
        return process.exit(99);
    }
    let apiKeyOptions = {
        itemId: itemId,
        generateToken1: false,
        generateToken2: false,
        authentication: null,
    };
    const optionsFile = args.c ?? "";
    if (! isEmpty(optionsFile)) {
        // Read options file to get the item properties, any CLI arg will override.
        fileOptions = loadOptions(optionsFile);
    }
    const privileges = args.p ?? fileOptions?.privileges ?? null;
    if (privileges !== null) {
        if (Array.isArray(privileges)) {
            apiKeyOptions.privileges = privileges.map(function(element) { return element.trim(); });
        } else {
            apiKeyOptions.privileges = privileges.split(",").map(function(element) { return element.trim(); });
        }
        hasAPIKeyUpdateOptions = true;
        if (apiKeyOptions.privileges.length === 1 && apiKeyOptions.privileges[0] === "") {
            apiKeyOptions.privileges = [];
        }
    }
    const referrers = args.r ?? fileOptions?.referrers ?? null;
    if (referrers !== null) {
        apiKeyOptions.httpReferrers = referrers.split(",").map(function(element) { return element.trim(); });
        hasAPIKeyUpdateOptions = true;
        if (apiKeyOptions.httpReferrers.length === 1 && apiKeyOptions.httpReferrers[0] === "") {
            apiKeyOptions.httpReferrers = [];
        }
    }
    const redirectURIs = args.u ?? fileOptions?.redirectURIs ?? null;
    if (redirectURIs !== null) {
        apiKeyOptions.redirectURIs = redirectURIs.split(",").map(function(element) { return element.trim(); });
        hasAPIKeyUpdateOptions = true;
        if (apiKeyOptions.redirectURIs.length === 1 && apiKeyOptions.redirectURIs[0] === "") {
            apiKeyOptions.redirectURIs = [];
        }
    }
    let itemUpdateOptions = {};
    const title = args.t ?? fileOptions?.title ?? "";
    if (!isEmpty(title)) {
        itemUpdateOptions.title = title;
        hasItemUpdateOptions = true;
    }
    const description = args.d ?? fileOptions?.description ?? "";
    if (!isEmpty(description)) {
        itemUpdateOptions.description = description;
        hasItemUpdateOptions = true;
    }
    const tags = args.k ?? fileOptions?.tags ?? "";
    if (!isEmpty(tags)) {
        if (Array.isArray(tags)) {
            itemUpdateOptions.tags = tags.map(function(tag) { return tag.trim(); });
        } else {
            itemUpdateOptions.tags = tags.split(",").map(function(tag) { return tag.trim(); });
        }
        hasItemUpdateOptions = true;
    }
    try {
        signInWithArcGIS()
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
                    return process.exit(90);
                }
                // no failures, log success and exit.
                return process.exit(0);
            } else {
                log("updateAPIKey Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("updateAPIKey Login error: " + loginError.toString() + " Check your credentials.", "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("updateAPIKey Login error: " + loginError.toString(), "error");
        return process.exit(98);
    }
}

/**
 * Delete an API key given its item identifier. This will delete the item and revoke any
 * tokens generated from that item. Also note this will delete any portal item, not just
 * API keys, so be careful to only pass the item ID of an API key.
 * @param {string} itemID ArcGIS item identifier of the API key to delete.
 */
 async function deleteItem(itemID) {
    try {
        signInWithArcGIS()
        .then(function(authentication) {
            if (authentication && authentication.username) {
                deletePortalItem(itemID, authentication)
                .then(function(serverResponse) {
                    log(`deleteItem says ` + JSON.stringify(serverResponse), "success");
                    return process.exit(0);
                })
                .catch(function(error) {
                    log("deleteItem error: " + error.toString(), "error");
                    return process.exit(90);
                })
            } else {
                log("deleteItem Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("deleteItem Login error: " + loginError.toString(), "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("deleteItem Login error: " + loginError.toString(), "error");
        return process.exit(98);
    }
}

/**
 * Inspect an API key, given its access token, to determine its properties. This can be used to check the owner,
 * privileges, and expiration date of an API key.
 * @param {string} token ArcGIS access token (API key or OAuth user token).
 * @param {string} referrer Optional. Referrer URL to include in the request. Default is an empty string.
 * @param {string} outFile Optional. If provided, will save the output to a file instead of logging to the console. Default is "stdout".
 * @param {string} format Optional. If outputting to a file, can specify the format as "json" or "csv". Default is "json".
 */
async function inspectAPIKeyToken(token, referrer = "",outFile = "stdout", format = "json") {
    if (token !== "") {
        try {
            const response = await fetch(`${serviceURL}${encodeURIComponent(token)}`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Referer: referrer
                }
            });
            if (!response.ok) {
                log(`Request failed with status ${response.status} ${response.statusText}`, "error");
                return process.exit(90);
            }
            const jsonResponse = await response.json();
            if (jsonResponse.error) {
                // { error: { code: 498, message: 'Invalid token.', details: [] } }
                log(`Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`, "error");
                return process.exit(90);
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
                    await saveJSONFile(reducedResponse, outFile);
                } else if (format === "csv") {
                    await saveCSVFile(reducedResponse, outFile);
                } else {
                    log(JSON.stringify(reducedResponse, null, 2), "data");
                }
                return process.exit(0);
            }
        } catch (exception) {
            log(`inspectAPIKey request failed: ${exception.message}`, "error");
            return process.exit(90);
        }
    } else {
        log("inspectAPIKey requires a non-empty token.", "error");
        return process.exit(99);
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
        signInWithArcGIS()
        .then(async function(authentication) {
            if (authentication && authentication.username) {
                getApiKey({
                    itemId: itemID,
                    authentication: authentication
                })
                .then(async function(apiKeyResponse) {
                    const apiKeyInfo = {
                        itemId: apiKeyResponse.itemId,
                        clientId: apiKeyResponse.client_id,
                        title: apiKeyResponse.item.title,
                        description: apiKeyResponse.item.description,
                        owner: apiKeyResponse.item.owner,
                        created: apiKeyResponse.item.created > 0 ? localDateFormat(apiKeyResponse.item.created) : "",
                        tags: apiKeyResponse.item.tags,
                        privileges: apiKeyResponse.privileges,
                        referrers: apiKeyResponse.httpReferrers,
                        apiToken1Active: apiKeyResponse.apiToken1Active,
                        apiToken1ExpirationDate: apiKeyResponse.item.apiToken1ExpirationDate > 0 ? localDateFormat(apiKeyResponse.item.apiToken1ExpirationDate) : "",
                        apiToken2Active: apiKeyResponse.apiToken2Active,
                        apiToken2ExpirationDate: apiKeyResponse.item.apiToken2ExpirationDate > 0 ? localDateFormat(apiKeyResponse.item.apiToken2ExpirationDate) : "",
                        isPersonalAPIToken: apiKeyResponse.isPersonalAPIToken,
                    };
                    if (format === "json") {
                        await saveJSONFile(apiKeyInfo, outFile);
                    } else if (format === "csv") {
                        await saveCSVFile(apiKeyInfo, outFile);
                    } else {
                        log(JSON.stringify(apiKeyInfo, null, 2), "data");
                    }
                    return process.exit(0);
                }, function(error) {
                    log(`getApiKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                })
                .catch(function(error) {
                    log(`getApiKey exception ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                    return process.exit(90);
                });
            } else {
                log("inspectAPIKeyItem Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("inspectAPIKeyItem Login error: " + loginError.toString(), "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("inspectAPIKeyItem Login error: " + loginError.toString(), "error");
        return process.exit(98);
    }
}

/**
 * Revoke API key access tokens. Pass -i itemId for which API key item, and pass -k 1, 2, or all for which token to revoke.
 * @param {object} args CLI arguments. We are looking for -i and -k.
 */
async function revokeAPIKey(args) {
    try {
        signInWithArcGIS()
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
                            return process.exit(0);
                        } else {
                            log(`Failed to revoke token 1 for item ${itemId}. Response: ${JSON.stringify(apiKeyResponse)}`, "error");
                            return process.exit(90);
                        }
                    })
                    .catch(function(error) {
                        log(`revokeAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                        return process.exit(90);
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
                            return process.exit(0);
                        } else {
                            log(`Failed to revoke token 2 for item ${itemId}. Response: ${JSON.stringify(apiKeyResponse)}`, "error");
                            return process.exit(90);
                        }
                    })
                    .catch(function(error) {
                        log(`revokeAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                        return process.exit(90);
                    });
                }
            } else {
                log("revokeAPIKey Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("revokeAPIKey Login error: " + loginError.toString(), "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("revokeAPIKey Login error: " + loginError.toString(), "error");
        return process.exit(98);
    }
}

/**
 * generate new tokens for api key 1, 2 or both, given the item ID.
 * command line options: -i itemID of the API key to update, -k 1/2/* for which token to regenerate, -d date or daysUntilExpiration for token 1, -e date or daysUntilExpiration for token 2.
 * @param {object} args Command line arguments.
 */
async function regenerateAPIKey(args) {
    try {
        signInWithArcGIS()
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
                    return process.exit(0);
                }).catch(function(error) {
                    log(`regenerateAPIKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                    return process.exit(90);
                });
            } else {
                log("revokeAPIKey Login error: invalid login.", "error");
                return process.exit(98);
            }
        })
        .catch(function(loginError) {
            log("revokeAPIKey Login error: " + loginError.toString(), "error");
            return process.exit(98);
        });
    } catch (loginError) {
        log("revokeAPIKey Login error: " + loginError.toString(), "error");
        return process.exit(98);
    }
}

/**
 * Test to see if a given API key has the expected privileges. This is useful for CLI, CI/CD applications
 * to check that an API key has the expected privileges assigned to it.
 * @param {object} args Command line arguments.
 */
async function checkPrivileges(args) {
    const token = getAccessTokenParameter(args);
    const optionsFile = args.c ?? "";
    const expectedPrivileges = args.p ?? "";
    const referrer = args.r ?? "";
    let privilegesList;
    let subscriptionCheckPass = false;
    if (isEmpty(token)) {
        log("checkPrivileges error: token is required.", "error");
        return process.exit(99);
    }
    if (isEmpty(expectedPrivileges) && ! isEmpty(optionsFile)) {
        // Read options file to get the list of privileges.
        const options = loadOptions(optionsFile);
        privilegesList = options?.privileges ?? [];
        if (isEmpty(privilegesList)) {
            log(`checkPrivileges error: no privileges found in ${optionsFile}.`, "error");
            return process.exit(99);
        }
    } else if ( ! isEmpty(expectedPrivileges)) {
        // privilegesList is already set from the command line.
        privilegesList = expectedPrivileges.trim();
        if (privilegesList[0] === "[" && privilegesList[privilegesList.length - 1] === "]") {
            // privilegesList is a JSON array string, parse it.
            try {
                privilegesList = JSON.parse(privilegesList);
            } catch (exception) {
                log(`checkPrivileges error: failed to parse privileges list as JSON array: ${exception.message}`, "error");
                return process.exit(99);
            }
        } else {
            // privilegesList is a comma-separated string, split it into an array.
            privilegesList = privilegesList.split(",").map(function(element) { return element.trim(); });
        }
    } else {
        log("checkPrivileges error: either -p privileges list or -c options file with privileges array is required.", "error");
        return process.exit(99);
    }
    if (privilegesList.length === 0) {
        log(`checkPrivileges error: no expected privileges found in -p or -c ${optionsFile}.`, "error");
        return process.exit(99);
    }
    try {
        // verify the expected privileges are present on the subscription for the logged in user.
        const authentication = await signInWithArcGIS();
        if (authentication && authentication.username) {
            const subscriptionPrivileges = await getSubscriptionPrivileges(authentication);
            const missingPrivileges = privilegesList.filter(function(privilege) {
                return ! subscriptionPrivileges.includes(privilege);
            });
            if (missingPrivileges.length > 0) {
                subscriptionCheckPass = false;
                log(`checkPrivileges: your subscription is missing privileges: ${missingPrivileges.join(", ")}`, "error");
            } else {
                subscriptionCheckPass = true;
                log("checkPrivileges: all expected privileges are present on your subscription.", "success");
            }
        }
        const response = await fetch(`${serviceURL}${encodeURIComponent(token)}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Referer: referrer
            }
        });
        if (!response.ok) {
            log(`Request failed with status ${response.status} ${response.statusText}`, "error");
            return process.exit(90);
        }
        const jsonResponse = await response.json();
        if (jsonResponse.error) {
            // { error: { code: 498, message: 'Invalid token.', details: [] } }
            log(`Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`, "error");
            return process.exit(90);
        } else {
            const actualPrivileges = jsonResponse.appInfo.privileges;
            const missingPrivileges = privilegesList.filter(function(privilege) {
                return ! actualPrivileges.includes(privilege);
            });
            if (missingPrivileges.length > 0) {
                log(`checkPrivileges: your access token is missing privileges: ${missingPrivileges.join(", ")}`, "error");
                return process.exit(90);
            } else if (subscriptionCheckPass) {
                log("checkPrivileges: all expected privileges are present on access token.", "success");
                return process.exit(0);
            } else {
                log("checkPrivileges: all expected privileges are present on access token, but some are missing from subscription.", "error");
                return process.exit(90);
            }
        }
    } catch (exception) {
        log(`checkPrivileges request failed: ${exception.message}`, "error");
        return process.exit(90);
    }
}

/**
 * Test to see if a given API key has the expected referrer set and is validated by a service. We
 * will detect a service to test against by looking up the first privileges in the access token, and then
 * send a single request to that service to see if the API key is accepted with the intended referrer.
 * @param {object} args Command line arguments.
 */
async function checkReferrer(args) {
    const token = getAccessTokenParameter(args);
    const referrer = args.r ?? "";
    if (isEmpty(token)) {
        log("checkReferrer error: token is required.", "error");
        return process.exit(99);
    }
    if (isEmpty(referrer)) {
        log("checkReferrer error: referrer is required.", "error");
        return process.exit(99);
    }
    log(`checkReferrer: testing your access token with referrer "${referrer}".`, "success");
    try {
        // verify the expected privileges are present on the subscription for the logged in user.
        const authentication = await signInWithArcGIS();
        const response = await fetch(`${serviceURL}${encodeURIComponent(token)}`, {
            method: "GET",
            headers: {
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            log(`Request failed with status ${response.status} ${response.statusText}`, "error");
            return process.exit(90);
        }
        const jsonResponse = await response.json();
        if (jsonResponse.error) {
            log(`Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`, "error");
            return process.exit(90);
        } else {
            const actualPrivileges = jsonResponse.appInfo.privileges;
            if (actualPrivileges.length === 0) {
                log(`checkReferrer: your access token is missing privileges, must have at least one.`, "error");
                return process.exit(90);
            }
            const itemId = jsonResponse.appInfo.itemId;
            if (authentication && authentication.username) {
                getApiKey({
                    itemId: itemId,
                    authentication: authentication
                })
                .then(function(apiKeyResponse) {
                    const apiKeyInfo = {
                        title: apiKeyResponse.item.title,
                        description: apiKeyResponse.item.description,
                        privileges: apiKeyResponse.privileges,
                        referrers: apiKeyResponse.httpReferrers
                    };
                    if (apiKeyInfo.referrers.length === 0) {
                        log(`checkReferrer: API key item ${itemId} has no referrers set.`, "success");
                    } else {
                        // @todo: what are the rules for matching referrers? For now, we will just check if the referrer string is present in the list of referrers. This will not work for wildcard domains.
                        const referrersFlat = apiKeyInfo.referrers.join(", ");
                        if (referrersFlat.includes(referrer)) {
                            log(`checkReferrer: referrer ${referrer} is present in API key item ${itemId} referrers: ${referrersFlat}`, "success");
                        } else {
                            log(`checkReferrer: referrer ${referrer} is NOT present in API key item ${itemId} referrers: ${referrersFlat}`, "error");
                        }
                    }
                    const serviceEndPoint = getLocationServiceEndpointFromPrivilege(actualPrivileges);
                    if (serviceEndPoint) {
                        log(`checkReferrer: testing API key against service endpoint ${serviceEndPoint}`, "info");
                        fetch(appendToken(serviceEndPoint, token), {
                            method: "GET",
                            headers: {
                                Accept: "application/json",
                                Referer: referrer
                            }
                        })
                        .then(function(serviceResponse) {
                            if (serviceResponse.ok) {
                                log(`checkReferrer: service endpoint ${serviceEndPoint} accepted the API key with referrer ${referrer}.`, "success");
                            } else {
                                log(`checkReferrer: service endpoint ${serviceEndPoint} rejected the API key with referrer ${referrer}. Status ${serviceResponse.status} ${serviceResponse.statusText}`, "error");
                            }
                            return process.exit(0);
                        })
                        .catch(function(serviceError) {
                            log(`checkReferrer: service endpoint ${serviceEndPoint} request failed: ${serviceError.message}`, "error");
                            return process.exit(90);
                        });
                    } else {
                        log(`checkReferrer: could not determine service endpoint from privileges ${actualPrivileges.join(", ")}.`, "error");
                        return process.exit(99);
                    }
                })
                .catch(function(error) {
                    log(`getApiKey error ${error.code}: ${error.originalMessage} ${JSON.stringify(error.response)}`, "error");
                    return process.exit(98);
                });
            } else {
                log("inspectAPIKeyItem Login error: invalid login.", "error");
                return process.exit(98);
            }
        }
    } catch (exception) {
        log(`checkReferrer request failed: ${exception.message}`, "error");
        return process.exit(90);
    }
}

export {
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
};
