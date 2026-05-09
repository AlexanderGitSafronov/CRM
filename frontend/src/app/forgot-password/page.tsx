'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Mail, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot', { email: email.trim() });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_45%)]" />
        <div className="orb orb-1" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </Link>
        </div>

        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 rounded-3xl blur-xl opacity-30" />
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
            {sent ? (
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Лист надіслано</h2>
                <p className="text-sm text-white/60">
                  Якщо акаунт з таким email існує, ми відправили інструкцію щодо відновлення паролю.
                  Перевірте пошту.
                </p>
                <Link href="/login" className="inline-block mt-6 text-blue-400 hover:text-blue-300">
                  Повернутись до входу
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-1">Відновлення паролю</h2>
                <p className="text-sm text-white/50 mb-6">Введіть email, на який зареєстровано акаунт</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        placeholder="you@company.com"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium overflow-hidden disabled:opacity-50"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
                    <span className="relative flex items-center gap-2 text-white">
                      {loading ? 'Відправляємо...' : 'Надіслати інструкцію'}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </button>
                </form>

                <p className="text-center text-sm text-white/50 mt-6">
                  <Link href="/login" className="text-blue-400 hover:text-blue-300">
                    ← Повернутись до входу
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
