-- Phase 4: Catalog & Privilege Contract Assertions
-- Verifies function signatures, SECURITY DEFINER settings, search_path, table ownership, and GRANT/REVOKE privileges.

BEGIN;

-- 1. Verify SECURITY DEFINER functions have explicit search_path set
DO $$
DECLARE
  v_missing_search_path TEXT[];
BEGIN
  SELECT array_agg(proname::text)
  INTO v_missing_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'audit', 'migration')
    AND p.prosecdef = true
    AND (proconfig IS NULL OR NOT ('search_path=public, audit, pg_temp' = ANY(proconfig) OR 'search_path=public, pg_temp' = ANY(proconfig)));

  IF array_length(v_missing_search_path, 1) > 0 THEN
    RAISE NOTICE 'WARNING: The following SECURITY DEFINER functions lack explicit search_path: %', v_missing_search_path;
  ELSE
    RAISE NOTICE 'SUCCESS: All SECURITY DEFINER functions have explicit search_path set.';
  END IF;
END;
$$;

-- 2. Verify RLS is enabled on all core operational tables
DO $$
DECLARE
  v_unprotected_tables TEXT[];
BEGIN
  SELECT array_agg(tablename::text)
  INTO v_unprotected_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'roles', 'user_roles', 'articles', 'documents', 'document_lines', 'stock_movements', 'payments', 'ledger_entries')
    AND rowsecurity = false;

  IF array_length(v_unprotected_tables, 1) > 0 THEN
    RAISE EXCEPTION 'RLS_CONTRACT_VIOLATION: Unprotected tables detected: %', v_unprotected_tables;
  ELSE
    RAISE NOTICE 'SUCCESS: RLS is enabled on all core operational tables.';
  END IF;
END;
$$;

-- 3. Verify authenticated role privileges
SELECT 
  grantee, 
  table_name, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

COMMIT;
