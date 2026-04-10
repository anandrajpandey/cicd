import test from "node:test";
import assert from "node:assert/strict";

import { assertAuditPayloadInsertOnly, createAuditUpdateAttempt } from "../dist/index.js";

test("audit payload custom type throws for update attempts", async () => {
  assert.throws(() => {
    assertAuditPayloadInsertOnly(createAuditUpdateAttempt());
  }, /append-only/);
});

test("audit payload custom type passes through normal inserts", async () => {
  const payload = { action: "decision.produced", value: 42 };

  assert.deepEqual(assertAuditPayloadInsertOnly(payload), payload);
});
