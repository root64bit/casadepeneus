# AUDITORIA E REFORÇO DE SEGURANÇA E CANCELAMENTO REVERSÍVEL
## MÓDULO: AVISOS DE CRÉDITO (CLIENTES E FORNECEDORES)
### Plataforma Casa de Pneus — 31/07/2026

---

## 1. Criação da Nova Migração de Segurança (`20260731190000_029_secure_financial_advice_cancellation.sql`)

Para não modificar migrações aplicadas anteriormente, foi criada uma nova migração independente com todas as garantias de segurança e auditoria:

1. **Permissões Granulares Registadas**:
   - `financial_adjustments.create`
   - `financial_adjustments.confirm`
   - `financial_adjustments.cancel`
   - Atribuídas automaticamente às roles `ADMIN`, `FINANCE` e `ACCOUNTING`.
2. **Colunas Estruturadas de Auditoria na Tabela `documents`**:
   - `cancelled_at TIMESTAMPTZ`
   - `cancelled_by UUID REFERENCES auth.users(id)`
   - `cancellation_reason TEXT`
   - `cancellation_idempotency_key TEXT`
3. **Tabela de Auditoria e Idempotência (`document_cancellation_logs`)**:
   - Guarda o registo imutável de cancelamento com restrição `UNIQUE(idempotency_key)`.
4. **RPC Segura e Isolada por Tenant (`public.cancel_financial_advice`)**:
   - **Autenticação**: Exige `auth.uid() IS NOT NULL`.
   - **Isolamento de Empresa**: Valida `v_company_id := public.get_user_company_id()`. Filtra obrigatoriamente o documento por `company_id = v_company_id`.
   - **Permissões (RBAC)**: Valida `has_permission('financial_adjustments.cancel')`.
   - **Bloqueio Concorrente**: Executa `FOR UPDATE` sobre o documento para evitar condições de corrida (*race conditions*).
   - **Whitelist de Tipos**: Aceita apenas `CUSTOMER_CREDIT_ADVICE`, `CUSTOMER_DEBIT_ADVICE`, `SUPPLIER_CREDIT_ADVICE`, `SUPPLIER_DEBIT_ADVICE` e exige estado `CONFIRMED`.
   - **Reversão com Protecção de Inconsistência**: Se `target_doc.amount_paid < alloc.allocated_amount`, rejeita explicitamente com a excepção `ALLOCATION_REVERSAL_INCONSISTENCY`.
   - **Recálculo Dinâmico do Estado da Factura**:
     - `outstanding >= grand_total` ➔ `'CONFIRMED'`
     - `0 < outstanding < grand_total` ➔ `'PARTIALLY_PAID'`
     - `outstanding = 0` ➔ `'PAID'`
5. **RPC de Total de Compras de Fornecedores (`get_supplier_total_purchases_summary`)**:
   - Agrega o total histórico de compras no banco de dados filtrando estritamente por `SUPPLIER_INVOICE` em estado `CONFIRMED`, `PARTIALLY_PAID` ou `PAID`.

---

## 2. Estado da Compilação e Validação Local

- **TypeScript (`npx tsc --noEmit`)**: **0 erros**.
- **Build Local (`npm run build`)**: Vite production bundle construído com **100% de Sucesso**.
- **Isolamento de Produção**: Mantido estritamente no repositório local. Nenhuma operação de deploy foi efectuada para a Vercel/produção.
