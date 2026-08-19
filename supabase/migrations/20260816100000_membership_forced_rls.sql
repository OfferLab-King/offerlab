begin;

-- Enforce row-level security on the membership entitlement table.
--
-- The application role offerlab_app connects through the runtime login and is
-- never a table owner, so RLS already applies to it; FORCE closes the owner
-- bypass and makes the "forced RLS" invariant (already stated in the table
-- comment) true in the database itself. Member self-serve activation remains
-- possible only when the application layer permits it (local/test), and
-- production activation goes through the privileged membership CLI.

alter table app.membership force row level security;

commit;