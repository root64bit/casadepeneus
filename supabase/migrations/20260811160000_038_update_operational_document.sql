CREATE OR REPLACE FUNCTION update_operational_document(
  p_document_id UUID,
  p_client_name TEXT DEFAULT NULL,
  p_client_nuit TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_grand_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_notes TEXT;
  v_customer_id UUID;
  v_company_id UUID;
  v_updated_notes TEXT;
  v_new_name TEXT;
  v_new_nuit TEXT;
  v_new_address TEXT;
  v_extra_notes TEXT;
  v_final_grand NUMERIC;
  v_net NUMERIC;
  v_tax NUMERIC;
  v_line JSONB;
  v_idx INT := 1;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_disc_pct NUMERIC;
  v_disc_amt NUMERIC;
  v_iva_pct NUMERIC;
  v_line_tot NUMERIC;
  v_net_val NUMERIC;
  v_tax_val NUMERIC;
  v_prod_id UUID;
BEGIN
  -- Get existing doc details
  SELECT notes, customer_id, company_id, grand_total
  INTO v_existing_notes, v_customer_id, v_company_id, v_final_grand
  FROM documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  IF v_existing_notes IS NULL THEN
    v_existing_notes := '';
  END IF;

  -- Extract client name/nuit/address
  v_new_name := COALESCE(NULLIF(TRIM(p_client_name), ''), 'Cliente Pontual');
  v_new_nuit := COALESCE(TRIM(p_client_nuit), 'N/A');
  v_new_address := COALESCE(TRIM(p_client_address), 'N/A');
  v_extra_notes := COALESCE(TRIM(p_notes), '');

  v_updated_notes := TRIM(CONCAT('[CLIENTE: ', v_new_name, ' | NUIT: ', v_new_nuit, ' | MORADA: ', v_new_address, '] ', v_extra_notes));

  -- Handle document_lines if provided
  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    v_final_grand := 0;

    -- Delete existing document_lines for this document
    DELETE FROM document_lines WHERE document_id = p_document_id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_qty := COALESCE((v_line->>'quantity')::numeric, 1);
      v_price := COALESCE((v_line->>'unitPrice')::numeric, 0);
      v_disc_pct := COALESCE((v_line->>'discountPercent')::numeric, 0);
      v_iva_pct := COALESCE((v_line->>'ivaPercent')::numeric, 16);

      v_line_tot := ROUND(v_qty * v_price * (1 - v_disc_pct / 100), 2);
      v_disc_amt := ROUND(v_qty * v_price * (v_disc_pct / 100), 2);
      v_net_val := ROUND(v_line_tot / (1 + v_iva_pct / 100), 2);
      v_tax_val := ROUND(v_line_tot - v_net_val, 2);

      v_final_grand := v_final_grand + v_line_tot;

      -- Check if product_id is UUID
      BEGIN
        v_prod_id := (v_line->>'articleId')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_prod_id := NULL;
      END;

      INSERT INTO document_lines (
        document_id,
        company_id,
        line_number,
        product_id,
        product_code_snapshot,
        description_snapshot,
        unit_code_snapshot,
        quantity,
        unit_price,
        discount_percentage,
        discount_amount,
        tax_rate_snapshot,
        net_amount,
        tax_amount,
        total_amount
      ) VALUES (
        p_document_id,
        v_company_id,
        v_idx,
        v_prod_id,
        COALESCE(v_line->>'code', 'DIV'),
        COALESCE(v_line->>'description', 'Artigo sem descrição'),
        'UN',
        v_qty,
        v_price,
        v_disc_pct,
        v_disc_amt,
        v_iva_pct,
        v_net_val,
        v_tax_val,
        v_line_tot
      );

      v_idx := v_idx + 1;
    END LOOP;
  ELSIF p_grand_total IS NOT NULL AND p_grand_total >= 0 THEN
    v_final_grand := p_grand_total;
  END IF;

  v_net := ROUND(v_final_grand / 1.16, 2);
  v_tax := ROUND(v_final_grand - v_net, 2);

  -- Update documents table with SECURITY DEFINER privileges!
  UPDATE documents
  SET
    notes = v_updated_notes,
    grand_total = v_final_grand,
    net_total = v_net,
    tax_total = v_tax,
    outstanding_amount = v_final_grand,
    updated_at = NOW()
  WHERE id = p_document_id;

  -- Update customer if associated
  IF v_customer_id IS NOT NULL AND TRIM(p_client_name) <> '' THEN
    UPDATE customers
    SET
      name = TRIM(p_client_name),
      tax_number = NULLIF(TRIM(p_client_nuit), ''),
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_operational_document TO authenticated, anon;
