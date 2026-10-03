/**
 * Utility functions to work with content items in an ArcGIS Organization.
 */
import process from "node:process";
import { searchItems, SearchQueryBuilder, createItem, updateItem, getItem, removeItem, getSelf } from "@esri/arcgis-rest-portal";
import { request, ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import { log } from "./utils.js";

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

/**
 * Given a privilege string, determine which endpoint path we can use to access the corresponding ArcGIS service.
 */
const privilegeToEndpointMap = {
    "premium:user:basemaps": "/arcgis/rest/services/styles/v2/styles/arcgis/navigation",
    "premium:user:staticbasemaptiles": "/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/navigation/static/tile/1/1/1",
    "premium:user:staticMaps": "/arcgis/rest/services/static-maps-service/beta-rc/static-maps/arcgis/navigation/with-point",
    "premium:user:geocode": "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    "premium:user:geocode:stored": "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    "premium:user:geocode:temporary": "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    "premium:user:elevation": "/arcgis/rest/services/elevation-service/v1",
    "premium:user:geoenrichment": "/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "premium:user:demographics": "/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "premium:user:featurereport": "/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "premium:user:places": "/arcgis/rest/services/places-service/v1/places/near-point",
    "premium:user:networkanalysis:routing": "/arcgis/rest/services/World",
    "premium:user:networkanalysis:optimizedrouting": "/arcgis/rest/services/World",
    "premium:user:networkanalysis:servicearea": "/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea",
    "premium:user:networkanalysis:origindestinationcostmatrix": "/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix",
    "premium:user:networkanalysis:locationallocation": "/arcgis/rest/services/World/LocationAllocation/GPServer/SolveLocationAllocation/submitJob",
    "premium:user:networkanalysis:vehiclerouting": "/arcgis/rest/services/World/VehicleRoutingProblemSync/GPServer/EditVehicleRoutingProblem/execute",
    "premium:user:networkanalysis:closestfacility": "/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World/solveClosestFacility",
    "premium:user:networkanalysis:snaptoroads": "/arcgis/rest/services/World/SnapToRoadsSync/GPServer/SnapToRoads/execute",
    "premium:user:networkanalysis:lastmiledelivery": "/arcgis/rest/services/World/VehicleRoutingProblem/GPServer/SolveLastMileDelivery/submitJob",
    "premium:user:spatialanalysis": "/AggregatePoints/submitJob"
};

/**
 * A set of arbitrary service endpoints that we can use when given a valid token with matching privilege will return a 200 response.
 */
const arcgisServicePaths = {
    "basemaps": "/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/10/507/807",
    "basemap-styles": "/arcgis/rest/services/styles/v2/styles/arcgis/navigation",
    "elevation": "/arcgis/rest/services/elevation-service/v1",
    "enrichment": "/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/Enrich",
    "geocode": "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
    "imagery": "/arcgis/rest/services/World_Imagery/MapServer/tile/10/507/807",
    "logistics": "/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World/solveClosestFacility",
    "places": "/arcgis/rest/services/places-service/v1/places/near-point",
    "portal": "/sharing/rest/portals/self",
    "routing": "/arcgis/rest/services/World",
    "static-map-tiles": "/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/navigation/static/tile/10/507/807",
    "static-maps": "/arcgis/rest/services/static-maps-service/beta-rc/static-maps/arcgis/navigation/with-point",
    "spatialanalysis": "/AggregatePoints/submitJob"
};

/**
 * Given a privilege string, determine which ArcGIS service consumes that privilege.
 */
const privilegeToServiceMap = {
    "premium:user:basemaps": "basemap-styles",
    "premium:user:staticbasemaptiles": "static-map-tiles",
    "premium:user:staticMaps": "static-maps",
    "premium:user:geocode": "geocode",
    "premium:user:geocode:stored": "geocode",
    "premium:user:geocode:temporary": "geocode",
    "premium:user:elevation": "elevation",
    "premium:user:geoenrichment": "enrichment",
    "premium:user:demographics": "enrichment",
    "premium:user:featurereport": "enrichment",
    "premium:user:places": "places",
    "premium:user:networkanalysis:routing": "routing",
    "premium:user:networkanalysis:optimizedrouting": "routing",
    "premium:user:networkanalysis:servicearea": "routing",
    "premium:user:networkanalysis:origindestinationcostmatrix": "routing",
    "premium:user:networkanalysis:locationallocation": "logistics",
    "premium:user:networkanalysis:vehiclerouting": "logistics",
    "premium:user:networkanalysis:closestfacility": "routing",
    "premium:user:networkanalysis:snaptoroads": "routing",
    "premium:user:networkanalysis:lastmiledelivery": "logistics",
    "premium:user:spatialanalysis": "spatialanalysis"
};

/**
 * Define each ArcGIS domain based on staging environment and service type.
 */
const arcgisDomains = {
    "prod": {
        "basemaps": "basemaps-api.arcgis.com",
        "basemap-styles": "basemapstyles-api.arcgis.com",
        "elevation": "elevation-api.arcgis.com",
        "enrichment": "geoenrich.arcgis.com",
        "geocode": "geocode-api.arcgis.com",
        "imagery": "ibasemaps-api.arcgis.com",
        "logistics": "logistics.arcgis.com",
        "places": "places-api.arcgis.com",
        "portal": "www.arcgis.com",
        "routing": "route-api.arcgis.com",
        "static-map-tiles": "static-map-tiles-api.arcgis.com",
        "static-maps": "static-maps-api.arcgis.com",
        "spatialanalysis": "" // requires an additional query
    },
    "dev": {
        "basemaps": "basemapsdev-api.arcgis.com",
        "basemap-styles": "basemapstylesdev-api.arcgis.com",
        "elevation": "elevationdev-api.arcgis.com",
        "enrichment": "geoenrichdev.arcgis.com",
        "geocode": "geocodedev-api.arcgis.com",
        "imagery": "ibasemapsdev-api.arcgis.com",
        "logistics": "logisticsdev.arcgis.com",
        "places": "placesdev-api.arcgis.com",
        "portal": "devext.arcgis.com",
        "routing": "routedev-api.arcgis.com",
        "static-map-tiles": "static-map-tilesdev-api.arcgis.com",
        "static-maps": "static-mapsdev-api.arcgis.com",
        "spatialanalysis": "" // requires an additional query
    },
    "qa": {
        "basemaps": "basemaps-api.arcgis.com",
        "basemap-styles": "basemapstylesqa-api.arcgis.com",
        "elevation": "elevationqa-api.arcgis.com",
        "enrichment": "geoenrichqa.arcgis.com",
        "geocode": "geocodeqa-api.arcgis.com",
        "imagery": "ibasemaps-api.arcgis.com",
        "logistics": "logisticsqa.arcgis.com",
        "places": "places-api.arcgis.com",
        "portal": "qaext.arcgis.com",
        "routing": "route-api.arcgis.com",
        "static-map-tiles": "static-map-tiles-api.arcgis.com",
        "static-maps": "static-maps-api.arcgis.com",
        "spatialanalysis": "" // requires an additional query
    }
};

/**
 * Get the URL for the portal self endpoint, optionally including a token. This is used to
 * return the portal information about the token or to authenticate the user.
 * @param {string} environment Which environment to use, default is prod.
 * @param {string} token Optional token to append to query string.
 * @returns {string} A fully qualified URL.
 */
function getPortalSelfURL(environment = "prod", token = "") {
    const domain = resolveDomain("portal", environment);
    const addToken = token ? `&token=${encodeURIComponent(token)}` : "";
    return `https://${domain}/sharing/rest/portals/self?f=json${addToken}`;
}

/**
 * Resolve the domain for a given environment and ArcGIS service. For example, if the environment is "prod" and
 * the service is "basemaps", it will return the corresponding ArcGIS domain for basemaps (e.g., "basemaps-api.arcgis.com").
 * @param {string} service Intended ArcGIS service, must be one of the pre-defined ArcGIS location service types.
 * @param {string} environment Intended environment, one of prod, dev, or qa. Default is prod.
 * @returns {string} The resolved domain for the given environment and service, or "www.arcgis.com" if not found.
 */
function resolveDomain(service, environment = "prod") {
    return arcgisDomains[environment]?.[service] ?? "www.arcgis.com";
}

/**
 * Resolve the service path for a given environment and ArcGIS service. For example, if the service is "geocode", it
 * will return the corresponding ArcGIS service path for geocoding
 * (e.g., "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates").
 * @param {string} service Intended ArcGIS service, must be one of the pre-defined ArcGIS location service types.
 * @returns {string} The resolved service path for the given environment and service, or an empty string if not found.
 */
function resolveServicePath(service) {
    return arcgisServicePaths[service] ?? "";
}

/**
 * Return a fully qualified URL for the given environment and ArcGIS service.
 * @param {string} service Intended ArcGIS service, must be one of the pre-defined ArcGIS location service types.
 * @param {string} environment Intended environment, one of prod, dev, or qa. Default is prod.
 * @returns {string} The fully qualified URL for the given environment and service.
 */
function resolveFullServicePath(service, environment = "prod") {
    const domain = resolveDomain(service, environment);
    const path = resolveServicePath(service);
    return `https://${domain}${path}`;
}

/**
 * Given an ArcGIS privilege string, return the corresponding service it maps to according to the privilegeToServiceMap. If given
 * an array of privileges, return the first match.
 * @param {string|Array} privilege The ArcGIS privilege or an array of privileges to map to a service.
 * @returns {string|null} The corresponding service for the given privilege, or null if no match is found.
 */
function privilegeToService(privilege) {
    if ( ! privilege || (typeof privilege !== "string" && ! Array.isArray(privilege))) {
        throw new Error("A single ArcGIS privilege string or an array of privileges is required to get the service domain.");
    }
    if (Array.isArray(privilege)) {
        for (const priv of privilege) {
            if (privilegeToServiceMap[priv]) {
                return privilegeToServiceMap[priv];
            }
        }
        return null;
    }
    return privilegeToServiceMap[privilege] || null;
}

/**
 * Given a single ArcGIS privilege string, return the URL of the service endpoint that matches the privilege. If given
 * an array of privileges we return the URL of the first matching service endpoint.
 * @param {string|array} privilege A single ArcGIS privilege string (e.g. premium:user:basemaps) or an array of privileges.
 * @param {string} environment The environment to use (e.g., "dev", "qa", "prod"). Default is "prod".
 * @returns {string|null} The URL of the service endpoint matching the privilege, or null if the lookup fails.
 */
function getLocationServiceEndpointFromPrivilege(privilege, environment = "prod") {
    if ( ! privilege || (typeof privilege !== "string" && ! Array.isArray(privilege))) {
        throw new Error("A single ArcGIS privilege string or an array of privileges is required to get the service endpoint.");
    }
    if (Array.isArray(privilege)) {
        for (const priv of privilege) {
            const endPoint = privilegeToEndpointMap[priv];
            if (endPoint) {
                const service = privilegeToService(priv);
                return `https://${resolveDomain(service, environment)}${endPoint}`;
            }
        }
        return null;
    }
    const service = privilegeToService(privilege);
    const endPoint = privilegeToEndpointMap[privilege] ?? "";
    return `https://${resolveDomain(service, environment)}${endPoint}`;
}

/**
 * Log in a user with the credentials set in the credentials store.
 * @param {string} environment The environment to use (e.g., "dev", "qa", "prod").
 * @returns {Promise} A Promise that will resolve with an ArcGISIdentityManager object for the logged in user, and reject if
 * the sign-in fails or credentials are missing.
 */
function signInWithArcGIS(environment) {
    return new Promise(function(resolve, reject) {
        if (process.env.ARCGIS_USER_NAME && process.env.ARCGIS_USER_PASSWORD) {
            const signInOptions = {
                username: process.env.ARCGIS_USER_NAME,
                password: process.env.ARCGIS_USER_PASSWORD
            };
            if (environment != "prod") {
                signInOptions.portal = "https://" + resolveDomain("portal", environment) + "/sharing/rest";
            }
            ArcGISIdentityManager.signIn(signInOptions)
            .then(function(identityManager) {
                resolve(identityManager);
            })
            .catch(function(exception) {
                reject(new Error(`Failed to sign in to ArcGIS stage ${environment} with username ${process.env.ARCGIS_USER_NAME}: ${exception.message}`));
            });
        } else {
            reject(new Error("Missing credentials. Update .env with your ArcGIS credentials."));
        }
    });
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
    let nextPage = 0;
    let allItems = [];

    // Query for items until we get less than a full page of items.
    while (true) {
        nextPage += 1;
        const items = await getPageOfAuthenticationItems(nextPage);
        allItems = allItems.concat(items);
        if (items.length < pageSize || nextPage > 100) { // if we got less than a full page, or we've paged through 100 pages (1000 items, which is likely more items than any user has), then stop paging and return what we have.
            return allItems;
        }
    }
}

/**
 * Get a list of the logged in user's API keys as an array of items. This is
 * done using the portal search API https://developers.arcgis.com/rest/users-groups-and-items/search.htm.
 * @param {ArcGISIdentityManager} authentication Identity of the logged in user.
 * @returns {Array} Returns an array of the users API key items.
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
    let nextPage = 0;
    let allItems = [];

    // Query for items until we get less than a full page of items.
    while (true) {
        nextPage += 1;
        let items = await getPageOfAPIKeyItems(nextPage);
        allItems = allItems.concat(items);
        if (items.length < pageSize || nextPage > 100) { // if we got less than a full page, or we've paged through 100 pages (1000 items, which is likely more items than any user has), then stop paging and return what we have.
            return allItems;
        }
    }
}

/**
 * Get a collection of the user's authentication items. These are content items that are API keys
 * and OAuth 2 apps belonging to the user's account.
 * @param {ArcGISIdentityManager} authentication The authentication object of the logged in user.
 * @returns {Promise} Resolves with the array of items.
 */
async function getUserAuthenticationItems(authentication) {
    const items = await getAuthenticationItems(authentication);
    if (items) {
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
        return filteredItems;
    }
    return [];
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

export {
    resolveDomain,
    resolveServicePath,
    resolveFullServicePath,
    signInWithArcGIS,
    ArcGISPrivileges,
    getAuthenticationItems,
    getUserAuthenticationItems,
    verifyAPIKeyOptions,
    getUserAPIKeyItems,
    createPortalItem,
    updatePortalItem,
    getPortalItem,
    deletePortalItem,
    getSubscriptionPrivileges,
    privilegeToService,
    getLocationServiceEndpointFromPrivilege,
    registerAPIKeyApp,
    getPortalSelfURL
};
