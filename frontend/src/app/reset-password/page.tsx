'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Zap, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Паролі не співпадають');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      toast.error('Пароль має містити мінімум 8 символів: літери та цифри');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset', { token, password });
      toast.success('Пароль оновлено');
      router.replace('/login');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Помилка';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_45%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </Link>
        </div>

        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 rounded-3xl blur-xl opacity-30" />
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
            <h2 className="text-2xl font-bold mb-1">Новий пароль</h2>
            <p className="text-sm text-white/50 mb-6">Задайте новий пароль для вашого акаунту</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField label="Новий пароль" value={password} onChange={setPassword} />
              <PasswordField label="Підтвердіть пароль" value={confirm} onChange={setConfirm} />

              <button
                type="submit"
                disabled={loading || !token}
                className="group relative w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium overflow-hidden disabled:opacity-50"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
                <span className="relative flex items-center gap-2 text-white">
                  {loading ? 'Збереження...' : 'Зберегти пароль'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm text-white/70 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          placeholder="Мінімум 8 символів"
          required
        />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05060f]" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
