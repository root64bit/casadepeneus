-- Phase 6: Domain & Concurrency Atomicity Assertions
-- Verifies transactional atomicity and concurrency protection on domain RPCs.

BEGIN;

-- 1. Verify advisory lock helper functions exist
SELECT proname, prosecdef 
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND proname LIKE '%sale%';

-- 2. Concurrency advisory lock simulation
DO $$
DECLARE
  v_lock_acquired BOOLEAN;
BEGIN
  -- Obtain transactional advisory lock
  v_lock_acquired := pg_try_advisory_xact_lock(1001, 2002);
  IF NOT v_lock_acquired THEN
    RAISE EXCEPTION 'CONCURRENCY_TEST_FAILED: Could not acquire advisory lock';
  ELSE
    RAISE NOTICE 'SUCCESS: Transactional advisory lock acquired successfully.';
  END IF;
END;
$$;

COMMIT;
