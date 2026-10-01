# Shared-board acceptance checks

These checks require a Supabase test project with the migration applied. Do not use real customer data.

1. With account A, create a board. With unrelated account B, verify that selecting the board via REST returns no rows and `save_board` returns FORBIDDEN, even with the correct UUID.
2. A grants B viewer access. B can read but cannot call save_board or set_workspace_member. Direct table writes must fail too.
3. A changes B to editor. B saves a task successfully but cannot change membership.
4. Open the same board version as A and B. A saves. B saves the old expected_version. Expect CONFLICT, not a lost update. Verify the draft remains in the form.
5. Enable Realtime, update the board, and verify the other browser refreshes. Without Realtime, wait for the foreground 30-second refresh.
6. A removes B's membership. B must no longer read or save the board. Owner permissions must not be modifiable through set_workspace_member.
7. Submit a modified activity history in save_board. Verify older history is preserved and the new event uses the authenticated email and server timestamp.
8. Log out and back in, reload, and open another device. Saved tasks, ordering, checklist and comments must persist.

This branch does not claim these cloud checks have passed without an actual configured backend.
