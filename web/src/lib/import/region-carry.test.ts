import assert from "node:assert/strict";
import { test } from "node:test";
import {
  currentSectionRegion,
  isRegionBannerRow,
  isRegionSectionRow,
  isRepeatedSectionHeaderRow,
  regionBannerValue,
  sectionHeaderRegion,
  withInheritedRegion,
} from "./region-carry";

const headers = ["Region", "DEO", "Municipality", "Barangay", "Road Name"];
const sheetHeaders = ["DEO", "Links", "Region", "Barangay", "Road Name", "Municipality/City"];

function sectionHeader(region: string) {
  return {
    DEO: "DEO",
    Links: "Links",
    Region: region,
    Barangay: "Barangay",
    "Road Name": "Road Name",
    "Municipality/City": "Municipality/City",
  };
}

function location(overrides: Record<string, string> = {}) {
  return {
    DEO: "Biliran DEO",
    Links: "",
    Region: "",
    Barangay: "Bato",
    "Road Name": "Biliran Circumferential Road",
    "Municipality/City": "Biliran",
    ...overrides,
  };
}

test("detects region banner rows including BARMM and NEGROS ISLAND REGION", () => {
  assert.equal(isRegionBannerRow(headers, { Region: "Region VIII", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }), true);
  assert.equal(isRegionBannerRow(headers, { Region: "Region X", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }), true);
  assert.equal(isRegionBannerRow(headers, { Region: "REGION XI", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }), true);
  assert.equal(isRegionBannerRow(headers, { Region: "NEGROS ISLAND REGION", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }), true);
  assert.equal(isRegionBannerRow(headers, { Region: "BARMM", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }), true);
  assert.equal(regionBannerValue(headers, { Region: "BARMM", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }), "BARMM");
  assert.equal(
    regionBannerValue(headers, { Region: "NEGROS ISLAND REGION", DEO: "", Municipality: "", Barangay: "", "Road Name": "" }),
    "NEGROS ISLAND REGION",
  );
});

test("detects repeated section-header rows and reads their Region cell", () => {
  const cases: Array<[string, string]> = [
    ["REGION IV-A", "CALABARZON"],
    ["Region V", "Region V"],
    ["Region VII", "Region VII"],
    ["Region VIII", "Region VIII"],
    ["Region IX", "Region IX"],
    ["Region X", "Region X"],
    ["REGION XI", "Region XI"],
    ["NEGROS ISLAND REGION", "NEGROS ISLAND REGION"],
    ["BARMM", "BARMM"],
    ["Region XIII", "Region XIII"],
    ["MIMAROPA", "MIMAROPA"],
  ];
  for (const [rawRegion, expected] of cases) {
    const row = sectionHeader(rawRegion);
    assert.equal(isRepeatedSectionHeaderRow(sheetHeaders, row), true, rawRegion);
    assert.equal(isRegionSectionRow(sheetHeaders, row), true, rawRegion);
    assert.equal(sectionHeaderRegion(sheetHeaders, row), expected, rawRegion);
    assert.equal(currentSectionRegion(sheetHeaders, row), expected, rawRegion);
  }
});

test("skips a BARMM section header even when the Region cell is empty", () => {
  const row = sectionHeader("");
  assert.equal(isRepeatedSectionHeaderRow(sheetHeaders, row), true);
  assert.equal(sectionHeaderRegion(sheetHeaders, row), null);
});

test("does not treat a location row as a region banner or section header", () => {
  assert.equal(
    isRegionBannerRow(headers, {
      Region: "",
      DEO: "Biliran DEO",
      Municipality: "Naval",
      Barangay: "Agpangi",
      "Road Name": "Biliran Circumferential Road",
    }),
    false,
  );
  assert.equal(isRepeatedSectionHeaderRow(sheetHeaders, location()), false);
  assert.equal(isRegionSectionRow(sheetHeaders, location()), false);
  assert.equal(
    isRepeatedSectionHeaderRow(
      sheetHeaders,
      location({ DEO: "DEO", "Municipality/City": "Boac", Barangay: "Tampus", "Road Name": "Marinduque Circumferential Road" }),
    ),
    false,
  );
});

test("inherits region without changing raw_data", () => {
  const raw = location();
  const inherited = withInheritedRegion(sheetHeaders, raw, "Region VIII");
  assert.equal(inherited.inherited, true);
  assert.equal(inherited.mapped.region, "Region VIII");
  assert.equal(raw.Region, "");
});

test("keeps an explicit Region on a location row instead of inheriting", () => {
  const raw = location({ Region: "BARMM" });
  const inherited = withInheritedRegion(sheetHeaders, raw, "Region VIII");
  assert.equal(inherited.inherited, false);
  assert.equal(inherited.mapped.region, "BARMM");
});
