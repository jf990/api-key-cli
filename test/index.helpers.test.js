/**
 * Basic unit tests for helper functions in index.js. These tests focus on the logic of the helper functions and do not involve any external API calls or file system interactions.
 */
import fsExtra from "fs-extra";
import {
    getAccessTokenParameter,
    getItemIDParameter,
    isEmpty,
    dateFromOptions,
    localDateFormat,
    isNumeric,
    normalizeItemType,
    appendToken,
    outputResults
} from "../source/utils.js";

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
});