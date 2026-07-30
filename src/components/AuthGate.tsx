import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import type { UserContext } from '../types';

interface AuthGateProps {
  session: Session | null;
  checking: boolean;
  userContext: UserContext | null;
  onPasswordChanged: () => Promise<void>;
  children: ReactNode;
}

const friendlyAuthError = (message: string) => {
  const value = message.toLowerCase();
  if (value.includes('invalid login')) return 'Email ou palavra-passe incorretos.';
  if (value.includes('email not confirmed')) return 'Confirme o email antes de entrar.';
  if (value.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (value.includes('user_inactive')) return 'Esta conta está desativada. Contacte o administrador.';
  return 'Não foi possível iniciar sessão. Tente novamente.';
};

export function AuthGate({
  session,
  checking,
  userContext,
  onPasswordChanged,
  children,
}: AuthGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publicContext, setPublicContext] = useState<{ company_name?: string; system_mode?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    requireSupabase().rpc('get_public_login_context').then(({ data }) => {
      if (data) setPublicContext(data);
    });
  }, []);

  useEffect(() => {
    if (!session) {
      window.history.replaceState({}, '', '/login');
      window.setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [session]);

  if (checking) {
    return <main className="min-h-screen grid place-items-center bg-slate-50"><p aria-live="polite" className="font-bold text-slate-700">A verificar sessão…</p></main>;
  }

  if (session && !userContext) {
    return <main className="min-h-screen grid place-items-center bg-slate-50"><p aria-live="polite" className="font-bold text-slate-700">A carregar perfil e permissões…</p></main>;
  }
  if (session && userContext?.forcePasswordChange) {
    return <PasswordChangeGate onComplete={onPasswordChanged} onSignOut={() => requireSupabase().auth.signOut()} />;
  }
  if (session) return children;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const { error: signInError } = await requireSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      window.history.replaceState({}, '', '/');
    } catch (cause) {
      setError(friendlyAuthError(cause instanceof Error ? cause.message : ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Introduza primeiro o seu email.');
      emailRef.current?.focus();
      return;
    }
    setResetting(true);
    setError('');
    const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetting(false);
    if (resetError) setError('Não foi possível enviar a recuperação. Tente novamente.');
    else setNotice('Se a conta existir, receberá instruções de recuperação por email.');
  };

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">{publicContext.company_name || 'Casa de Pneus'}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Iniciar sessão</h1>
        <p className="mt-2 text-sm text-slate-500">Acesso reservado a utilizadores autorizados.</p>
        {publicContext.system_mode && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">Modo do sistema: {publicContext.system_mode === 'MIGRATION' ? 'PRODUCTION' : publicContext.system_mode}</p>}

        {!isSupabaseConfigured ? (
          <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">A autenticação não está configurada neste ambiente.</div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Email</span>
              <input ref={emailRef} autoFocus className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Palavra-passe</span>
              <span className="relative block">
                <input className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">{notice}</p>}
            <button className="w-full rounded-xl bg-primary px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={submitting}>{submitting ? 'A entrar…' : 'Entrar'}</button>
            <button type="button" disabled={resetting} onClick={handleReset} className="w-full text-sm font-bold text-primary underline disabled:opacity-60">{resetting ? 'A enviar…' : 'Esqueci-me da palavra-passe'}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function PasswordChangeGate({ onComplete, onSignOut }: { onComplete: () => Promise<void>; onSignOut: () => Promise<unknown> }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const strong = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!strong || password !== confirm) {
      setError('Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo; as palavras-passe devem coincidir.');
      return;
    }
    setSaving(true);
    setError('');
    const client = requireSupabase();
    const { error: updateError } = await client.auth.updateUser({ password });
    if (!updateError) {
      const { error: completionError } = await client.rpc('complete_first_login_password_change');
      if (!completionError) {
        setPassword('');
        setConfirm('');
        await onComplete();
        return;
      }
      setError('A palavra-passe mudou, mas não foi possível concluir a ativação. Entre novamente.');
    } else setError('Não foi possível alterar a palavra-passe. Tente uma palavra-passe diferente.');
    setSaving(false);
  };

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-black">Definir nova palavra-passe</h1>
        <p className="text-sm text-slate-600">Por segurança, altere a palavra-passe temporária antes de continuar.</p>
        <label className="block text-sm font-bold">Nova palavra-passe<input autoFocus type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border px-4 py-3" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label className="block text-sm font-bold">Confirmar palavra-passe<input type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border px-4 py-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
        <p className="text-xs text-slate-500">Mínimo 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button disabled={saving || !strong || password !== confirm} className="w-full rounded-xl bg-primary px-4 py-3 font-black text-white disabled:opacity-50">{saving ? 'A guardar…' : 'Guardar e continuar'}</button>
        <button type="button" onClick={() => void onSignOut()} className="w-full text-sm font-bold text-primary underline">Terminar sessão</button>
      </form>
    </main>
  );
}
