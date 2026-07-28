# 25 Implementation Roadmap

## 15-Phase Implementation Plan

### Phase 0 — Discovery & Preservation (1 week)
- **Objective:** Secure legacy data
- **Tasks:** Locate XT-POS data, full backup, disk image, identify DB format
- **Deliverables:** Preservation report, data inventory
- **Exit criteria:** Read-only archive confirmed

### Phase 1 — Architecture & Repository Foundation (1 week)
- **Objective:** Project scaffold
- **Tasks:** Next.js + TypeScript setup, Supabase project config, CI/CD pipeline, design system implementation from Stitch
- **DB tables:** `companies`, `branches`, `warehouses`, `company_settings`, `application_settings`
- **Deliverables:** Running dev environment, CI pipeline green
- **Exit criteria:** `npm run build` passes, deploy to Vercel staging

### Phase 2 — Authentication & Authorization (1 week)
- **Objective:** Secure access
- **Tasks:** Supabase Auth config, login page, user management, roles, permissions, RLS policies
- **DB tables:** `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `branch_access`, `warehouse_access`, `login_events`
- **Screens:** Utilizadores, Perfis e Permissões
- **Exit criteria:** All 8 roles can login, permissions enforced, RLS active

### Phase 3 — Master Data & Articles (1 week)
- **Objective:** Establish core product catalog
- **Tasks:** Implement product management CRUD, pricing, categorization
- **DB tables:** `products`, `product_families`, `product_categories`, `brands`, `units_of_measure`, `tax_codes`, `price_history`
- **Screens:** Artigos e Stock, Criar/Editar Artigo
- **APIs:** `/products` CRUD, search, barcode lookup
- **Exit criteria:** Full article CRUD with audit, search <200ms

### Phase 4 — Stock Engine (1-2 weeks)
- **Objective:** Reliable inventory tracking
- **Tasks:** Implement transactional stock movements and balance calculations
- **DB tables:** `inventory_balances`, `stock_movements`, `stock_movement_reasons`, `inventory_counts`, `inventory_count_lines`, `stock_transfers`, `stock_transfer_lines`
- **Screens:** Entrada de Stock, Saída de Stock, Extrato de Movimentos
- **APIs:** Stock entry/exit/adjust/transfer
- **Exit criteria:** Stock movements transactional, balance always consistent, idempotent

### Phase 5 — Customers & Suppliers (1 week)
- **Objective:** CRM and vendor management
- **Tasks:** Implement contact and financial profiles for third-parties
- **DB tables:** `customers`, `customer_addresses`, `customer_contacts`, `suppliers`, `supplier_addresses`, `supplier_contacts`, `supplier_bank_accounts`
- **Screens:** Lista de Clientes, Criar/Editar Cliente, Detalhes Cliente, Lista de Fornecedores, Novo/Editar Fornecedor
- **Exit criteria:** Full CRUD, credit limit validation

### Phase 6 — Sales Documents (2 weeks)
- **Objective:** Core revenue generation flow
- **Tasks:** Quote to Invoice lifecycle, PDF generation, fiscal compliance
- **DB tables:** `document_types`, `documents`, `document_lines`, `document_status_history`, `document_links`, `fiscal_periods`, `document_sequences`
- **Screens:** Nova Venda, Guia de Remessa, Factura, Nota de Crédito, Nota de Débito
- **APIs:** Document lifecycle (draft→confirm→cancel)
- **Exit criteria:** Full document lifecycle with stock + ledger effects

### Phase 7 — Supplier Documents & Purchases (1-2 weeks)
- **Objective:** Core expense and procurement flow
- **Tasks:** Supplier invoices, delivery notes, and debit/credit notes
- **Screens:** Guia de Remessa Fornecedor, Registo Factura Fornecedor, Aviso Débito, Aviso Crédito
- **APIs:** Supplier document lifecycle
- **Exit criteria:** Purchase flow complete, duplicate invoice detection

### Phase 8 — Current Accounts & Payments (2 weeks)
- **Objective:** Financial tracking and settlements
- **Tasks:** Ledger management, receipts, payments, and partial allocations
- **DB tables:** `payment_methods`, `payments`, `payment_method_entries`, `payment_allocations`, `payment_reversals`, `ledger_accounts`, `ledger_entries`, `ledger_entry_links`
- **Screens:** Conta Corrente Cliente, Conta Corrente Fornecedor, Recebimento, Pagamento a Fornecedor, Distribuição Parcial, Recibo
- **Exit criteria:** Full payment lifecycle, partial payments, reversals, correct balances

### Phase 9 — Reports & Printing (1-2 weeks)
- **Objective:** Business intelligence and operational outputs
- **Tasks:** Implement all required reports and optimize printing
- **Screens:** Relatório Stock, Relatório Vendas, Contas a Receber e Pagar, Pesquisa Documentos
- **Reports:** All 17 report types
- **Exit criteria:** All reports generate correctly, PDF export works

### Phase 10 — Legacy Migration Tooling (2-3 weeks)
- **Objective:** Data transition
- **Tasks:** ETL scripts from XT-POS PRO v3.50 to Supabase
- **DB tables:** All `migration_*` tables
- **Screen:** Auditoria, Backup e Migração
- **APIs:** Migration batch lifecycle
- **Exit criteria:** Can import test data, reconciliation report matches

### Phase 11 — Security Hardening (1 week)
- **Objective:** Protect system and data
- **Tasks:** RLS policy review, penetration testing, rate limiting, security headers
- **Exit criteria:** Security checklist complete

### Phase 12 — Testing & Reconciliation (1-2 weeks)
- **Objective:** Ensure data integrity and system stability
- **Tasks:** Full test suite execution, migration dry-run with real data
- **Exit criteria:** All tests pass, reconciliation within tolerance

### Phase 13 — User Acceptance Testing (1 week)
- **Objective:** Client validation
- **Tasks:** Training, user testing, feedback incorporation
- **Exit criteria:** User sign-off

### Phase 14 — Production Rollout (3-5 days)
- **Objective:** Go live
- **Tasks:** Final migration, cutoff, go-live
- **Exit criteria:** System live, legacy read-only

### Phase 15 — Post-Launch Support (ongoing)
- **Objective:** Maintenance and evolution
- **Tasks:** Bug fixes, performance tuning, feature requests
