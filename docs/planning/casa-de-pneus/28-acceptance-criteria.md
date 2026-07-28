# 28 Acceptance Criteria

## Articles Module
- Can create, edit, deactivate articles.
- Article code is globally unique.
- Stock is not directly editable through the article screen (must use stock movements).
- All price changes are audited and logged in `price_history`.

## Stock Module
- All stock movements are transactional.
- Balance always equals the sum of all confirmed movements.
- Confirmed stock movements are immutable.
- Ability to allow or prevent negative stock must be configurable via settings.

## Sales Module
- Full document lifecycle supported (Draft → Confirmed → Canceled).
- Document numbering is gap-free and sequentially enforced.
- Confirmation of a sales document automatically creates corresponding stock and ledger entries.
- Credit notes reverse stock and ledger effects correctly and are linked to the original invoice.

## Payments Module
- Partial payments can be distributed correctly across multiple invoices.
- Total payment allocations never exceed the total payment amounts.
- Reversals properly restore outstanding invoice amounts and create reversal audit logs.

## Migration Module
- Total record counts for entities (Customers, Articles, Documents) match legacy system exactly.
- Financial and stock balances match within defined tolerance levels.
- All legacy IDs (foreign keys and references) are preserved or correctly mapped.

## Performance
- Article search returns results in < 200ms.
- Document creation (saving a draft) takes < 500ms.
- Complex report generation completes in < 3s.

## Security
- No unauthorized access permitted to any module (enforced via RLS and UI gating).
- Sensitive data (e.g., cost prices, profit margins) hidden from unauthorized users.
- Comprehensive audit log captures all critical data modifications (who, what, when).
