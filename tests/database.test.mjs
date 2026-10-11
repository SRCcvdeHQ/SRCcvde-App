import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("restored schema enforces suspension, tenant isolation, MFA, and atomic intake", async () => {
  const db = new PGlite();
  try {
    // Supabase-managed auth/storage/Vault stand-ins: no production data or network calls.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage; create schema vault; create schema extensions;
      create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    `);
    await db.exec(`
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      create table vault.decrypted_secrets(id uuid, name text, decrypted_secret text);
      grant usage on schema auth,storage to anon,authenticated,service_role;
      grant all on storage.objects to authenticated,service_role;
    `);
    let baseline = await readFile("supabase/baseline/schema.sql", "utf8");
    // PGlite lacks the managed extensions; their routines aren't exercised in these tests.
    baseline = baseline.replace(/^create extension.*;$/gm, "");
    await db.exec(baseline);
    const migration = (await readdir("supabase/migrations")).find((f) =>
      f.endsWith("_enforce_active_access_and_atomic_intake.sql"),
    );
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    const a = "00000000-0000-4000-8000-000000000001",
      b = "00000000-0000-4000-8000-000000000002";
    const staff = "00000000-0000-4000-8000-000000000003";
    await db.exec(
      `alter table auth.users disable trigger on_auth_user_created_src_app;`,
    );
    await db.query(
      `insert into auth.users(id,email) values($1,'a@example.test'),($2,'b@example.test'),($3,'staff@example.test')`,
      [a, b, staff],
    );
    await db.query(
      `insert into public.app_memberships(user_id,role,status) values($1,'client','active'),($2,'client','active'),($3,'owner','active')`,
      [a, b, staff],
    );
    const { rows: clients } = await db.query(
      `insert into public.clients(name,primary_contact_name,primary_email) values('Client A','Person A','a@example.test'),('Client B','Person B','b@example.test') returning id`,
    );
    await db.query(
      `insert into public.client_memberships(user_id,client_id) values($1,$2),($3,$4)`,
      [a, clients[0].id, b, clients[1].id],
    );
    // Disable notification triggers only for fixture setup (no push processing in this runtime).
    await db.exec(`alter table public.client_documents disable trigger user`);
    const { rows: docs } = await db.query(
      `insert into public.client_documents(client_id,name,state,client_visible) values($1,'A visible','draft',true),($1,'A private','draft',false),($2,'B visible','draft',true) returning id`,
      [clients[0].id, clients[1].id],
    );
    async function asUser(id, aal, fn) {
      await db.query(`select set_config('request.jwt.claims',$1,false)`, [
        JSON.stringify({ sub: id, role: "authenticated", aal }),
      ]);
      await db.exec("set role authenticated");
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
      }
    }
    const library = () =>
      db.query("select public.get_client_document_library() as library");
    const readDocs = () => db.query("select id from public.client_documents");
    assert.equal((await asUser(a, "aal1", readDocs)).rows.length, 1);
    assert.equal(
      (await asUser(a, "aal1", library)).rows[0].library[0].document.id,
      docs[0].id,
    );
    assert.equal((await asUser(b, "aal1", readDocs)).rows[0].id, docs[2].id);
    await db.query(
      `update public.app_memberships set status='suspended' where user_id=$1`,
      [a],
    );
    assert.equal((await asUser(a, "aal1", readDocs)).rows.length, 0);
    await assert.rejects(asUser(a, "aal1", library), /Active account/);
    assert.equal((await asUser(staff, "aal1", readDocs)).rows.length, 0);
    assert.equal((await asUser(staff, "aal2", readDocs)).rows.length, 3);
    await db.exec("set role anon");
    await assert.rejects(
      db.query(`select public.set_client_portal_access($1,false)`, [
        clients[0].id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        `select public.submit_intake_atomic('{}', $1,gen_random_uuid())`,
        ["a".repeat(64)],
      ),
      /permission denied/,
    );
    await db.exec("reset role");
    const input = {
      name: "Test User",
      email: "test@example.test",
      company: "",
      project_type: "Website",
      budget_range: "$100–$300",
      timeline: "1-2 weeks",
      involvement: "Collaborative",
      details: "A meaningful project description for testing.",
    };
    const submit = async (i = 0) =>
      (
        await db.query(
          `select public.submit_intake_atomic($1,$2,gen_random_uuid()) as result`,
          [{ ...input, details: input.details + i }, "b".repeat(64)],
        )
      ).rows[0].result;
    assert.equal((await submit()).ok, true);
    assert.equal((await submit()).duplicate, true);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => submit(i + 1)),
    );
    assert.equal(results.filter((r) => r.ok).length, 4);
    assert.equal(results.filter((r) => r.rate_limited).length, 6);
    assert.equal(
      (
        await db.query(
          `select count(*)::int as n from public.project_inquiries where ip_hash=$1`,
          ["b".repeat(64)],
        )
      ).rows[0].n,
      5,
    );
  } finally {
    await db.close();
  }
});
