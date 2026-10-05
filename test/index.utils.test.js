/**
 * Basic unit tests for the utility functions in utils.js. These tests focus on the logic of the helper functions and do not
 * involve any external API calls or file system interactions.
 */
import process from "node:process";
import fsExtra from "fs-extra";
import {
    getAccessTokenParameter,
    getItemIDParameter,
    dateFromOptions,
    localDateFormat,
    getRelativeExpireDate,
    isEmpty,
    sleeper,
    isNumeric,
    normalizeItemType,
    saveJSONFile,
    saveCSVFile,
    appendToken,
    outputResults,
    loadOptions,
    validateEnvironment
} from "../source/utils.js";
import { describe, afterEach, expect, test } from '@jest/globals';

describe("Utility helper functions", function() {
    afterEach(function() {
        delete process.env.ARCGIS_TOKEN;
        delete process.env.ARCGIS_ITEM_ID;
    });

    test("getAccessTokenParameter prefers ARCGIS_TOKEN env over CLI args", function() {
        process.env.ARCGIS_TOKEN = "env-token";
        const args = { t: "cli-token" };
        expect(getAccessTokenParameter(args)).toBe("env-token");
    });

    test("getAccessTokenParameter falls back to CLI arg", function() {
        const args = { t: "cli-token" };
        expect(getAccessTokenParameter(args)).toBe("cli-token");
    });

    test("getItemIDParameter prefers ARCGIS_ITEM_ID env over CLI args", function() {
        process.env.ARCGIS_ITEM_ID = "env-item";
        const args = { i: "cli-item" };
        expect(getItemIDParameter(args)).toBe("env-item");
    });

    test("getItemIDParameter falls back to CLI arg", function() {
        const args = { i: "cli-item" };
        expect(getItemIDParameter(args)).toBe("cli-item");
    });

    test("isEmpty handles empty and non-empty values", function() {
        expect(isEmpty(null)).toBe(true);
        expect(isEmpty("")).toBe(true);
        expect(isEmpty("   ")).toBe(true);
        expect(isEmpty([])).toBe(true);
        expect(isEmpty({})).toBe(true);
        expect(isEmpty(0)).toBe(true);
        expect(isEmpty(undefined)).toBe(true);
        expect(isEmpty(false)).toBe(true);
        expect(isEmpty("value")).toBe(false);
        expect(isEmpty([1])).toBe(false);
        expect(isEmpty({ a: 1 })).toBe(false);
    });

    test("isNumeric detects numeric strings and numbers", function() {
        expect(isNumeric("12.5")).toBe(true);
        expect(isNumeric(42)).toBe(true);
        expect(isNumeric(" 12 ")).toBe(true);
        expect(isNumeric("abc")).toBe(false);
        expect(isNumeric("")).toBe(false);
        expect(isNumeric("12abc")).toBe(false);
    });

    test("sleeper waits for 5 seconds", async function() {
        const start = Date.now();
        await sleeper(5000);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(4900);
        expect(elapsed).toBeLessThan(7000);
    }, 20000);

    test("normalizeItemType marks legacy and APIToken items", function() {
        expect(normalizeItemType("API Key", [])).toBe("API Key (legacy)");
        expect(normalizeItemType("Credential", ["APIToken"]))
            .toBe("API key");
        expect(normalizeItemType("Credential", ["OtherKeyword"]))
            .toBe("Credential");
    });

    test("localDateFormat returns 0 for tiny timestamps", function() {
        expect(localDateFormat(0)).toBe("0");
        expect(localDateFormat(999)).toBe("0");
    });

    test("localDateFormat returns MDY timestamps", function() {
        expect(localDateFormat(1000)).toBe("December 31, 1969");
        expect(localDateFormat(1784930660613)).toBe("July 24, 2026");
    });

    test("getRelativeExpireDate adds days and sets the time to end of day", function() {
        const daysAhead = 3;
        const start = new Date();
        const expected = new Date(start);
        expected.setDate(expected.getDate() + daysAhead);
        expected.setHours(23, 59, 59, 999);

        const result = getRelativeExpireDate(daysAhead);

        expect(result.getFullYear()).toBe(expected.getFullYear());
        expect(result.getMonth()).toBe(expected.getMonth());
        expect(result.getDate()).toBe(expected.getDate());
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
        expect(result.getMilliseconds()).toBe(999);
    });

    test("getRelativeExpireDate supports a date 1 day in the future", function() {
        const daysAhead = 1;
        const start = new Date();
        const expected = new Date(start);
        expected.setDate(expected.getDate() + daysAhead);
        expected.setHours(23, 59, 59, 999);

        const result = getRelativeExpireDate(daysAhead);

        expect(result.getFullYear()).toBe(expected.getFullYear());
        expect(result.getMonth()).toBe(expected.getMonth());
        expect(result.getDate()).toBe(expected.getDate());
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
        expect(result.getMilliseconds()).toBe(999);
    });

    test("getRelativeExpireDate supports a date 1 day in the past", function() {
        const daysAgo = -1;
        const start = new Date();
        const expected = new Date(start);
        expected.setDate(expected.getDate() + daysAgo);
        expected.setHours(23, 59, 59, 999);

        const result = getRelativeExpireDate(daysAgo);

        expect(result.getFullYear()).toBe(expected.getFullYear());
        expect(result.getMonth()).toBe(expected.getMonth());
        expect(result.getDate()).toBe(expected.getDate());
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
        expect(result.getMilliseconds()).toBe(999);
    });

    test("getRelativeExpireDate supports a date roughly six months in the future", function() {
        const daysAhead = 183;
        const start = new Date();
        const expected = new Date(start);
        expected.setDate(expected.getDate() + daysAhead);
        expected.setHours(23, 59, 59, 999);

        const result = getRelativeExpireDate(daysAhead);

        expect(result.getFullYear()).toBe(expected.getFullYear());
        expect(result.getMonth()).toBe(expected.getMonth());
        expect(result.getDate()).toBe(expected.getDate());
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
        expect(result.getMilliseconds()).toBe(999);
    });

    test("dateFromOptions with explicit date returns that day timestamp", function() {
        const timestamp = dateFromOptions("2026-12-31", 7);
        const parsed = new Date(timestamp);
        expect(parsed.getUTCFullYear()).toBe(2026);
        expect(parsed.getUTCMonth()).toBe(11);
        expect(parsed.getUTCDate()).toBe(31);
    });

    test("dateFromOptions with empty date uses relative days", function() {
        const now = Date.now();
        const timestamp = dateFromOptions("", 2);
        expect(timestamp).toBeGreaterThan(now);
    });

    test("saveJSONFile writes JSON object to disk and reads back exactly", async function() {
        const results = { message: "Test output", count: 3, nested: { ok: true } };
        const outputFile = "test_savejsonfile.json";

        await saveJSONFile(results, outputFile);
        const data = fsExtra.readFileSync(outputFile, "utf8");

        expect(data).toBe(JSON.stringify(results, null, 2));
        expect(JSON.parse(data)).toEqual(results);

        fsExtra.unlinkSync(outputFile); // Clean up after test
    });

    test("loadOptions reads YAML and sets each expected key to a valid value", function() {
        const yamlFile = "test_loadoptions.yaml";
        const yamlData = `options:
  title: "Demo API key"
  description: "Test key for loadOptions"
  tags: ["demo", "test"]
  privileges: ["premium:user:basemaps"]
  referrers: ["https://localhost:8000"]
  redirect_uris: ["https://example.com/callback"]
  generateToken1: true
  apiToken1ExpirationDate: "2026-10-31"
  apiToken1ExpirationDays: 3
  generateToken2: false
  apiToken2ExpirationDate: "2026-11-30"
  apiToken2ExpirationDays: 2
`;
        fsExtra.writeFileSync(yamlFile, yamlData, "utf8");

        const options = loadOptions(yamlFile);

        expect(options).not.toBeNull();
        expect(typeof options.title).toBe("string");
        expect(options.title.length).toBeGreaterThan(0);
        expect(typeof options.description).toBe("string");
        expect(options.description.length).toBeGreaterThan(0);
        expect(Array.isArray(options.tags)).toBe(true);
        expect(options.tags.length).toBeGreaterThan(0);
        expect(Array.isArray(options.privileges)).toBe(true);
        expect(options.privileges.length).toBeGreaterThan(0);
        expect(Array.isArray(options.httpReferrers)).toBe(true);
        expect(options.httpReferrers.length).toBeGreaterThan(0);
        expect(Array.isArray(options.redirect_uris)).toBe(true);
        expect(options.redirect_uris.length).toBeGreaterThan(0);
        expect(typeof options.generateToken1).toBe("boolean");
        expect(options.generateToken1).toBe(true);
        expect(typeof options.apiToken1ExpirationDate).toBe("number");
        expect(options.apiToken1ExpirationDate).toBeGreaterThan(0);
        expect(typeof options.generateToken2).toBe("boolean");
        expect(options.generateToken2).toBe(false);
        expect(typeof options.apiToken2ExpirationDate).toBe("number");
        expect(options.apiToken2ExpirationDate).toBeGreaterThan(0);

        fsExtra.unlinkSync(yamlFile); // Clean up after test
    });

    test("outputResults creates expected JSON file with contents", async function() {
        let results = { message: "Test output" };
        let outputFile = "test_output.json";
        let outputFileFormat = "json";
        await outputResults(results, outputFile, outputFileFormat);
        let data = fsExtra.readFileSync(outputFile, "utf8");
        expect(JSON.parse(data)).toEqual(results);
        fsExtra.unlinkSync(outputFile); // Clean up after test

        results = ["item1", "item2"];
        outputFile = "test_output.json";
        outputFileFormat = "json";
        await outputResults(results, outputFile, outputFileFormat);
        data = fsExtra.readFileSync(outputFile, "utf8");
        expect(JSON.parse(data)).toEqual(results);
        fsExtra.unlinkSync(outputFile); // Clean up after test
    });

    test("outputResults overwrites expected JSON file with contents", async function() {
        let results = { message: "Test overwrite output" };
        let outputFile = "test_output.json";
        let outputFileFormat = "json";
        await outputResults(results, outputFile, outputFileFormat);
        let data = fsExtra.readFileSync(outputFile, "utf8");
        expect(typeof data).toBe("string");
        expect(data.length).toBeGreaterThan(0);
        expect(JSON.parse(data)).toEqual(results);

        results = { message: "Updated output" };
        await outputResults(results, outputFile, outputFileFormat);
        data = fsExtra.readFileSync(outputFile, "utf8");
        expect(JSON.parse(data)).toEqual(results);
        fsExtra.unlinkSync(outputFile); // Clean up after test
    });


    test("saveCSVFile writes an array of objects to disk and reads back exactly", async function() {
        const results = [
            { name: "alpha", count: 3, active: "true" },
            { name: "beta", count: 7, active: "false" }
        ];
        const outputFile = "test_savecsvfile.csv";
        const expected = 'name,count,active\n"alpha",3,"true"\n"beta",7,"false"';

        await saveCSVFile(results, outputFile);
        const data = fsExtra.readFileSync(outputFile, "utf8");

        expect(data).toBe(expected);

        fsExtra.unlinkSync(outputFile); // Clean up after test
    });

    test("outputResults creates expected CSV file with contents", async function() {
        let results = { message: "Test output" };
        let outputFile = "test_output.csv";
        let outputFileFormat = "csv";
        await outputResults(results, outputFile, outputFileFormat);
        let data = fsExtra.readFileSync(outputFile, "utf8");
        expect(data).toContain("message");
        expect(data).toContain("Test output");
        fsExtra.unlinkSync(outputFile);

        results = [["header1", "header2"], ["item1", "item2"]];
        outputFile = "test_output.csv";
        outputFileFormat = "csv";
        await outputResults(results, outputFile, outputFileFormat);
        data = fsExtra.readFileSync(outputFile, "utf8");
        expect(data).toContain("item1");
        expect(data).toContain("item2");
        fsExtra.unlinkSync(outputFile);
    });

    test("outputResults overwrites expected CSV file with contents", async function() {
        let results = { message: "Test overwrite output" };
        let outputFile = "test_output.csv";
        let outputFileFormat = "csv";
        await outputResults(results, outputFile, outputFileFormat);
        let data = fsExtra.readFileSync(outputFile, "utf8");
        expect(typeof data).toBe("string");
        expect(data.length).toBeGreaterThan(0);
        expect(data).toContain("message");
        expect(data).toContain("Test overwrite output");

        results = { message: "Updated output" };
        await outputResults(results, outputFile, outputFileFormat);
        data = fsExtra.readFileSync(outputFile, "utf8");
        expect(data).toContain("message");
        expect(data).toContain("Updated output");
        fsExtra.unlinkSync(outputFile); // Clean up after test
    });

    test("appendToken correctly appends token to URL", function() {
        let url = "https://example.com/service";
        let token = "abc123";
        let result = appendToken(url, token);
        expect(result).toBe("https://example.com/service?token=abc123");

        url = "https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix?f=json&route=[1,2,3]";
        token = "aapt1234123412341234.1234567890abcdef1234567890abcdef";
        result = appendToken(url, token);
        expect(result).toBe("https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix?f=json&route=%5B1%2C2%2C3%5D&token=aapt1234123412341234.1234567890abcdef1234567890abcdef");

        url = "https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix?f=json&route=[1,2,3]&token=1234123412341234";
        token = "aapt1234123412341234.1234567890abcdef1234567890abcdef";
        result = appendToken(url, token);
        expect(result).toBe("https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix?f=json&route=%5B1%2C2%2C3%5D&token=aapt1234123412341234.1234567890abcdef1234567890abcdef");

        url = "https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix?token=1234123412341234&f=json&route=[1,2,3]";
        token = "aapt1234123412341234.1234567890abcdef1234567890abcdef";
        result = appendToken(url, token);
        expect(result).toBe("https://route-api.arcgis.com/arcgis/rest/services/World/OriginDestinationCostMatrix/NAServer/OriginDestinationCostMatrix_World/solveODCostMatrix?token=aapt1234123412341234.1234567890abcdef1234567890abcdef&f=json&route=%5B1%2C2%2C3%5D");
    });

    test("validateEnvironment correctly normalizes environment strings", function() {
        expect(validateEnvironment("dev")).toBe("dev");
        expect(validateEnvironment("development")).toBe("dev");
        expect(validateEnvironment("prod")).toBe("prod");
        expect(validateEnvironment("production")).toBe("prod");
        expect(validateEnvironment("qa")).toBe("qa");
        expect(validateEnvironment("stg")).toBe("qa");
        expect(validateEnvironment("staging")).toBe("qa");
        expect(validateEnvironment("")).toBe("prod");
        expect(validateEnvironment("unknown")).toBe("prod");
        expect(validateEnvironment()).toBe("prod");
        expect(validateEnvironment(null)).toBe("prod");
        expect(validateEnvironment(0)).toBe("prod");
        expect(validateEnvironment("x")).toBe("prod");
    });
});