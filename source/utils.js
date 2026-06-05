/**
 * Utility functions for the API key CLI tool.
 * @module utils
 */
import chalk from "chalk";
import fsExtra from "fs-extra";

/**
 * Handle logging with different levels and output destinations.
 * Levels are "error", "warn", "info", "data", and "success".
 * @param {string} message A message to send to the log.
 * @param {string} level How to consider the logged message.
 */
function log(message, level = "info") {
    if (level === "error") {
        console.error(chalk.red(message));
    } else if (level === "warn") {
        console.warn(chalk.yellow(message));
    } else if (level === "info" && showVerbose) {
        console.log(chalk.blue(message));
    } else if (level === "data") {
        console.log(message);
    } else if (showVerbose){
        console.log(chalk.green(message));
    }
}

/**
 * Get the access token from either the environment variable ARCGIS_TOKEN or command line argument -t.
 * @param {object} args Command line arguments object
 * @returns {string} access token or empty string if none.
 */
function getAccessTokenParameter(args) {
    let token = process.env.ARCGIS_TOKEN;
    if (isEmpty(token)) {
        token = args.t ?? "";
    }
    return token;
}

/**
 * Get the item id from either the environment variable ARCGIS_ITEM_ID or command line argument -i.
 * @param {object} args Command line arguments object
 * @returns {string} item id or empty string if none.
 */
function getItemIDParameter(args) {
    let itemId = process.env.ARCGIS_ITEM_ID;
    if (isEmpty(itemId)) {
        itemId = args.i ?? "";
    }
    return itemId;
}

/**
 * Return a Date object set at the date some number of days from today.
 * @param {integer} daysUntilExpiration Number of days from today.
 * @returns {Date} A date object set at the number of days from today.
 */
function getRelativeExpireDate(daysUntilExpiration) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);
    expirationDate.setHours(23, 59, 59, 999);
    return expirationDate;
}

/**
 * A basic wait function to pause things briefly so we don't overload the server.
 * @param {integer} milliseconds Time to wait.
 */
function sleeper (milliseconds) {
    new Promise(function(resolve) {
        setTimeout(resolve, milliseconds);
    });
}

/**
 * Helper function to determine if a value is empty. We consider a value empty if it is null, undefined, an empty string,
 * an empty array, or an empty object.
 * @param {any} value A value to test for emptiness.
 * @returns {boolean} True if considered empty, false if not empty.
 */
function isEmpty(value) {
    return (
    value == null || value == "" // null or undefined or coerced to an empty string
      || (typeof value === 'string' && value.trim().length === 0) // empty string
      || (Array.isArray(value) && value.length === 0) // empty array
      || (typeof value === 'object' && Object.keys(value).length === 0) // empty object
    );
}

/**
 * Determine the api key expiration date by considering 2 values. The first is a real date,
 * hopefully in the future, in a form that is parsable by the Date object. If this is not
 * provided or invalid, then use the second parameter as the number of days from today.
 * @param {string} fullDate Date string. If null or empty will then look at numberOfDays.
 * @param {integer} numberOfDays Number of days from today. Looked at only if fullDate is not provided. Must be a positive integer. Example: 3 means 3 days from today.
 * @return {integer} Date timestamp to use as API key expiration date.
 */
function dateFromOptions(fullDate, numberOfDays) {
    let expirationDate;
    if (fullDate) {
        expirationDate = new Date(fullDate);
        if (expirationDate.valueOf() === NaN) {
            expirationDate = getRelativeExpireDate(numberOfDays ?? 3);
        }
    } else {
        expirationDate = getRelativeExpireDate(numberOfDays ?? 3);
    }
    return expirationDate.valueOf();
}

/**
 * Convert timestamps into a human readable date string.
 * @param {integer} timestamp A Unix timestamp.
 * @returns {String} A date string in the format of "Month day, year" in the local timezone. If timestamp is less than 1000, returns "0".
 */
function localDateFormat(timestamp) {
    if (timestamp < 1000) {
        return "0";
    }
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}


/**
 * Helper function to try to determine if a value is numeric. This is used to determine
 * whether or not to put quotes around values when saving CSV files, since if a string contains
 * a comma it will mess up CSV formatting, and putting quotes around numbers can cause problems
 * when trying to use those numbers in other applications.
 * @param {string|Number} val Some value to test to see if it is a number.
 * @returns {boolean} True if the value is numeric, false if not a number.
 */
function isNumeric(val) {
  return !isNaN(parseFloat(val)) && isFinite(val);
}

/**
 * Save an object as a JSON file.
 * @param {object} fileData Object to store as a JSON file.
 * @param {string} filename Where to save the file.
 */
async function saveJSONFile(fileData, filename) {
    if (filename.toLowerCase() === "stdout") {
        log(JSON.stringify(fileData, null, 2), "data");
        return;
    }
    fsExtra.writeFile(filename, JSON.stringify(fileData, null, 2), function(error) {
        if (error) {
            log(`Cannot save JSON file: ${error.message}.`, "error");
        } else {
            log(`Data saved as ${filename}.`, "success");
        }
    });
}

/**
 * Save an array as a CSV file. This assumes the array data of the first element
 * is the same construct as all the elements in the array. The keys of the first
 * element are used to create the CSV header row.
 * @param {array} fileData Array of objects to store as a CSV file.
 * @param {string} filename Where to save the file.
 */
async function saveCSVFile(fileData, filename) {
    let headers;
    let rows;
    if (Array.isArray(fileData) && fileData.length > 0) {
        headers = Object.keys(fileData[0]).join(",");
        rows = fileData.map(function(row) {
            const numColumns = Object.keys(row).length;
            let rowString = "";
            Object.values(row).forEach(function(value, index) {
                if ( ! isNumeric(value)) {
                    value = `"${value}"`;
                }
                rowString += value + (index < numColumns - 1 ? "," : "");
            });
            return rowString;
        }).join("\n");
    } else if (typeof fileData === "object") {
        headers = Object.keys(fileData).join(",");
        rows = Object.values(fileData).join(",");
    }
    if (filename.toLowerCase() === "stdout") {
        log(`${headers}\n${rows}`, "data");
        return;
    }
    fsExtra.writeFile(filename, `${headers}\n${rows}`, function(error) {
        if (error) {
            log(`Cannot save CSV file: ${error.message}.`, "error");
        } else {
            log(`Data saved as ${filename}.`, "success");
        }
    });
}

/**
 * ArcGIS uses different methods to identify the type of item that holds an API key. This function
 * attempts to provide a consistent string to describe the type of item.
 * @param {string} type ArcGIS item type string.
 * @param {array} typeKeywords Array of ArcGIS item type keywords.
 * @returns {string} A string that describes the item type.
 */
function normalizeItemType(type, typeKeywords) {
    if (type == "API Key") {
        return type + " (legacy)";
    }
    if (typeKeywords.includes("APIToken")) {
        return "API key";
    }
    return type;
}

/**
 * Geocode an address using ArcGIS World Geocoding Service and return coordinates.
 * @param {string} apiKey ArcGIS API key.
 * @param {string} addressString Single-line address to geocode.
 * @returns {Promise<object>} Coordinates object with longitude/latitude and x/y values.
 */
async function geocodeAddress(apiKey, addressString) {
    if (isEmpty(apiKey)) {
        return {"status": 400, "error": "Missing API key."};
    }
    if (isEmpty(addressString)) {
        return {"status": 400, "error": "Missing address string."};
    }

    const endpoint = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
    const params = new URLSearchParams({
        f: "json",
        singleLine: addressString,
        outFields: "Match_addr,Addr_type",
        maxLocations: "1",
        token: apiKey
    });

    const response = await fetch(`${endpoint}?${params.toString()}`);
    if (!response.ok) {
        return {"status": response.status, "error": `Geocode request failed with status ${response.status}.`};
    }

    const geocodeData = await response.json();
    if (geocodeData.error) {
        return {"status": 500, "error": geocodeData.error.message ?? "Geocode request failed."};
    }

    const firstCandidate = geocodeData.candidates?.[0];
    if (!firstCandidate?.location) {
        return {"status": 404, "error": "No geocode candidates found for the provided address."};
    }

    return {
        address: firstCandidate.address ?? addressString,
        x: firstCandidate.location.x,
        y: firstCandidate.location.y,
        longitude: firstCandidate.location.x,
        latitude: firstCandidate.location.y
    };
}

export {
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
    saveCSVFile
}
