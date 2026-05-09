'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { Lock, Mail, Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email.trim(), password);
      const { user } = useAuthStore.getState();
      router.replace(user?.role === 'CALL_CENTER' ? '/cc' : '/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Помилка входу';
      toast.error(msg);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(20,184,166,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold">З поверненням</h1>
          <p className="text-white/50 mt-1">Увійдіть, щоб продовжити</p>
        </div>

        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 rounded-3xl blur-xl opacity-30" />
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-white/70 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="you@company.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm text-white/70">Пароль</label>
                  <Link href="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300">
                    Забули?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium overflow-hidden disabled:opacity-50"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2 text-white">
                  {isLoading ? 'Вхід...' : 'Увійти'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </form>

            <p className="text-center text-sm text-white/50 mt-6">
              Немає акаунту?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                Створити безкоштовно
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
