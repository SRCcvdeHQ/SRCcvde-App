import { test } from "node:test";
import assert from "node:assert/strict";
import { hasActiveAccess } from "../supabase/functions/_shared/access-policy.ts";
import {
  validateIntake,
  readBoundedJson,
  budgets,
  timelines,
} from "../supabase/functions/_shared/intake-validation.ts";

test("account access fails closed and staff requires MFA", () => {
  for (const role of ["owner", "admin", "staff"]) {
    assert.equal(hasActiveAccess({ role, status: "active" }, "aal1"), false);
    assert.equal(hasActiveAccess({ role, status: "active" }, "aal2"), true);
    assert.equal(hasActiveAccess({ role, status: "suspended" }, "aal2"), false);
  }
  assert.equal(hasActiveAccess(null, "aal2"), false);
  assert.equal(
    hasActiveAccess({ role: "unknown", status: "active" }, "aal2"),
    false,
  );
  assert.equal(
    hasActiveAccess({ role: "client", status: "active" }, "aal1"),
    true,
  );
  assert.equal(
    hasActiveAccess({ role: "client", status: "suspended" }, "aal1"),
    false,
  );
});
test("all advertised budget and timeline combinations validate; malformed fields fail", () => {
  const input = {
    name: "Test User",
    email: "TEST@example.test",
    project_type: "Website",
    details: "This description is long enough to submit.",
  };
  for (const budget_range of budgets)
    for (const timeline of timelines) {
      assert.equal(
        validateIntake({ ...input, budget_range, timeline }).email,
        "test@example.test",
      );
    }
  assert.throws(
    () => validateIntake({ ...input, name: "x".repeat(121) }),
    /too long/,
  );
  assert.throws(() => validateIntake({ ...input, email: {} }), /Invalid email/);
  assert.throws(
    () => validateIntake({ ...input, budget_range: "Under $2,500" }),
    /Invalid budget/,
  );
});
test("body limit uses actual bytes, not Content-Length; rejects null and arrays", async () => {
  const request = (body) =>
    new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  await assert.rejects(readBoundedJson(request("null")), /Invalid request/);
  await assert.rejects(readBoundedJson(request("[]")), /Invalid request/);
  await assert.rejects(
    readBoundedJson(request(JSON.stringify({ details: "x".repeat(20_001) }))),
    /Request too large/,
  );
  assert.deepEqual(await readBoundedJson(request('{"name":"test"}')), {
    name: "test",
  });
});
