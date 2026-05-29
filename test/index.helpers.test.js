/**
 * Basic unit tests for helper functions in index.js. These tests focus on the logic of the helper functions and do not involve any external API calls or file system interactions.
 */
import {
    getAccessTokenParameter,
    getItemIDParameter,
    isEmpty,
    dateFromOptions,
    localDateFormat,
    isNumeric,
    normalizeItemType
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
        expect(isEmpty("value")).toBe(false);
        expect(isEmpty([1])).toBe(false);
        expect(isEmpty({ a: 1 })).toBe(false);
    });

    test("isNumeric detects numeric strings and numbers", function() {
        expect(isNumeric("12.5")).toBe(true);
        expect(isNumeric(42)).toBe(true);
        expect(isNumeric("abc")).toBe(false);
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
});