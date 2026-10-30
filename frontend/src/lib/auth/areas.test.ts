import { test } from "node:test";
import assert from "node:assert/strict";
import { canOpen, landingFor } from "./areas.ts";
import type { Profile } from "./types.ts";

const staff = (role: "owner" | "manager" | "salesman"): Profile => ({ id: "u", type: "staff", role, fullName: "T", businessName: "B" });
const shop: Profile = { id: "s", type: "shop", name: "S", businessName: "B" };

test("each person opens only their own area", () => {
  assert.equal(canOpen("/app/manager/staff", staff("manager")), true);
  assert.equal(canOpen("/app/manager", staff("salesman")), false);
  assert.equal(canOpen("/app/salesman", staff("salesman")), true);
  assert.equal(canOpen("/app/shop", staff("owner")), false);
  assert.equal(canOpen("/app/shop/statement", shop), true);
  assert.equal(canOpen("/app/change-password", shop), true);
  assert.equal(landingFor(staff("owner")), "/app/manager");
  assert.equal(landingFor(shop), "/app/shop");
});

test("business settings are for the owner only", () => {
  assert.equal(canOpen("/app/manager/settings", staff("owner")), true);
  assert.equal(canOpen("/app/manager/settings/", staff("owner")), true);
  assert.equal(canOpen("/app/manager/settings", staff("manager")), false);
  assert.equal(canOpen("/app/manager/settings-other", staff("manager")), true, "only the settings section itself");
});
