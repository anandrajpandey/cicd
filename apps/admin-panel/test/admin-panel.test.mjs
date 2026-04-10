import test from "node:test";
import assert from "node:assert/strict";

import { canAccess } from "../src/lib/rbac.ts";
import { appRouter } from "../src/lib/trpc.ts";
import DashboardPage from "../src/app/page.tsx";
import IncidentsPage from "../src/app/incidents/page.tsx";
import { createRealtimeClient } from "../src/realtime.ts";

test("RBAC grants access by role and area", async () => {
  assert.equal(canAccess("Admin", "settings"), true);
  assert.equal(canAccess("Viewer", "settings"), false);
  assert.equal(canAccess("Approver", "approvals"), true);
});

test("tRPC incidents list returns seeded incident data", async () => {
  const caller = appRouter.createCaller({});
  const incidents = await caller.incidents.list();

  assert.ok(Array.isArray(incidents));
  assert.ok(incidents.length > 0);
  assert.equal(incidents[0].repository.includes("acme/"), true);
});

test("dashboard and incidents pages are defined components", async () => {
  assert.equal(typeof DashboardPage, "function");
  assert.equal(typeof IncidentsPage, "function");
});

test("realtime client is created with websocket transport disabled by default connect", async () => {
  const client = createRealtimeClient("http://localhost:4000");

  assert.equal(client.active, false);
  client.close();
});
