# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-platform-suite.spec.ts >> Casa de Pneus — Full Platform End-to-End QA Suite >> 02. Cashier Restricted Access Isolation (Operador de Caixa)
- Location: e2e\qa-platform-suite.spec.ts:41:3

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: locator('button:has-text("Factura (Restrito)")')
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 5000ms
  - waiting for locator('button:has-text("Factura (Restrito)")')

```

```yaml
- complementary "Navegação principal":
  - heading "Casa de Pneus, Lda." [level=1]
  - paragraph: PRODUÇÃO
  - navigation:
    - button "home Início"
    - button "sell Nova Venda"
    - button "request_quote Cotação"
    - button "groups Clientes e Fornecedores"
  - paragraph: Operador de Caixa
  - paragraph: Caixa · Armazém Principal
  - button "Terminar sessão"
- banner:
  - paragraph: Nova Venda
  - paragraph: PRODUÇÃO
  - text: search
  - textbox "Pesquisa global":
    - /placeholder: Pesquisar…
  - button "notifications 1"
  - button "OP"
- main:
  - button "Factura"
  - button "Venda a Dinheiro (VD)"
  - button "Guia de Remessa"
  - text: Nº Documento A atribuir ao confirmar EM PREPARAÇÃO
  - button "Último Documento (Ctrl+L)"
  - button "F5 — Novo"
  - text: Data Emissão
  - textbox: 2026-08-06
  - text: Código Cliente
  - 'textbox "Ex: 5"': "1"
  - text: Nome do Cliente *
  - textbox "Nome do Cliente": ibz
  - text: NUIT
  - textbox "NUIT (opcional)"
  - text: Morada
  - textbox "Morada (opcional)"
  - text: Condição de Pagamento
  - combobox:
    - option "A Dinheiro"
    - option "7 Dias" [selected]
    - option "15 Dias"
    - option "30 Dias"
    - option "60 Dias"
  - text: "Cliente Activo: ibzSaldo Pendente Anterior: 160 312,00 MZN Valor Documento: 0,00 MZN Novo Saldo Acumulado: 160 312,00 MZN [ Linhas de Artigos — Factura ] Total de Linhas: 0"
  - table:
    - rowgroup:
      - row "Código Artigo Descrição do Item / Pneu Existência Quant. Preço Unit. Desc % IVA % Total c/ IVA Acção":
        - columnheader "Código Artigo"
        - columnheader "Descrição do Item / Pneu"
        - columnheader "Existência"
        - columnheader "Quant."
        - columnheader "Preço Unit."
        - columnheader "Desc %"
        - columnheader "IVA %"
        - columnheader "Total c/ IVA"
        - columnheader "Acção"
    - rowgroup:
      - row "search 0 1 0 0 16 0.00 + Add":
        - cell "search":
          - text: search
          - textbox "Pesquisar artigo por código ou descrição… (Enter para seleccionar)"
        - cell "0"
        - cell "1":
          - spinbutton: "1"
        - cell "0":
          - spinbutton: "0"
        - cell "0":
          - spinbutton: "0"
        - cell "16":
          - spinbutton: "16"
        - cell "0.00"
        - cell "+ Add":
          - button "+ Add"
      - row "Nenhum artigo inserido. Digite o código do artigo no campo acima e prima Enter para adicionar.":
        - cell "Nenhum artigo inserido. Digite o código do artigo no campo acima e prima Enter para adicionar."
  - text: "% Desconto Geral:"
  - spinbutton: "0"
  - text: "Valor: 0,00 MZN Observações / Garantias:"
  - textbox "Observações da fatura ou termos de garantia dos pneus..."
  - text: "CD BASE IVA TOTAL IVA 1 (16%) 0.00 0.00 0 (0%) 0.00 0.00 ILIQUIDO: 0,00 MZN DESCONTOS: -0,00 MZN IVA: 0,00 MZN TOTAL: 0,00 MZN"
  - button "Novo (F5)"
  - button "Confirmar & Imprimir (F9)" [disabled]
  - button "Gravar (F2)" [disabled]
  - text: ESC=Sair
  - button "F2=Gravar"
  - button "F3=Ajustar"
  - button "F5=Novo"
  - button "F9=Imp"
  - text: "Tipo Activo: CUSTOMER_INVOICE | Estado: PREPARATION | Cliente: ibz"
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | async function loginAs(page: Page, email: string, pass: string) {
  4   |   await page.goto('/');
  5   | 
  6   |   // Wait for loading to clear
  7   |   await page.waitForLoadState('networkidle');
  8   | 
  9   |   // Check if sign out button exists (already logged in)
  10  |   const signOutBtn = page.locator('button:has-text("Sair"), button:has-text("Terminar Sessão")').first();
  11  |   if (await signOutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  12  |     await signOutBtn.click();
  13  |     await page.waitForTimeout(1000);
  14  |   }
  15  | 
  16  |   // Check if at login form
  17  |   const emailInput = page.locator('input[type="email"]').first();
  18  |   if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
  19  |     await emailInput.fill(email);
  20  |     await page.locator('#login-password, input[type="password"]').first().fill(pass);
  21  |     await page.locator('button[type="submit"]').first().click();
  22  |   }
  23  | 
  24  |   // Wait until navigation menu is rendered
  25  |   await expect(page.locator('nav').first()).toBeVisible({ timeout: 20000 });
  26  | }
  27  | 
  28  | test.describe('Casa de Pneus — Full Platform End-to-End QA Suite', () => {
  29  | 
  30  |   test('01. Admin Login & Full Navigation Menu Availability', async ({ page }) => {
  31  |     await loginAs(page, 'admin@casadepneus.co.mz', 'admin123456');
  32  | 
  33  |     // Check full admin menu items
  34  |     await expect(page.locator('text=Nova Venda').first()).toBeVisible();
  35  |     await expect(page.locator('text=Cotação').first()).toBeVisible();
  36  |     await expect(page.locator('text=Artigos e Stock').first()).toBeVisible();
  37  |     await expect(page.locator('text=Relatórios').first()).toBeVisible();
  38  |     await expect(page.locator('text=Administração').first()).toBeVisible();
  39  |   });
  40  | 
  41  |   test('02. Cashier Restricted Access Isolation (Operador de Caixa)', async ({ page }) => {
  42  |     await loginAs(page, 'caixa@casadepneus.com', 'caixa123456');
  43  | 
  44  |     // Verify Restricted Navigation Menu (Only Nova Venda & Cotação)
  45  |     await expect(page.locator('nav >> text=Nova Venda')).toBeVisible();
  46  |     await expect(page.locator('nav >> text=Cotação')).toBeVisible();
  47  | 
  48  |     // Verify Restricted Tabs Are Hidden from Menu
  49  |     await expect(page.locator('nav >> text=Artigos e Stock')).toHaveCount(0);
  50  |     await expect(page.locator('nav >> text=Relatórios')).toHaveCount(0);
  51  |     await expect(page.locator('nav >> text=Administração')).toHaveCount(0);
  52  | 
  53  |     // Verify Nova Venda Document Restrictions for Cashier
  54  |     await page.click('text=Nova Venda');
> 55  |     await expect(page.locator('button:has-text("Factura (Restrito)")')).toBeDisabled();
      |                                                                         ^ Error: expect(locator).toBeDisabled() failed
  56  |     await expect(page.locator('button:has-text("VD (Restrito)")')).toBeDisabled();
  57  |     await expect(page.locator('button:has-text("Guia de Remessa")')).toBeEnabled();
  58  | 
  59  |     // Verify Cotação Access for Cashier
  60  |     await page.click('text=Cotação');
  61  |     await expect(page.locator('text=Histórico de Cotações Emitidas').first()).toBeVisible();
  62  |   });
  63  | 
  64  |   test('03. Nova Venda Document Selector & Walk-In Customer Sequence', async ({ page }) => {
  65  |     await loginAs(page, 'admin@casadepneus.co.mz', 'admin123456');
  66  | 
  67  |     await page.click('text=Nova Venda');
  68  |     await expect(page.locator('text=Factura').first()).toBeVisible();
  69  |     await expect(page.locator('text=Venda a Dinheiro (VD)').first()).toBeVisible();
  70  |     await expect(page.locator('text=Guia de Remessa').first()).toBeVisible();
  71  | 
  72  |     // Switch to Guia de Remessa
  73  |     await page.click('text=Guia de Remessa');
  74  |     await expect(page.locator('text=Guia de Remessa').first()).toBeVisible();
  75  | 
  76  |     // Verify Walk-in customer code is selected
  77  |     const clientCodeInput = page.locator('input[value="1"]').first();
  78  |     await expect(clientCodeInput).toBeVisible();
  79  |   });
  80  | 
  81  |   test('04. Quotations History & Table Operator Column Verification', async ({ page }) => {
  82  |     await loginAs(page, 'admin@casadepneus.co.mz', 'admin123456');
  83  | 
  84  |     await page.click('text=Cotação');
  85  |     await expect(page.locator('text=Histórico de Cotações Emitidas').first()).toBeVisible();
  86  | 
  87  |     // Verify OPERADOR table header is present
  88  |     await expect(page.locator('th:has-text("OPERADOR")').first()).toBeVisible();
  89  |   });
  90  | 
  91  |   test('05. Sales Reports PVR Formula & Summary Totals Row', async ({ page }) => {
  92  |     await loginAs(page, 'admin@casadepneus.co.mz', 'admin123456');
  93  | 
  94  |     await page.click('text=Relatórios');
  95  |     await expect(page.locator('text=Relatório de Vendas por Artigo').first()).toBeVisible();
  96  | 
  97  |     // Verify Custom PVR Formula Explanation
  98  |     await expect(page.locator('text=[ (PVP - Margem%) / (1 + IVA%) ]').first()).toBeVisible();
  99  | 
  100 |     // Verify Summary Totals Row (tfoot)
  101 |     await expect(page.locator('tfoot:has-text("TOTAL GERAL")').first()).toBeVisible();
  102 |   });
  103 | 
  104 | });
  105 | 
```