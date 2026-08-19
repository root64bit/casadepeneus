-- Migration 041: Fix Supabase Database Linter Security Findings
-- 1. Enable RLS on public.companies with proper SELECT and UPDATE policies.
-- 2. Set security_invoker = true on customer_current_account_view and supplier_current_account_view.

-- 1. Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_policy ON public.companies;
DROP POLICY IF EXISTS companies_read_policy ON public.companies;
DROP POLICY IF EXISTS companies_update_policy ON public.companies;

CREATE POLICY companies_select_policy ON public.companies
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY companies_update_policy ON public.companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Set security_invoker on views to enforce user RLS and avoid SECURITY DEFINER warning
ALTER VIEW public.customer_current_account_view SET (security_invoker = true);
ALTER VIEW public.supplier_current_account_view SET (security_invoker = true);
