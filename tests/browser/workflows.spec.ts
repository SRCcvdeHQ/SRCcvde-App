import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const uid = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";
const project = "pszxarjungpoqvbwoblf";

// Synthetic browser sessions only. Every Supabase request is intercepted; these
// tests never log in to production, send mail, sign agreements or take payments.
async function session(
  page: Page,
  role = "client",
  aal = "aal1",
  status = "active",
) {
  const user = {
    id: uid,
    email: "fixture@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({ sub: uid, role: "authenticated", aal, exp, amr: [] }),
    ).toString("base64url"),
    "synthetic",
  ].join(".");
  await page.addInitScript(
    ({ project, token, user, exp }) => {
      localStorage.setItem(
        `sb-${project}-auth-token`,
        JSON.stringify({
          access_token: token,
          refresh_token: "synthetic",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { project, token, user, exp },
  );
  await page.route("**/*.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith("/app_memberships")) data = { role, status };
    if (path.endsWith("/profiles"))
      data = { full_name: "Fixture User", email: user.email };
    if (path.endsWith("/client_memberships")) data = [{ client_id: clientId }];
    if (path.endsWith("/auth/v1/user")) data = { ...user, factors: [] };
    await route.fulfill({ json: data });
  });
}

test.beforeEach(async ({ page }) => {
  // Block nonlocal services by default, including unexpected provider calls.
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1")
      return route.continue();
    return route.abort();
  });
});

test("sign-in and inactive recovery links are accessible", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Enter your email first.",
  );
  await page.goto("/set-password");
  await expect(
    page.getByRole("heading", { name: "This password link isn't active." }),
  ).toBeVisible();
});

test("suspended members cannot open workspace features", async ({ page }) => {
  await session(page, "client", "aal1", "suspended");
  await page.goto("/billing");
  await expect(
    page.getByText(
      "does not have an active SRCcvde workspace membership yet.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Invoices & payments" }),
  ).toHaveCount(0);
});

test("staff AAL1 is gated by MFA", async ({ page }) => {
  await session(page, "owner");
  await page.goto("/billing");
  await expect(
    page.getByRole("heading", { name: "Verify your staff account." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Set up authenticator" }),
  ).toBeVisible();
});

test("billing failure shows retry instead of a settled balance", async ({
  page,
}) => {
  await session(page);
  let fail = true;
  await page.route("**/rest/v1/billing_invoices?**", (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { message: "Synthetic failure" } : [],
    }),
  );
  await page.goto("/billing");
  await expect(page.getByRole("alert")).toContainText(
    "Could not load your billing information.",
    { timeout: 20000 }, // The Supabase client retries transient 503 responses.
  );
  await expect(page.getByText("You're all paid up.")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("You're all paid up.")).toBeVisible();
});

test("unavailable document gives a recoverable error", async ({ page }) => {
  await session(page);
  await page.route("**/rest/v1/signature_requests?**", (route) =>
    route.fulfill({ status: 404, json: { message: "Not found" } }),
  );
  await page.goto("/documents/00000000-0000-4000-8000-000000000003");
  await expect(
    page.getByRole("heading", { name: "Document unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "This document could not be opened.",
  );
  await expect(
    page.getByRole("button", { name: "Back to documents" }),
  ).toBeVisible();
});

test("document library can recover from a failed request", async ({ page }) => {
  await session(page);
  let fail = true;
  await page.route("**/rest/v1/rpc/get_client_document_library", (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { message: "Synthetic failure" } : [],
    }),
  );
  await page.goto("/documents");
  await expect(page.getByRole("alert")).toContainText(
    "Could not load your documents.",
  );
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("0 of 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
