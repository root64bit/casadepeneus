import type { UserSummary } from '../types';

interface AdministrationProps {
  systemMode: string;
  users: UserSummary[];
  permissions: string[];
}

export function Administration({
  systemMode,
  users,
  permissions,
}: AdministrationProps) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-amber-300 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase text-amber-800">Modo do sistema</p>
          <p className="mt-2 text-2xl font-black text-amber-950">{systemMode}</p>
          <p className="mt-2 text-xs text-amber-800">
            Operações normais permanecem bloqueadas até aprovação separada para PILOT.
          </p>
        </div>
        <div className="rounded border border-[#c3c6d1] bg-white p-5 dark:border-[#43474f] dark:bg-[#1f2325]">
          <p className="text-xs font-black uppercase text-[#737780]">Utilizadores</p>
          <p className="mt-2 text-2xl font-black">{users.length}</p>
          <p className="mt-2 text-xs text-[#737780]">
            {users.filter((user) => user.active).length} perfis ativos
          </p>
        </div>
        <div className="rounded border border-[#c3c6d1] bg-white p-5 dark:border-[#43474f] dark:bg-[#1f2325]">
          <p className="text-xs font-black uppercase text-[#737780]">Permissões da sessão</p>
          <p className="mt-2 text-2xl font-black">{permissions.length}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-[#c3c6d1] bg-white dark:border-[#43474f] dark:bg-[#1f2325]">
        <header className="border-b border-[#c3c6d1] bg-[#e7e8e9] px-4 py-3 dark:border-[#43474f] dark:bg-[#282c2e]">
          <h2 className="text-sm font-black text-[#001e40] dark:text-[#a7c8ff]">
            Utilizadores, perfis e funções
          </h2>
        </header>
        <table className="w-full text-left text-xs">
          <thead className="uppercase text-[#737780]">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Email</th>
              <th className="p-3">Funções</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="p-3 font-bold">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{user.roles.join(', ') || 'Sem função'}</td>
                <td className="p-3">
                  <span className={`rounded px-2 py-1 font-black ${user.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
                    {user.active ? 'ATIVO' : 'INATIVO'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-[#c3c6d1] bg-white p-5 dark:border-[#43474f] dark:bg-[#1f2325]">
        <h2 className="text-sm font-black text-[#001e40] dark:text-[#a7c8ff]">
          Permissões efetivas
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <span key={permission} className="rounded bg-[#e7e8e9] px-2 py-1 font-mono text-[11px]">
              {permission}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
