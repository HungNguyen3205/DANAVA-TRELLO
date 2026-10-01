# DANAVA WORK

React + TypeScript + Vite workspace for a Vietnamese team. Includes Kanban and list views, task forms, assignees/collaborators, due dates, priority filters, editable checklists and comments, column management, activity history, responsive navigation, and light/dark/system themes.

## Run on Windows

Use Node.js **22.12+ or 24 LTS**. From PowerShell:

```powershell
cd D:\NamHung\Projects\Code\Trello
npm ci
npm run dev
```

Open the URL printed by Vite. Production build: `npm run build`; preview: `npm run preview`.

## Two explicit modes

**Demo** (no environment configured): interactive sample board held in memory. The banner explicitly warns that reload resets tasks. Only theme preferences are stored on the device. No mock login or successful cloud-save messages are shown.

**Shared boards** (Supabase configured): email/password authentication, server-backed data, owner-managed editor/viewer access, transactional saves with version checks, and Realtime updates. Polling every 30 seconds is a fallback. Signup email confirmation follows your Supabase project settings.

## Configure shared data

1. Create a Supabase project.
2. Run `supabase/migrations/202610010001_workspace.sql` once in its SQL Editor. It creates tables, RLS policies and checked write functions, with no demo seeds.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and the project's **publishable/anon** key. Never use a secret/service-role key in the browser.
4. Restart Vite. Sign up and confirm your email if required. Sign in and create a private empty board.
5. In **Thành viên**, add names to the assignment roster. Separately grant access to each teammate's email. Teammates register/sign in with that email to see the board. This access operation does **not** send an email invitation.
6. Optionally enable `public.workspaces` in Database > Publications (`supabase_realtime`). Without it, foreground polling still works.
7. Set your deployment's Supabase environment variables before building. For SPA hosting, rewrite unknown routes to `index.html`.

## Permissions and scope

- Owner: edit boards, maintain the assignment roster, grant/revoke editor/viewer access.
- Editor: edit the entire board and its roster.
- Viewer: read tasks and activity only; SQL RPCs reject writes.
- Assignment roster names are **not authentication accounts** and do not grant access.
- Access is checked through RLS and security-definer RPCs; direct client inserts/updates/deletes are revoked.
- Saving uses an expected version. Concurrent edits produce a conflict instead of overwriting silently; reload the board and reapply the retained draft as appropriate.
- Server history preserves old events and records the authenticated author/time for each save.
- These are board-level roles. Per-task employee restrictions, a separate manager role, attachments/uploads and notifications are not implemented in this branch.
- Checklist/comment edits are committed together when **Lưu công việc** is pressed. Closing without saving discards the draft.

## Keyboard and mobile

Open a task with its card button. Change status in the task form on mobile. Drag only from a grip handle; card content remains scrollable/tappable. On a focused grip, Space begins dragging, arrow keys move, Escape cancels. Filtering disables dragging to avoid ambiguous placement among hidden tasks.

Date-only deadlines use the Vietnam calendar day. Completion is a property of the column and works with renamed/custom columns.

## Checks

```sh
npm run build
npm run lint
node --experimental-strip-types tests/board.test.ts
```

`tests/board.test.ts` checks immutable moves, empty-column placement, invalid drop targets and date/completion behavior. Build and frontend browser checks can run without Supabase; cloud authorization and concurrency require a configured test project and two authenticated users. See `supabase/TESTING.md` for that checklist.
