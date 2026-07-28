import { useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';

interface AuthGateProps {
  session: Session | null;
  checking: boolean;
  children: ReactNode;
}

export function AuthGate({ session, checking, children }: AuthGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f6f7f8] text-slate-700">
        <p className="font-bold">A verificar sessão…</p>
      </main>
    );
  }

  if (session) return children;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { error: signInError } = await requireSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : 'Não foi possível iniciar sessão.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-[#f6f7f8] px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">
            Casa de Pneus
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Gestão operacional</h1>
          <p className="mt-2 text-sm text-slate-500">
            Acesso reservado a utilizadores autorizados.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Configure <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> antes de iniciar a aplicação.
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Email</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Palavra-passe</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              className="w-full rounded-xl bg-primary px-4 py-3 font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
