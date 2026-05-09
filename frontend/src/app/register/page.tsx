'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import {
  Lock, Mail, Eye, EyeOff, Zap, User as UserIcon, Building2, ArrowRight,
  CheckCircle2, Sparkles,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error('Підтвердіть згоду з умовами');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      toast.error('Пароль має містити мінімум 8 символів: літери та цифри');
      return;
    }
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        organizationName: organizationName.trim() || undefined,
      });
      toast.success('Воркспейс створено! Ласкаво просимо 🎉');
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Помилка реєстрації';
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

      <div className="relative z-10 grid lg:grid-cols-2 max-w-5xl w-full gap-12 items-center">
        {/* Left: marketing */}
        <div className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">CRM Pro</span>
          </Link>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            Створіть свій <span className="animated-gradient-text">воркспейс</span> за 30 секунд
          </h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            Безкоштовний тариф включає 3 користувача, 500 замовлень/міс і 50 товарів.
            Без кредитки. Без телефонних дзвінків. Просто створи акаунт і почни працювати.
          </p>

          <ul className="space-y-3">
            {[
              'Повноцінний CRM з канбан-дошкою заказів',
              'Окремий колл-центр для команди',
              'Webhook для прийому заказів з лендінгу',
              'Аналітика, експорт у CSV',
              'Інтеграції з Telegram, Новою Поштою',
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/80">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: form */}
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold">CRM Pro</span>
            </Link>
          </div>

          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 rounded-3xl blur-xl opacity-30" />
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/80 mb-4">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>Безкоштовно. Без кредитки.</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">Створити акаунт</h2>
              <p className="text-sm text-white/50 mb-6">Початок роботи займе менше хвилини</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field
                  icon={UserIcon}
                  label="Ваше ім'я"
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder="Іван Петренко"
                  autoFocus
                />
                <Field
                  icon={Building2}
                  label="Назва компанії"
                  type="text"
                  value={organizationName}
                  onChange={setOrganizationName}
                  placeholder="Моя CRM (опціонально)"
                />
                <Field
                  icon={Mail}
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@company.com"
                  required
                />
                <div>
                  <label className="block text-sm text-white/70 mb-1.5">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                      placeholder="Мінімум 8 символів"
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

                <label className="flex items-start gap-2 text-sm text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-white/5"
                  />
                  <span>
                    Я погоджуюсь з{' '}
                    <a className="text-blue-400 hover:text-blue-300">умовами</a> та{' '}
                    <a className="text-blue-400 hover:text-blue-300">політикою конфіденційності</a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading || !agreed}
                  className="group relative w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-medium overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center gap-2 text-white">
                    {isLoading ? 'Створюємо...' : 'Створити воркспейс'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              </form>

              <p className="text-center text-sm text-white/50 mt-6">
                Вже маєте акаунт?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                  Увійти
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, label, type, value, onChange, placeholder, required, autoFocus,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-white/70 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
