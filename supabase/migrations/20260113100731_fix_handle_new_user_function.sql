/*
  # Fix handle_new_user Function

  The previous migration incorrectly referenced an 'email' column in the profiles table
  that doesn't exist. This migration fixes the function to only insert existing columns.

  ## Changes
  - Corrects the handle_new_user function to match the profiles table schema
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;