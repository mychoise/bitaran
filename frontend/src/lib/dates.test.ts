import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, formatDate, formatDateTime, formatTime, nepalDateOf, nepalInstant, todayNepal } from "./dates.ts";

test("business dates follow Nepal, not UTC", () => {
  // 20:00 UTC on 13 Oct is 01:45 on 14 Oct in Nepal (UTC+05:45)
  assert.equal(nepalDateOf("2026-10-13T20:00:00Z"), "2026-10-14");
  assert.equal(nepalDateOf("2026-10-13T18:14:00Z"), "2026-10-13");
  assert.equal(todayNepal(new Date("2026-10-13T18:15:00Z")), "2026-10-14");
});

test("shows dates in AD and times in Nepal time", () => {
  assert.equal(formatDate("2026-10-14"), "14 Oct 2026");
  assert.equal(formatTime("2026-10-14T08:20:00Z"), "14:05");
  assert.equal(formatDateTime("2026-10-14T08:20:00Z"), "14 Oct 2026, 14:05");
});

test("calendar arithmetic", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-10-01", "2026-10-15"), 14);
});

test("a Nepal clock time becomes the right instant", () => {
  assert.equal(nepalInstant("2026-10-14", "09:30"), "2026-10-14T03:45:00.000Z");
});

test("rejects malformed dates", () => {
  assert.throws(() => formatDate("14/10/2026"));
});
