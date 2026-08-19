begin;

-- Force row-level security on the job lifecycle event table.
--
-- The table already enables RLS and its policies are role-scoped (admin read,
-- crawler write); FORCE closes the table-owner bypass for the same reason as
-- the membership table: the documented invariant is that member-owned and
-- operational data tables always run with forced RLS.

alter table app.job_event force row level security;

commit;