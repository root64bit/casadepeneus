import { Article, SaleInvoice, StockMovement, Client, Supplier } from '../types';

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-1',
    code: 'PNE-2055516-M',
    description: 'Pneu Michelin Primacy 4 205/55 R16 91V',
    unit: 'UN',
    minStock: 10,
    stock: 42,
    costPrice: 4200.00,
    profitMargin: 25,
    sellPrice: 5250.00,
    sellPriceWithIva: 6090.00,
    category: 'pneus',
    brand: 'Michelin',
    size: '205/55 R16'
  },
  {
    id: 'art-2',
    code: 'PNE-2254517-P',
    description: 'Pneu Pirelli P Zero 225/45 R17 94Y',
    unit: 'UN',
    minStock: 8,
    stock: 2, // Low stock!
    costPrice: 6800.00,
    profitMargin: 30,
    sellPrice: 8840.00,
    sellPriceWithIva: 10254.40,
    category: 'pneus',
    brand: 'Pirelli',
    size: '225/45 R17'
  },
  {
    id: 'art-3',
    code: 'BR-10655',
    description: 'Pneu Bridgestone Turanza 205/55R16',
    unit: 'UN',
    minStock: 10,
    stock: 2, // Low stock!
    costPrice: 3800.00,
    profitMargin: 25,
    sellPrice: 4750.00,
    sellPriceWithIva: 5510.00,
    category: 'pneus',
    brand: 'Bridgestone',
    size: '205/55 R16'
  },
  {
    id: 'art-4',
    code: 'CAM-0012',
    description: 'Câmara de Ar Heavy Duty 7.50-16',
    unit: 'UN',
    minStock: 5,
    stock: 0, // Out of stock!
    costPrice: 1200.00,
    profitMargin: 35,
    sellPrice: 1620.00,
    sellPriceWithIva: 1879.20,
    category: 'camaras',
    brand: 'Kabat',
    size: '7.50-16'
  },
  {
    id: 'art-5',
    code: 'CAM-165-INT',
    description: 'Câmara de Ar 165/175-13 TR13',
    unit: 'UN',
    minStock: 20,
    stock: 55,
    costPrice: 450.00,
    profitMargin: 40,
    sellPrice: 630.00,
    sellPriceWithIva: 730.80,
    category: 'camaras',
    brand: 'Goodyear',
    size: '165/175-13'
  },
  {
    id: 'art-6',
    code: 'PNE-1756514-B',
    description: 'Pneu Bridgestone Turanza T005 175/65 R14',
    unit: 'UN',
    minStock: 15,
    stock: 18,
    costPrice: 3100.00,
    profitMargin: 22,
    sellPrice: 3782.00,
    sellPriceWithIva: 4387.12,
    category: 'pneus',
    brand: 'Bridgestone',
    size: '175/65 R14'
  },
  {
    id: 'art-7',
    code: 'SRV-MON-01',
    description: 'Serviço de Montagem e Calibragem Ligeiro',
    unit: 'SER',
    minStock: 0,
    stock: 999,
    costPrice: 150.00,
    profitMargin: 100,
    sellPrice: 300.00,
    sellPriceWithIva: 348.00,
    category: 'servicos'
  },
  {
    id: 'art-8',
    code: 'SRV-ALI-02',
    description: 'Serviço de Alinhamento Direção 3D Laser',
    unit: 'SER',
    minStock: 0,
    stock: 999,
    costPrice: 500.00,
    profitMargin: 100,
    sellPrice: 1000.00,
    sellPriceWithIva: 1160.00,
    category: 'servicos'
  }
];

export const INITIAL_SALES: SaleInvoice[] = [
  {
    id: 'sale-1',
    docNumber: 'VD 24/0102',
    date: '2026-07-28',
    clientName: 'Transportes Maputo, S.A.',
    clientNuit: '400987123',
    clientAddress: 'Av. das Indústrias, Parcela 14, Maputo',
    paymentMethod: 'Transferência Bancária (M-Pesa)',
    sellerName: 'Operador Balcão',
    items: [
      {
        articleId: 'art-1',
        code: 'PNE-2055516-M',
        description: 'Pneu Michelin Primacy 4 205/55 R16 91V',
        quantity: 2,
        unitPrice: 5250.00,
        discountPercent: 0,
        ivaPercent: 16,
        total: 12180.00
      }
    ],
    subtotalBruto: 10500.00,
    descontoTotal: 0,
    ivaTotal: 1680.00,
    totalAmount: 12500.00,
    paidAmount: 12500.00,
    pendingAmount: 0,
    status: 'Concluída',
    time: '08:45'
  },
  {
    id: 'sale-2',
    docNumber: 'VD 24/0101',
    date: '2026-07-28',
    clientName: 'João Matsinhe',
    clientNuit: '100456789',
    clientAddress: 'Bairro da Coop, Maputo',
    paymentMethod: 'Pronto Pagamento (Numerário)',
    sellerName: 'Operador Balcão',
    items: [
      {
        articleId: 'art-6',
        code: 'PNE-1756514-B',
        description: 'Pneu Bridgestone Turanza T005 175/65 R14',
        quantity: 1,
        unitPrice: 3782.00,
        discountPercent: 5,
        ivaPercent: 16,
        total: 4200.00
      }
    ],
    subtotalBruto: 3782.00,
    descontoTotal: 189.10,
    ivaTotal: 606.86,
    totalAmount: 4200.00,
    paidAmount: 4200.00,
    pendingAmount: 0,
    status: 'Concluída',
    time: '08:30'
  },
  {
    id: 'sale-3',
    docNumber: 'VD 24/0100',
    date: '2026-07-28',
    clientName: 'Logística Beira, Lda',
    clientNuit: '400554433',
    clientAddress: 'Zona Industrial da Manga, Beira',
    paymentMethod: 'Crédito 30 Dias',
    sellerName: 'José Martins',
    items: [
      {
        articleId: 'art-1',
        code: 'PNE-2055516-M',
        description: 'Pneu Michelin Primacy 4 205/55 R16 91V',
        quantity: 4,
        unitPrice: 5250.00,
        discountPercent: 0,
        ivaPercent: 16,
        total: 24360.00
      }
    ],
    subtotalBruto: 21000.00,
    descontoTotal: 0,
    ivaTotal: 3360.00,
    totalAmount: 28500.00,
    paidAmount: 0,
    pendingAmount: 28500.00,
    status: 'Pendente',
    time: '08:15'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-1',
    name: 'Construtora do Índico, Lda',
    nuit: '400112233',
    address: 'Av. 24 de Julho, Nº 1420, Maputo',
    phone: '+258 84 123 4567',
    email: 'compras@indico.co.mz',
    pendingBalance: 450000.00
  },
  {
    id: 'cli-2',
    name: 'Minas de Moatize, S.A.',
    nuit: '400887766',
    address: 'Estrada Nacional N7, Tete',
    phone: '+258 82 987 6543',
    email: 'logistica@moatize-mines.mz',
    pendingBalance: 800000.00
  },
  {
    id: 'cli-3',
    name: 'Transportes Maputo, S.A.',
    nuit: '400987123',
    address: 'Av. das Indústrias, Parcela 14, Maputo',
    phone: '+258 84 555 1212',
    email: 'frotas@transportesmaputo.mz',
    pendingBalance: 0
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Continental Moçambique, S.A.',
    nuit: '400001111',
    address: 'Av. Mozambique, Maputo',
    phone: '+258 21 400 300',
    contactPerson: 'Fernando Silva',
    totalPurchases: 1850000.00
  },
  {
    id: 'sup-2',
    name: 'Bridgestone Southern Africa',
    nuit: '400002222',
    address: 'Matola Gare, Maputo',
    phone: '+258 21 720 100',
    contactPerson: 'Carlos Mambo',
    totalPurchases: 2450000.00
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov-1',
    type: 'entrada',
    docRef: 'G-E/202',
    date: '2026-07-27',
    articleCode: 'PNE-2055516-M',
    articleDescription: 'Pneu Michelin Primacy 4 205/55 R16',
    quantity: 45,
    entityName: 'Continental SA',
    operator: 'José Martins'
  },
  {
    id: 'mov-2',
    type: 'saida',
    docRef: 'VD 24/0102',
    date: '2026-07-28',
    articleCode: 'PNE-2055516-M',
    articleDescription: 'Pneu Michelin Primacy 4 205/55 R16',
    quantity: 2,
    entityName: 'Transportes Maputo, S.A.',
    operator: 'Operador Balcão'
  }
];
