import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`);
await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;
insert into auth.users values ('00000000-0000-4000-8000-000000000001','owner@example.test'),('00000000-0000-4000-8000-000000000002','member@example.test');`);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/202610010001_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function asUser(id, email) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, email }),
  ]);
  await db.exec("set role authenticated");
}
const owner = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002";
const board = {
  title: "Test",
  columns: [{ id: "a", title: "A" }],
  tasks: [],
  users: [],
  activity: [],
};
await asUser(owner, "owner@example.test");
const created = await db.query(
  "select public.create_workspace($1,$2::jsonb) as id",
  ["Test", JSON.stringify(board)],
);
const id = created.rows[0].id;
assert.equal(
  (await db.query("select * from public.workspaces")).rows.length,
  1,
);
await asUser(member, "member@example.test");
assert.equal(
  (await db.query("select * from public.workspaces")).rows.length,
  0,
);
await assert.rejects(
  db.query("select public.save_board($1,1,$2::jsonb)", [
    id,
    JSON.stringify(board),
  ]),
  /FORBIDDEN/,
);
await asUser(owner, "owner@example.test");
await db.query("select public.set_workspace_member($1,$2,$3)", [
  id,
  "member@example.test",
  "viewer",
]);
await asUser(member, "member@example.test");
assert.equal(
  (await db.query("select * from public.workspaces")).rows.length,
  1,
);
await assert.rejects(
  db.query("select public.save_board($1,1,$2::jsonb)", [
    id,
    JSON.stringify(board),
  ]),
  /FORBIDDEN/,
);
await assert.rejects(
  db.query("update public.workspaces set version=99 where id=$1", [id]),
  /permission denied/,
);
await asUser(owner, "owner@example.test");
await db.query("select public.set_workspace_member($1,$2,$3)", [
  id,
  "member@example.test",
  "editor",
]);
await asUser(member, "member@example.test");
await db.query("select public.save_board($1,1,$2::jsonb)", [
  id,
  JSON.stringify({
    ...board,
    activity: [{ text: "Test edit", author: "fake" }],
  }),
]);
await assert.rejects(
  db.query("select public.save_board($1,1,$2::jsonb)", [
    id,
    JSON.stringify(board),
  ]),
  /CONFLICT/,
);
await assert.rejects(
  db.query("select public.set_workspace_member($1,$2,$3)", [
    id,
    "other@example.test",
    "editor",
  ]),
  /FORBIDDEN/,
);
const saved = (await db.query("select * from public.workspaces")).rows[0];
assert.equal(saved.data.activity[0].author, "member@example.test");
await asUser(owner, "owner@example.test");
await db.query("select public.save_board($1,2,$2::jsonb)", [
  id,
  JSON.stringify(board),
]);
const history = (await db.query("select data from public.workspaces")).rows[0]
  .data.activity;
assert.equal(history.length, 2);
assert.equal(history[1].author, "member@example.test");
await assert.rejects(
  db.query("select public.set_workspace_member($1,$2,$3)", [
    id,
    "owner@example.test",
    "viewer",
  ]),
  /CANNOT_CHANGE_OWNER/,
);
await db.query("select public.set_workspace_member($1,$2,$3)", [
  id,
  "member@example.test",
  "remove",
]);
await asUser(member, "member@example.test");
assert.equal(
  (await db.query("select * from public.workspaces")).rows.length,
  0,
);
console.log(
  "Postgres migration, RLS, viewer/editor writes, version conflicts, history and revocation passed.",
);
await db.close();
