import { test } from "node:test";
import assert from "node:assert/strict";
import { cartonEquivalent, countUnits, plural } from "./units.ts";

test("unit names in words", () => {
  assert.equal(plural("packet"), "packets");
  assert.equal(plural("box"), "boxes");
  assert.equal(plural("pouch"), "pouches");
  assert.equal(countUnits(1, "bottle"), "1 bottle");
  assert.equal(countUnits(240000, "packet"), "2,40,000 packets");
  assert.equal(countUnits(-6, "bar"), "-6 bars");
});

test("carton equivalent beside base units", () => {
  assert.equal(cartonEquivalent(480, 24, "cup"), "20 cartons");
  assert.equal(cartonEquivalent(65, 24, "cup"), "2 cartons + 17 cups");
  assert.equal(cartonEquivalent(25, 24, "cup"), "1 carton + 1 cup");
  assert.equal(cartonEquivalent(10, 24, "cup"), "less than a carton");
  assert.equal(cartonEquivalent(0, 24, "cup"), "0 cartons");
  assert.equal(cartonEquivalent(10, null, "cup"), null);
});
