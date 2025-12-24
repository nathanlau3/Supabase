select vault.create_secret(
  'http://api.supabase.internal:8000',
  'supabase_url'
);

-- Seed test user for development
-- Email: admin@gmail.com
-- Password: admin123
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@gmail.com',
  crypt('admin123', gen_salt('bf')),
  current_timestamp,
  current_timestamp,
  current_timestamp,
  '{"provider":"email","providers":["email"]}',
  '{}',
  current_timestamp,
  current_timestamp,
  '',
  '',
  '',
  ''
);

-- Create identity for the user
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) select
  gen_random_uuid(),
  id,
  id::text,
  format('{"sub":"%s","email":"%s"}', id::text, email)::jsonb,
  'email',
  current_timestamp,
  current_timestamp,
  current_timestamp
from auth.users
where email = 'admin@gmail.com';
