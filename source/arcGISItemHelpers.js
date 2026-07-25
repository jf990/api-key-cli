/**
 * Utility functions to work with content items in an ArcGIS Organization.
 */
import { searchItems, SearchQueryBuilder, createItem, updateItem, getItem, removeItem, getSelf } from "@esri/arcgis-rest-portal";
import { request, ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { log } from "./utils.js";

const serviceURL = "https://www.arcgis.com/sharing/rest/portals/self?f=json&token=";
const ArcGISPrivileges = {
    basemaps:               "premium:user:basemaps",
    basemapsStatic:         "premium:user:staticbasemaptiles",
    staticMaps:             "premium:user:staticMaps",
    places:                 "premium:user:places",
    geocodeStored:          "premium:user:geocode:stored",
    geocode:                "premium:user:geocode:temporary",
    elevation:              "premium:user:elevation",
    geoEnrichment:          "premium:user:geoenrichment",
    demographics:           "premium:user:demographics",
    featureReport:          "premium:user:featurereport",
    route:                  "premium:user:networkanalysis:routing",
    routeOptimized:         "premium:user:networkanalysis:optimizedrouting",
    routeServiceArea:       "premium:user:networkanalysis:servicearea",
    routeOriginDestination: "premium:user:networkanalysis:origindestinationcostmatrix",
    routeAllocation:        "premium:user:networkanalysis:locationallocation",
    routeVRP:               "premium:user:networkanalysis:vehiclerouting",
    routeClosestFacility:   "premium:user:networkanalysis:closestfacility",
    routeSnapToRoads:       "premium:user:networkanalysis:snaptoroads",
    routeLastMileDelivery:  "premium:user:networkanalysis:lastmiledelivery",
    analysisSpatial:        "premium:user:spatialanalysis",
    analysisRaster:         "premium:publisher:rasteranalysis",
    geoanalytics:           "premium:publisher:geoanalytics",
    beta:                   "portal:user:allowBetaAccess",
    item:                   "portal:app:access:item:"
};

const privilegeToEndpointMap = {
    "premium:user:basemaps": "https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/navigation",
    "premium:user:staticbasemaptiles": "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/navigation/static/tile/1/1/1",
    "premium:user:staticMaps": "https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/beta-rc/static-maps/arcgis/navigation/with-point",
    "premium:user:geocode": "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json",
    "premium:user:geocode:stored": "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json",
    "premium:user:geocode:temporary": "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json",
    "premium:user:elevation": "https://elevation-api.arcgis.com/arcgis/rest/services/elevation-service/v1",
    "premium:user:geoenrichment": "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "premium:user:demographics": "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "premium:user:featurereport": "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "premium:user:places": "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/near-point",
    "premium:user:networkanalysis:routing": "https://route-api.arcgis.com/arcgis/rest/services/World",
    "premium:user:networkanalysis:optimizedrouting": "https://route-api.arcgis.com/arcgis/rest/services/World",
    "premium:user:networkanalysis:servicearea": "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea",
    "premium:user:networkanalysis:origindestinationcostmatrix": "https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix",
    "premium:user:networkanalysis:locationallocation": "https://logistics.arcgis.com/arcgis/rest/services/World/LocationAllocation/GPServer/SolveLocationAllocation/submitJob",
    "premium:user:networkanalysis:vehiclerouting": "https://logistics.arcgis.com/arcgis/rest/services/World/VehicleRoutingProblemSync/GPServer/EditVehicleRoutingProblem/execute",
    "premium:user:networkanalysis:closestfacility": "https://route-api.arcgis.com/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World/solveClosestFacility",
    "premium:user:networkanalysis:snaptoroads": "https://route-api.arcgis.com/arcgis/rest/services/World/SnapToRoadsSync/GPServer/SnapToRoads/execute",
    "premium:user:networkanalysis:lastmiledelivery": "https://logistics.arcgis.com/arcgis/rest/services/World/VehicleRoutingProblem/GPServer/SolveLastMileDelivery/submitJob",
    "premium:user:spatialanalysis": "https://${analysis_url}/AggregatePoints/submitJob"
};

/**
 * Log in a user with the credentials set in the credentials store.
 * @returns {Promise} A Promise that will resolve with an ArcGISIdentityManager object for the logged in user.
 */
function signInWithArcGIS() {
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
 * Take a pass over all the provided options and try to verify they are acceptable and an attempt to create
 * an API key will succeed. Any errors detected are output to the console.
 * @param {object} options Expected API key options to verify.
 * @returns {boolean} True if all options seem to be OK to proceed, false if we detected something isn't correct.
 */
function verifyAPIKeyOptions(options) {
    let isValid = true; // we will prove otherwise
    let errorList = [];
    const apiKeyOptions = {
        title: "string:required",
        description: "string:optional",
        snippet: "string:optional",
        tags: "string:optional",
        privileges: "array:required",
        httpReferrers: "array:optional",
        redirect_uris: "array:optional"
    };
    for (const [property, value] of Object.entries(apiKeyOptions)) {
        const requiredDataType = value.substring(0, value.indexOf(":"));
        const isRequired = value.substring(value.indexOf(":") + 1) == "required";
        const providedValue = options[property];
        const wasProvided = providedValue !== undefined && providedValue !== null;
        let providedDataType;

        if (requiredDataType == "array" && Array.isArray(providedValue)) {
            providedDataType = "array";
        } else {
            providedDataType = typeof providedValue;
        }
        if (isRequired && ! wasProvided) {
            isValid = false;
            errorList.push(`Missing required option ${property}.`);
        }
        if (wasProvided && requiredDataType != providedDataType) {
            isValid = false;
            errorList.push(`Option ${property} is expected to be ${requiredDataType} but you provided ${providedDataType}.`);
        }
        if (property == "privileges" && providedDataType == "array") {
            let matched;
            let verifiedPrivs = [];
            let privString;
            for (const privilege of providedValue) {
                matched = false;
                for (const privName in ArcGISPrivileges) {
                    privString = ArcGISPrivileges[privName];
                    if (privilege == privName || privilege == privString) {
                        matched = true;
                        break;
                    }
                }
                if ( ! matched) {
                    isValid = false;
                    errorList.push(`Privilege ${privilege} is not a valid ArcGIS privilege.`);
                } else {
                    verifiedPrivs.push(privString);
                }
            }
        }
        if (errorList.length > 0) {
            log(errorList, "error");
        }
    }
    return isValid;
}

/**
 * Get a list of the logged in user's API keys and OAuth apps as an array of items. This is
 * done using the portal search API https://developers.arcgis.com/rest/users-groups-and-items/search.htm.
 * @param {ArcGISIdentityManager} authentication Identity of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
async function getAuthenticationItems(authentication) {
    const pageSize = 10;

    function getPageOfAuthenticationItems(page) {
        let startItem;
        if (page < 2) {
            startItem = 1;
        } if (page > 1) {
            startItem = ((page - 1) * pageSize) + 1;
        }
        return new Promise(function (resolve, reject) {
            const query = new SearchQueryBuilder()
            .match(authentication.username)
            .in("owner")
            .and()
            .startGroup()
              .match("API Key")
              .in("type")
              .or()
              .match("Registered App")
              .in("typekeywords")
              .or()
              .match("APIToken")
              .in("typekeywords")
            .endGroup();

            const options = {
                authentication: authentication,
                q: query,
                start: startItem,
                num: pageSize,
                sortField: "created",
                sortOrder: "desc"
            };
            log(`Querying for items ${startItem} to ${startItem + pageSize - 1}...`, "info");
            searchItems(options)
            .then(function(response) {
                resolve(response.results);
            })
            .catch(function(exception) {
                reject(exception);
            });    
        });
    }
    return new Promise(async function(resolve, reject) {
        let nextPage = 0;
        let allItems = [];

        // Query for items until we get less than a full page of items.
        while (true) {
            nextPage += 1;
            try {
                let items = await getPageOfAuthenticationItems(nextPage);
                allItems = allItems.concat(items);
                if (items.length < pageSize || nextPage > 100) { // if we got less than a full page, or we've paged through 100 pages (1000 items, which is likely more items than any user has), then stop paging and return what we have.
                    resolve(allItems);
                    return;
                }
            } catch (exception) {
                reject(exception);
                return;
            }
        }
        resolve(allItems);
    });
}

/**
 * Get a list of the logged in user's API keys as an array of items. This is
 * done using the portal search API https://developers.arcgis.com/rest/users-groups-and-items/search.htm.
 * @param {ArcGISIdentityManager} authentication Identity of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
async function getAPIKeyItems(authentication) {
    const pageSize = 10;

    function getPageOfAPIKeyItems(page) {
        let startItem;
        if (page < 2) {
            startItem = 1;
        } if (page > 1) {
            startItem = ((page - 1) * pageSize) + 1;
        }
        return new Promise(function (resolve, reject) {
            const query = new SearchQueryBuilder()
            .match(authentication.username)
            .in("owner")
            .and()
            .startGroup()
              .match("APIToken")
              .in("typekeywords")
            .endGroup();

            const options = {
                authentication: authentication,
                q: query,
                start: startItem,
                num: pageSize,
                sortField: "created",
                sortOrder: "desc"
            };
            log(`Querying for items ${startItem} to ${startItem + pageSize - 1}...`, "info");
            searchItems(options)
            .then(function(response) {
                resolve(response.results);
            })
            .catch(function(exception) {
                reject(exception);
            });    
        });
    }
    return new Promise(async function(resolve, reject) {
        let nextPage = 0;
        let allItems = [];

        // Query for items until we get less than a full page of items.
        while (true) {
            nextPage += 1;
            try {
                let items = await getPageOfAPIKeyItems(nextPage);
                allItems = allItems.concat(items);
                if (items.length < pageSize || nextPage > 100) { // if we got less than a full page, or we've paged through 100 pages (1000 items, which is likely more items than any user has), then stop paging and return what we have.
                    resolve(allItems);
                    return;
                }
            } catch (exception) {
                reject(exception);
                return;
            }
        }
        resolve(allItems);
    });
}

/**
 * Get a collection of the user's authentication items. These are content items that are API keys
 * and OAuth 2 apps belonging to the user's account.
 * @param {ArcGISIdentityManager} authentication The authentication object of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
function getUserAuthenticationItems(authentication) {
    return new Promise(function(resolve, reject) {
        getAuthenticationItems(authentication)
        .then(function(items) {
            let filteredItems = [];
            items.forEach(function(item) {
                filteredItems.push({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    snippet: item.snippet,
                    type: item.type,
                    typeKeywords: item.typeKeywords,
                    created: item.created,
                    modified: item.modified,
                    tags: item.tags,
                    apiToken1ExpirationDate: item.apiToken1ExpirationDate,
                    apiToken2ExpirationDate: item.apiToken2ExpirationDate
                });
            });
            resolve(filteredItems);
        })
        .catch(function(exception) {
            reject(exception);
        });
    });
}

/**
 * Get a collection of the user's API keys.
 * @param {ArcGISIdentityManager} authentication The authentication object of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
async function getUserAPIKeyItems(authentication) {
    return new Promise(function(resolve, reject) {
        getAPIKeyItems(authentication)
        .then(function(items) {
            let filteredItems = [];
            items.forEach(async function(item) {
                const itemDetails = await getItem(item.id, { authentication });
                filteredItems.push({
                    id: itemDetails.id,
                    title: itemDetails.title,
                    description: itemDetails.description,
                    snippet: itemDetails.snippet,
                    type: itemDetails.type,
                    typeKeywords: itemDetails.typeKeywords,
                    created: itemDetails.created,
                    modified: itemDetails.modified,
                    tags: itemDetails.tags,
                    apiToken1ExpirationDate: itemDetails.apiToken1ExpirationDate,
                    apiToken2ExpirationDate: itemDetails.apiToken2ExpirationDate
                });
                if (filteredItems.length == items.length) {
                    resolve(filteredItems);
                }
            });
        })
        .catch(function(exception) {
            reject(exception);
        });
    });
}

/**
 * Create a new portal item.
 * @param {object} itemOptions Options used to define the new portal item. Expects title, description, tags, and the item type.
 * @param {ArcGISIdentityManager} authentication A user session is required to create items.
 * @returns {Promise} Promise that resolves with the server response from the item creation service.
 */
function createPortalItem(itemOptions, authentication) {
    return createItem({
        item: {
            title: itemOptions.title,
            description: itemOptions.description,
            tags: itemOptions.tags,
            type: itemOptions.type
        },
        authentication: authentication
    });
}

/**
 * Update a portal item.
 * @param {string} itemID The ArcGIS item identifier of the item to update.
 * @param {object} itemOptions Options used to define item properties to change.
 * @param {ArcGISIdentityManager} authentication A user session is required to update items.
 * @returns {Promise} Promise that resolves with the server response from the item update service.
 */
function updatePortalItem(itemID, itemOptions, authentication) {
    return updateItem({
        item: itemOptions,
        authentication: authentication
    });
}

/**
 * Get meta data for a portal item.
 * @param {string} itemID The ArcGIS item identifier of the item to update.
 * @param {ArcGISIdentityManager} authentication A user session to access the item.
 * @returns {Promise} Promise that resolves with the server response from the portal service.
 */
function getPortalItem(itemID, authentication) {
    return getItem(itemID, { authentication });
}

/**
 * Delete a portal item.
 * @param {string} itemId An item ID to delete. This should be the item ID of the API key item that was returned from `createAPIKey`.
 * @param {ArcGISIdentityManager} authentication A user session is required to delete items.
 * @returns {Promise} Promise that resolves with the server response from the item remove service.
 */
 function deletePortalItem(itemId, authentication) {
    return removeItem({
        id: itemId,
        authentication: authentication
    });
}

/**
 * Update an existing registered app with the API key information.
 * @param {string} itemId The item id of a registered app owned by the authenticated user.
 * @param {object} itemOptions Parameters required to create an API key, includes privileges (scopes), referrers, redirect URL.
 * @param {ArcGISIdentityManager} authentication Logged in user session.
 * @returns 
 */
function registerAPIKeyApp(itemId, itemOptions, authentication) {
    const portalServiceUrl = authentication.portal + "/oauth2/registerApp";
    const apiKeyRequestOptions = {
        httpMethod: "POST",
        params: {
            itemId: itemId,
            appType: "apikey",
            httpReferrers: JSON.stringify(itemOptions.httpReferrers),
            redirect_uris: JSON.stringify(itemOptions.redirect_uris),
            privileges: JSON.stringify(itemOptions.privileges)
        },
        authentication: authentication
    };
    return request(portalServiceUrl, apiKeyRequestOptions);
}

/**
 * Return an array of ArcGIS privileges associated to the authenticated user presented by the authentication object.
 * @param {object} authentication object from ArcGIS REST JS.
 * @returns {array} Array of privileges for the authenticated user.
 */
async function getSubscriptionPrivileges(authentication) {
    if (! authentication || ! authentication.token) {
        throw new Error("Authentication object with valid token is required to get subscription privileges.");
    }
    const userIdentity = await ArcGISIdentityManager.fromToken({
        token: authentication.token,
        expires: authentication.expires,
        username: authentication.username,
        portal: authentication.portal
    });
    const userInfo = await getSelf({ authentication: userIdentity });
    if ( ! userInfo || ! userInfo.user || ! userInfo.user.privileges) {
        throw new Error("Unable to retrieve user information or privileges from the portal, check your authentication token.");
    }
    return userInfo.user.privileges;
}

/**
 * Given a single ArcGIS privilege string, return the URL of the service endpoint that matches the privilege.
 * @param {string|array} privilege A single ArcGIS privilege string (e.g. premium:user:basemaps) or an array of privileges.
 * @returns {string|null} The URL of the service endpoint matching the privilege, or null if the lookup fails.
 */
function getLocationServiceEndpointFromPrivilege(privilege) {
    if (!privilege || (typeof privilege !== "string" && !Array.isArray(privilege))) {
        throw new Error("A single ArcGIS privilege string or an array of privileges is required to get the service endpoint.");
    }
    if (Array.isArray(privilege)) {
        for (const priv of privilege) {
            if (privilegeToEndpointMap[priv]) {
                return privilegeToEndpointMap[priv];
            }
        }
        return null;
    }
    return privilegeToEndpointMap[privilege] || null;
}

export {
    signInWithArcGIS,
    ArcGISPrivileges,
    getAuthenticationItems,
    getUserAuthenticationItems,
    getAPIKeyItems,
    getUserAPIKeyItems,
    createPortalItem,
    updatePortalItem,
    getPortalItem,
    deletePortalItem,
    getSubscriptionPrivileges,
    getLocationServiceEndpointFromPrivilege
};
