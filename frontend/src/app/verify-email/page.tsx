'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Zap, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Невалідне посилання');
      return;
    }
    api.post('/auth/verify', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err?.response?.data?.error || 'Помилка');
      });
  }, [token]);

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
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="h-12 w-12 text-blue-400 mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-bold mb-2">Підтверджуємо email...</h2>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Email підтверджено!</h2>
                <p className="text-sm text-white/60 mb-6">Тепер ви можете повноцінно користуватись CRM</p>
                <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:opacity-90 transition">
                  Перейти до CRM
                </Link>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Помилка</h2>
                <p className="text-sm text-white/60 mb-6">{error}</p>
                <Link href="/login" className="text-blue-400 hover:text-blue-300">
                  Повернутись до входу
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05060f]" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
