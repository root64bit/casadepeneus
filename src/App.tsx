import { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { NewArticleModal } from './components/NewArticleModal';
import { PaymentModal } from './components/PaymentModal';
import { PrintInvoiceModal } from './components/PrintInvoiceModal';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { NewSale } from './pages/NewSale';
import { StockMovements } from './pages/StockMovements';
import { Entities } from './pages/Entities';
import { Reports } from './pages/Reports';
import { StitchConnection } from './pages/StitchConnection';
import { Article, SaleInvoice, StockMovement } from './types';
import {
  INITIAL_ARTICLES,
  INITIAL_SALES,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_STOCK_MOVEMENTS
} from './data/mockData';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // State pools
  const [articles, setArticles] = useState<Article[]>(INITIAL_ARTICLES);
  const [sales, setSales] = useState<SaleInvoice[]>(INITIAL_SALES);
  const [movements, setMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS);

  // Modals
  const [isNewArticleModalOpen, setNewArticleModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalAmount, setPaymentModalAmount] = useState(0);
  const [paymentModalClient, setPaymentModalClient] = useState('');
  const [isPrintModalOpen, setPrintModalOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<SaleInvoice | null>(null);

  // Handlers
  const handleAddArticle = (article: Omit<Article, 'id'>) => {
    const newArticle: Article = {
      ...article,
      id: `art-${Date.now()}`
    };
    setArticles([...articles, newArticle]);
  };

  const handleCompleteSale = (sale: SaleInvoice) => {
    setSales([sale, ...sales]);
  };

  const handleAddMovement = (mov: StockMovement) => {
    setMovements([mov, ...movements]);
    // Update stock
    setArticles(prev =>
      prev.map(art => {
        if (art.code === mov.articleCode) {
          return {
            ...art,
            stock: mov.type === 'entrada'
              ? art.stock + mov.quantity
              : Math.max(0, art.stock - mov.quantity)
          };
        }
        return art;
      })
    );
  };

  const handleOpenPaymentModal = (amount: number, clientName: string) => {
    setPaymentModalAmount(amount);
    setPaymentModalClient(clientName);
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = (_method: string, _paidAmount: number) => {
    setPaymentModalOpen(false);
    alert('Pagamento registado com sucesso! Fatura emitida.');
  };

  const handleOpenPrintModal = (sale: SaleInvoice) => {
    setPrintInvoice(sale);
    setPrintModalOpen(true);
  };

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'F1':
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar"]')?.focus();
        break;
      case 'F2':
        e.preventDefault();
        setActiveTab('sales');
        break;
      case 'F3':
        e.preventDefault();
        setActiveTab('inventory');
        break;
      case 'F4':
        e.preventDefault();
        setActiveTab('reports');
        break;
      case 'F9':
        e.preventDefault();
        window.print();
        break;
      case 'Escape':
        e.preventDefault();
        if (isNewArticleModalOpen) setNewArticleModalOpen(false);
        else if (isPaymentModalOpen) setPaymentModalOpen(false);
        else if (isPrintModalOpen) setPrintModalOpen(false);
        break;
    }
  }, [isNewArticleModalOpen, isPaymentModalOpen, isPrintModalOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleTriggerShortcut = (key: string) => {
    switch (key) {
      case 'F2': setActiveTab('sales'); break;
      case 'F3': setActiveTab('inventory'); break;
      case 'F4': setActiveTab('reports'); break;
      case 'F9': window.print(); break;
    }
  };

  // Render active view
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            articles={articles}
            sales={sales}
            clients={INITIAL_CLIENTS}
            setActiveTab={setActiveTab}
            onOpenNewArticleModal={() => setNewArticleModalOpen(true)}
          />
        );
      case 'inventory':
        return (
          <Inventory
            articles={articles}
            globalSearch={globalSearch}
            onOpenNewArticleModal={() => setNewArticleModalOpen(true)}
            setActiveTab={setActiveTab}
          />
        );
      case 'sales':
        return (
          <NewSale
            articles={articles}
            clients={INITIAL_CLIENTS}
            onCompleteSale={handleCompleteSale}
            onOpenPaymentModal={handleOpenPaymentModal}
            onOpenPrintModal={handleOpenPrintModal}
          />
        );
      case 'movements':
        return (
          <StockMovements
            movements={movements}
            articles={articles}
            onAddMovement={handleAddMovement}
          />
        );
      case 'entities':
        return (
          <Entities
            clients={INITIAL_CLIENTS}
            suppliers={INITIAL_SUPPLIERS}
          />
        );
      case 'reports':
        return (
          <Reports
            sales={sales}
            clients={INITIAL_CLIENTS}
          />
        );
      case 'stitch':
        return <StitchConnection />;
      default:
        return null;
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
        onTriggerShortcut={handleTriggerShortcut}
      >
        {renderActiveView()}
      </Layout>

      {/* Modals */}
      <NewArticleModal
        isOpen={isNewArticleModalOpen}
        onClose={() => setNewArticleModalOpen(false)}
        onSave={handleAddArticle}
      />
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        totalAmount={paymentModalAmount}
        clientName={paymentModalClient}
        onConfirmPayment={handleConfirmPayment}
      />
      <PrintInvoiceModal
        isOpen={isPrintModalOpen}
        onClose={() => setPrintModalOpen(false)}
        invoice={printInvoice}
      />
    </>
  );
}

export default App;
