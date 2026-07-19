-- Deterministic identities for database integration and RLS tests only.
-- These rows have no passwords and cannot sign in through Supabase Auth.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'member-one@test.offerlab.invalid',
    '',
    '2026-07-19 00:00:00+00',
    '{"provider":"email","providers":["email"]}',
    '{}',
    '2026-07-19 00:00:00+00',
    '2026-07-19 00:00:00+00',
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'member-two@test.offerlab.invalid',
    '',
    '2026-07-19 00:00:00+00',
    '{"provider":"email","providers":["email"]}',
    '{}',
    '2026-07-19 00:00:00+00',
    '2026-07-19 00:00:00+00',
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into app."user" (id, auth_user_id, email)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'member-one@test.offerlab.invalid'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'member-two@test.offerlab.invalid'
  )
on conflict (id) do nothing;
