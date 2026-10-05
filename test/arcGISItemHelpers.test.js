/**
 * Basic unit tests for the helper functions in arcGISItemHelpers.js. These tests focus on the logic of the helper functions and do not
 * involve any external API calls or file system interactions.
 */
import process from "node:process";
import {
    resolveDomain,
    resolveServicePath,
    resolveFullServicePath,
    privilegeToService,
    getLocationServiceEndpointFromPrivilege,
    getPortalSelfURL
} from "../source/arcGISItemHelpers.js";
import { describe, afterEach, expect, test } from '@jest/globals';

describe("ArcGISItemHelpers helper functions", function() {
    afterEach(function() {
        delete process.env.ARCGIS_TOKEN;
        delete process.env.ARCGIS_ITEM_ID;
    });

    test("resolveDomain returns correct domain for each environment", function() {
        expect(resolveDomain("basemaps", "prod")).toBe("basemaps-api.arcgis.com");
        expect(resolveDomain("basemaps")).toBe("basemaps-api.arcgis.com");
        expect(resolveDomain("basemaps", "dev")).toBe("basemapsdev-api.arcgis.com");
        expect(resolveDomain("basemaps", "qa")).toBe("basemaps-api.arcgis.com");
        expect(resolveDomain("nonexistent", "prod")).toBe("www.arcgis.com");
        expect(resolveDomain("", "dev")).toBe("www.arcgis.com");
        expect(resolveDomain(null, "prod")).toBe("www.arcgis.com");
        expect(resolveDomain("geocode", "prod")).toBe("geocode-api.arcgis.com");
    });

    test("resolveServicePath returns correct path for each service", function() {
        expect(resolveServicePath("basemaps")).toContain("World_Basemap_v2");
        expect(resolveServicePath("geocode")).toContain("GeocodeServer");
        expect(resolveServicePath("nonexistent")).toBe("");
        expect(resolveServicePath("")).toBe("");
        expect(resolveServicePath(null)).toBe("");
    });

    test("resolveFullServicePath returns correct full path for each service", function() {
        expect(resolveFullServicePath("basemaps", "prod")).toBe("https://basemaps-api.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/10/507/807");
        expect(resolveFullServicePath("geocode", "prod")).toContain("https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
        expect(resolveFullServicePath("nonexistent", "prod")).toBe("https://www.arcgis.com");
        expect(resolveFullServicePath("", "prod")).toBe("https://www.arcgis.com");
        expect(resolveFullServicePath(null, "prod")).toBe("https://www.arcgis.com");
    });

    test("privilegeToService returns correct service for each privilege", function() {
        expect(privilegeToService("premium:user:basemaps")).toBe("basemap-styles");
        expect(privilegeToService("premium:user:geocode")).toBe("geocode");
        expect(privilegeToService("premium:user:geocode:temporary")).toBe("geocode");
        expect(privilegeToService("portal:nonexistent:edit")).toBe(null);
        expect(function() {
            privilegeToService(42);
        }).toThrow("A single ArcGIS privilege string or an array of privileges is required to get the service domain.");
    });

    test("getLocationServiceEndpointFromPrivilege returns correct endpoint for each privilege", function() {
        expect(getLocationServiceEndpointFromPrivilege("premium:user:basemaps")).toBe("https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/navigation");
        expect(getLocationServiceEndpointFromPrivilege("premium:user:geocode")).toBe("https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
        expect(getLocationServiceEndpointFromPrivilege("portal:nonexistent:edit")).toBe("https://www.arcgis.com");
        expect(function() {
            getLocationServiceEndpointFromPrivilege(42);
        }).toThrow("A single ArcGIS privilege string or an array of privileges is required to get the service endpoint.");
    });

    test("getPortalSelfURL returns correct URL with and without token", function() {
        expect(getPortalSelfURL("prod")).toBe("https://www.arcgis.com/sharing/rest/portals/self?f=json");
        expect(getPortalSelfURL("prod", "myToken")).toBe("https://www.arcgis.com/sharing/rest/portals/self?f=json&token=myToken");
        expect(getPortalSelfURL("dev")).toBe("https://devext.arcgis.com/sharing/rest/portals/self?f=json");
        expect(getPortalSelfURL("dev", "myToken")).toBe("https://devext.arcgis.com/sharing/rest/portals/self?f=json&token=myToken");
        expect(getPortalSelfURL("qa")).toBe("https://qaext.arcgis.com/sharing/rest/portals/self?f=json");
        expect(getPortalSelfURL("qa", "myToken")).toBe("https://qaext.arcgis.com/sharing/rest/portals/self?f=json&token=myToken");
        expect(getPortalSelfURL("zzz")).toBe("https://www.arcgis.com/sharing/rest/portals/self?f=json");
        expect(getPortalSelfURL("zzz", "myToken")).toBe("https://www.arcgis.com/sharing/rest/portals/self?f=json&token=myToken");
    });
});
