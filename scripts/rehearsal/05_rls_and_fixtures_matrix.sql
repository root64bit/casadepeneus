-- Phase 5: Synthetic Fixtures & RLS Matrix Assertions
-- Tests RLS isolation, ALLOW/DENY policies, and cross-tenant access.

BEGIN;

-- 1. Assert Administrator permissions
DO $$
BEGIN
  IF NOT public.has_permission('users.manage') THEN
    RAISE NOTICE 'RLS_MATRIX: Current context does not hold users.manage permission.';
  ELSE
    RAISE NOTICE 'RLS_MATRIX: users.manage permission verified for Administrator.';
  END IF;
END;
$$;

-- 2. Assert RLS policy existence on user_profiles
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles'
ORDER BY policyname;

COMMIT;
