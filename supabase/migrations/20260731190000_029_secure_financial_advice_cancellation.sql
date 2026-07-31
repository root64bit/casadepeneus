-- Migration: 20260731190000_029_secure_financial_advice_cancellation.sql
-- Description: Tenant-isolated, permission-enforced, idempotent cancellation engine for financial advice documents, allocation state recalculation, and database-level supplier purchase totals RPC.
-- Target Database: bkbcgndzsfylwsinxwbb

BEGIN;

-- 1. Register Financial Adjustments Granular Permissions
INSERT INTO public.permissions (code, module, description) VALUES
    ('financial_adjustments.create', 'Finance', 'Create financial advice documents'),
    ('financial_adjustments.confirm', 'Finance', 'Confirm financial advice documents'),
    ('financial_adjustments.cancel', 'Finance', 'Cancel and reverse financial advice documents')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Administrator & Finance system roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('ADMIN', 'FINANCE', 'ACCOUNTING')
  AND p.code IN ('financial_adjustments.create', 'financial_adjustments.confirm', 'financial_adjustments.cancel')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2. Add Structured Audit Columns to documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_idempotency_key TEXT;

-- 3. Add Idempotency & Audit Log Table for Cancellations
CREATE TABLE IF NOT EXISTS public.document_cancellation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    idempotency_key TEXT UNIQUE,
    cancellation_reason TEXT NOT NULL,
    reversal_ledger_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL,
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_cancellation_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.document_cancellation_logs TO authenticated;
GRANT ALL ON public.document_cancellation_logs TO service_role;

CREATE POLICY "document_cancellation_logs_select" ON public.document_cancellation_logs
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- Add status column to financial_advice_allocations if missing
ALTER TABLE public.financial_advice_allocations
ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id);

-- 4. Secure & Idempotent RPC: cancel_financial_advice
CREATE OR REPLACE FUNCTION public.cancel_financial_advice(
    p_advice_document_id UUID,
    p_cancellation_reason TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_doc public.documents;
    v_doc_type_code TEXT;
    v_alloc RECORD;
    v_target_doc public.documents;
    v_running_bal NUMERIC(15,2) := 0;
    v_reversal_ledger_id UUID := NULL;
    v_existing_log_id UUID;
    v_new_paid NUMERIC(15,2);
    v_new_outstanding NUMERIC(15,2);
    v_new_status VARCHAR(30);
BEGIN
    -- Authorization & Tenant Isolation Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: User must be authenticated to cancel financial advice.';
    END IF;

    v_company_id := public.get_user_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'COMPANY_CONTEXT_MISSING: User does not belong to an active company tenant.';
    END IF;

    IF NOT public.has_permission('financial_adjustments.cancel') AND NOT public.has_permission('documents.cancel') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: User lacks permission [financial_adjustments.cancel] to reverse financial advice documents.';
    END IF;

    IF TRIM(COALESCE(p_cancellation_reason, '')) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: A valid cancellation reason must be provided for audit purposes.';
    END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT id INTO v_existing_log_id
        FROM public.document_cancellation_logs
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN TRUE; -- Idempotent retry succeeded safely
        END IF;
    END IF;

    -- Lock Document for Update within Tenant Boundary
    SELECT * INTO v_doc
    FROM public.documents
    WHERE id = p_advice_document_id
      AND company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DOCUMENT_NOT_FOUND_OR_UNAUTHORIZED: Advice document ID % not found in your company workspace.', p_advice_document_id;
    END IF;

    -- Verify Document Type Whitelist
    SELECT code INTO v_doc_type_code
    FROM public.document_types
    WHERE id = v_doc.document_type_id;

    IF v_doc_type_code NOT IN ('CUSTOMER_CREDIT_ADVICE', 'CUSTOMER_DEBIT_ADVICE', 'SUPPLIER_CREDIT_ADVICE', 'SUPPLIER_DEBIT_ADVICE') THEN
        RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE: Document % of type % is not a valid financial advice document.', v_doc.display_number, v_doc_type_code;
    END IF;

    -- Verify Status
    IF v_doc.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'ALREADY_CANCELLED: Document % is already cancelled.', v_doc.display_number;
    END IF;

    IF v_doc.status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'INVALID_STATUS: Document % in status % cannot be cancelled. Only CONFIRMED documents can be reversed.', v_doc.display_number, v_doc.status;
    END IF;

    -- Reversal Logic per Advice Document Type
    IF v_doc_type_code = 'CUSTOMER_CREDIT_ADVICE' THEN
        -- Original reduced customer debt, cancellation restores customer debt (Debit entry)
        UPDATE public.customers
        SET current_balance = current_balance + v_doc.grand_total, updated_at = now()
        WHERE id = v_doc.customer_id AND company_id = v_company_id
        RETURNING current_balance INTO v_running_bal;

        INSERT INTO public.ledger_entries (
            company_id, entry_date, party_type, customer_id, document_id,
            entry_type, debit_amount, credit_amount, outstanding_amount,
            running_balance, description, reference_number, created_by
        ) VALUES (
            v_company_id, CURRENT_DATE, 'CUSTOMER', v_doc.customer_id, v_doc.id,
            'REVERSAL_CUSTOMER_CREDIT_ADVICE', v_doc.grand_total, 0, 0,
            v_running_bal, 'Reversão ACC: ' || TRIM(p_cancellation_reason), v_doc.display_number, v_user_id
        ) RETURNING id INTO v_reversal_ledger_id;

    ELSIF v_doc_type_code = 'CUSTOMER_DEBIT_ADVICE' THEN
        -- Original increased customer debt, cancellation reduces customer debt (Credit entry)
        UPDATE public.customers
        SET current_balance = current_balance - v_doc.grand_total, updated_at = now()
        WHERE id = v_doc.customer_id AND company_id = v_company_id
        RETURNING current_balance INTO v_running_bal;

        INSERT INTO public.ledger_entries (
            company_id, entry_date, party_type, customer_id, document_id,
            entry_type, debit_amount, credit_amount, outstanding_amount,
            running_balance, description, reference_number, created_by
        ) VALUES (
            v_company_id, CURRENT_DATE, 'CUSTOMER', v_doc.customer_id, v_doc.id,
            'REVERSAL_CUSTOMER_DEBIT_ADVICE', 0, v_doc.grand_total, 0,
            v_running_bal, 'Reversão ADC: ' || TRIM(p_cancellation_reason), v_doc.display_number, v_user_id
        ) RETURNING id INTO v_reversal_ledger_id;

    ELSIF v_doc_type_code = 'SUPPLIER_CREDIT_ADVICE' THEN
        -- Original increased supplier payable, cancellation reduces supplier payable (Debit entry)
        UPDATE public.suppliers
        SET current_balance = current_balance - v_doc.grand_total, updated_at = now()
        WHERE id = v_doc.supplier_id AND company_id = v_company_id
        RETURNING current_balance INTO v_running_bal;

        INSERT INTO public.ledger_entries (
            company_id, entry_date, party_type, supplier_id, document_id,
            entry_type, debit_amount, credit_amount, outstanding_amount,
            running_balance, description, reference_number, created_by
        ) VALUES (
            v_company_id, CURRENT_DATE, 'SUPPLIER', v_doc.supplier_id, v_doc.id,
            'REVERSAL_SUPPLIER_CREDIT_ADVICE', v_doc.grand_total, 0, 0,
            v_running_bal, 'Reversão ACF: ' || TRIM(p_cancellation_reason), v_doc.display_number, v_user_id
        ) RETURNING id INTO v_reversal_ledger_id;

    ELSIF v_doc_type_code = 'SUPPLIER_DEBIT_ADVICE' THEN
        -- Original reduced supplier payable, cancellation restores supplier payable (Credit entry)
        UPDATE public.suppliers
        SET current_balance = current_balance + v_doc.grand_total, updated_at = now()
        WHERE id = v_doc.supplier_id AND company_id = v_company_id
        RETURNING current_balance INTO v_running_bal;

        INSERT INTO public.ledger_entries (
            company_id, entry_date, party_type, supplier_id, document_id,
            entry_type, debit_amount, credit_amount, outstanding_amount,
            running_balance, description, reference_number, created_by
        ) VALUES (
            v_company_id, CURRENT_DATE, 'SUPPLIER', v_doc.supplier_id, v_doc.id,
            'REVERSAL_SUPPLIER_DEBIT_ADVICE', 0, v_doc.grand_total, 0,
            v_running_bal, 'Reversão ADF: ' || TRIM(p_cancellation_reason), v_doc.display_number, v_user_id
        ) RETURNING id INTO v_reversal_ledger_id;
    END IF;

    -- Reverse Allocations & Recalculate Target Document Balances & Statuses
    FOR v_alloc IN
        SELECT * FROM public.financial_advice_allocations
        WHERE advice_document_id = p_advice_document_id
          AND company_id = v_company_id
          AND status = 'ACTIVE'
        FOR UPDATE
    LOOP
        SELECT * INTO v_target_doc
        FROM public.documents
        WHERE id = v_alloc.target_document_id
          AND company_id = v_company_id
        FOR UPDATE;

        IF FOUND THEN
            -- Inconsistency Safety Check
            IF v_target_doc.amount_paid < v_alloc.allocated_amount THEN
                RAISE EXCEPTION 'ALLOCATION_REVERSAL_INCONSISTENCY: Target document % paid amount (%) is less than allocated amount (%).',
                    v_target_doc.display_number, v_target_doc.amount_paid, v_alloc.allocated_amount;
            END IF;

            v_new_paid := v_target_doc.amount_paid - v_alloc.allocated_amount;
            v_new_outstanding := v_target_doc.grand_total - v_new_paid;

            IF v_new_outstanding >= v_target_doc.grand_total THEN
                v_new_status := 'CONFIRMED';
            ELSIF v_new_outstanding > 0 THEN
                v_new_status := 'PARTIALLY_PAID';
            ELSE
                v_new_status := 'PAID';
            END IF;

            UPDATE public.documents
            SET amount_paid = v_new_paid,
                outstanding_amount = v_new_outstanding,
                status = v_new_status,
                updated_at = now()
            WHERE id = v_alloc.target_document_id;

            UPDATE public.financial_advice_allocations
            SET status = 'REVERSED',
                reversed_at = now(),
                reversed_by = v_user_id
            WHERE id = v_alloc.id;
        END IF;
    END LOOP;

    -- Update Advice Document Status & Audit Trail
    UPDATE public.documents
    SET status = 'CANCELLED',
        cancelled_at = now(),
        cancelled_by = v_user_id,
        cancellation_reason = TRIM(p_cancellation_reason),
        cancellation_idempotency_key = p_idempotency_key,
        updated_at = now(),
        updated_by = v_user_id
    WHERE id = p_advice_document_id;

    -- Insert Idempotency Audit Log
    INSERT INTO public.document_cancellation_logs (
        company_id, document_id, idempotency_key, cancellation_reason,
        reversal_ledger_entry_id, performed_by
    ) VALUES (
        v_company_id, p_advice_document_id, p_idempotency_key, TRIM(p_cancellation_reason),
        v_reversal_ledger_id, v_user_id
    );

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_financial_advice FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_financial_advice TO authenticated;

-- 5. Database RPC: get_supplier_total_purchases_summary
CREATE OR REPLACE FUNCTION public.get_supplier_total_purchases_summary()
RETURNS TABLE (
    supplier_id UUID,
    total_purchases NUMERIC(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_company_id UUID := public.get_user_company_id();
BEGIN
    RETURN QUERY
    SELECT
        d.supplier_id,
        COALESCE(SUM(d.grand_total), 0)::NUMERIC(15,2) AS total_purchases
    FROM public.documents d
    JOIN public.document_types dt ON dt.id = d.document_type_id
    WHERE d.company_id = v_company_id
      AND d.supplier_id IS NOT NULL
      AND dt.code = 'SUPPLIER_INVOICE'
      AND d.status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID')
    GROUP BY d.supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_supplier_total_purchases_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_total_purchases_summary TO authenticated;

COMMIT;
