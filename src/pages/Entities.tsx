import React from 'react';
import { Client, Supplier } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface EntitiesProps {
  clients: Client[];
  suppliers: Supplier[];
}

export const Entities: React.FC<EntitiesProps> = ({ clients, suppliers }) => {
  const totalPending = clients.reduce((acc, c) => acc + c.pendingBalance, 0);

  return (
    <div className="space-y-6">
      {/* Clients Section */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
          <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
            <span className="material-symbols-outlined mr-2">groups</span>
            Directório de Clientes ({clients.length})
          </h3>
          <span className="text-xs font-bold font-mono text-[#ba1a1a]">
            Dívidas Pendentes: {formatMZN(totalPending)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9fa] dark:bg-[#282c2e] text-[#737780] dark:text-[#c3c6d1] uppercase border-b border-[#c3c6d1] dark:border-[#43474f]">
              <tr>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Nome / Entidade</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">NUIT</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Morada</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Telefone</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Email</th>
                <th className="p-3 text-right">Saldo Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#191c1d] dark:text-white">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-[11px]">
                        {client.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <span>{client.name}</span>
                    </div>
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono text-[#003366] dark:text-[#a7c8ff]">
                    {client.nuit}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#737780]">{client.address}</td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono">{client.phone}</td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#003366] dark:text-[#a7c8ff]">
                    {client.email}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-sm">
                    <span className={client.pendingBalance > 0 ? 'text-[#ba1a1a]' : 'text-[#006e25]'}>
                      {formatMZN(client.pendingBalance)}
                    </span>
                    {client.pendingBalance > 0 && (
                      <span className="block text-[10px] text-[#ba1a1a] font-sans">Em Cobrança</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suppliers Section */}
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
          <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
            <span className="material-symbols-outlined mr-2">local_shipping</span>
            Fornecedores ({suppliers.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f8f9fa] dark:bg-[#282c2e] text-[#737780] dark:text-[#c3c6d1] uppercase border-b border-[#c3c6d1] dark:border-[#43474f]">
              <tr>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Empresa</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">NUIT</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Morada</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Telefone</th>
                <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Contacto Principal</th>
                <th className="p-3 text-right">Total Compras (Acum.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
              {suppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#191c1d] dark:text-white">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded bg-[#006e25]/10 text-[#006e25] flex items-center justify-center">
                        <span className="material-symbols-outlined text-base">local_shipping</span>
                      </div>
                      <span>{sup.name}</span>
                    </div>
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono text-[#003366] dark:text-[#a7c8ff]">
                    {sup.nuit}
                  </td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#737780]">{sup.address}</td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono">{sup.phone}</td>
                  <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold">{sup.contactPerson}</td>
                  <td className="p-3 text-right font-mono font-bold text-sm text-[#006e25]">
                    {formatMZN(sup.totalPurchases)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
