'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowRight,
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Bell,
  Zap,
  Shield,
  Webhook,
  Send,
  Activity,
  Sparkles,
  Layers,
  PhoneCall,
  Clock,
  CheckCircle2,
  TrendingUp,
  Globe,
  Lock,
  Cpu,
} from 'lucide-react';

const features = [
  {
    icon: ShoppingCart,
    title: 'Управление заказами',
    desc: 'Канбан-доска, статусы, история изменений и автоматическое назначение менеджеров.',
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    icon: Users,
    title: 'База клиентов',
    desc: 'Полная история взаимодействий, сегментация и быстрый поиск по контактам.',
    gradient: 'from-violet-500 to-fuchsia-400',
  },
  {
    icon: Package,
    title: 'Каталог товаров',
    desc: 'Складской учёт, остатки, цены и категории — всё в одном месте.',
    gradient: 'from-amber-500 to-orange-400',
  },
  {
    icon: BarChart3,
    title: 'Аналитика и отчёты',
    desc: 'Графики продаж, конверсия, расходы и рентабельность в реальном времени.',
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    icon: Webhook,
    title: 'Webhook API',
    desc: 'Принимайте заказы с любого сайта или лендинга через защищённый webhook.',
    gradient: 'from-rose-500 to-pink-400',
  },
  {
    icon: Send,
    title: 'Telegram-бот',
    desc: 'Мгновенные уведомления о новых заказах прямо в мессенджер команды.',
    gradient: 'from-sky-500 to-indigo-400',
  },
];

const stats = [
  { value: '99.9%', label: 'Uptime', icon: Activity },
  { value: '<50ms', label: 'API Response', icon: Zap },
  { value: '4', label: 'Роли доступа', icon: Shield },
  { value: '24/7', label: 'Мониторинг', icon: Clock },
];

const roles = [
  {
    name: 'ADMIN',
    desc: 'Полный доступ ко всем разделам, настройкам, интеграциям и пользователям.',
    color: 'text-rose-400',
    border: 'border-rose-500/30',
    bg: 'from-rose-500/10',
  },
  {
    name: 'MANAGER',
    desc: 'Работа с заказами, клиентами, товарами и аналитикой по своим продажам.',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'from-blue-500/10',
  },
  {
    name: 'CALL_CENTER',
    desc: 'Обзвон лидов, обновление статусов, ввод данных доставки Новой Почты.',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'from-amber-500/10',
  },
  {
    name: 'VIEWER',
    desc: 'Только просмотр заказов и аналитики — для аудиторов и наблюдателей.',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'from-emerald-500/10',
  },
];

const techPoints = [
  { icon: Globe, label: 'Real-time SSE события' },
  { icon: Lock, label: 'JWT + bcrypt + RBAC' },
  { icon: Cpu, label: 'Next.js 14 + Express + Prisma' },
  { icon: TrendingUp, label: 'Интеграция с Новой Почтой' },
];

export default function HomePage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (_hasHydrated && user) {
      router.replace('/dashboard');
    }
  }, [user, _hasHydrated, router]);

  if (!mounted || (_hasHydrated && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060f]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(20,184,166,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Navbar */}
      <header className="relative z-20">
        <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-fuchsia-500 blur-lg opacity-50 -z-10" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CRM Pro</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition-colors">Возможности</a>
            <a href="#roles" className="hover:text-white transition-colors">Роли</a>
            <a href="#tech" className="hover:text-white transition-colors">Технологии</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Войти
            </button>
            <button
              onClick={() => router.push('/register')}
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 opacity-90 group-hover:opacity-100 transition-opacity" />
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
              <span className="relative flex items-center gap-2">
                Начать бесплатно
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="flex flex-col items-center text-center">
          <div className="reveal animate-float-slow inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs text-white/80 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Новое поколение управления товарным бизнесом</span>
          </div>

          <h1 className="reveal reveal-2 text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] max-w-5xl">
            <span className="block bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
              Управляйте бизнесом
            </span>
            <span className="block mt-2 animated-gradient-text">
              как из будущего
            </span>
          </h1>

          <p className="reveal reveal-3 mt-8 max-w-2xl text-lg md:text-xl text-white/60 leading-relaxed">
            Полнофункциональная CRM-платформа для товарного бизнеса. Заказы, клиенты,
            товары, аналитика и интеграции — всё в одной экосистеме реального времени.
          </p>

          <div className="reveal reveal-4 mt-10 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => router.push('/register')}
              className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600" />
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2 text-white">
                Начать бесплатно
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-white/80 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur-md transition-colors"
            >
              Посмотреть возможности
            </a>
          </div>
          <p className="reveal reveal-5 mt-6 text-sm text-white/40">
            Без кредитки · 3 пользователя · 500 заказов/мес
          </p>

          {/* Hero preview / glass card */}
          <div className="reveal reveal-5 mt-20 w-full max-w-5xl">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-70 transition-opacity" />
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/70" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
                  </div>
                  <div className="flex-1 text-center text-xs text-white/40">crm.app — Dashboard</div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Заказы сегодня', value: '124', icon: ShoppingCart, c: 'from-blue-500 to-cyan-400' },
                    { label: 'Выручка', value: '₴48 250', icon: TrendingUp, c: 'from-emerald-500 to-teal-400' },
                    { label: 'Конверсия', value: '32%', icon: BarChart3, c: 'from-violet-500 to-fuchsia-400' },
                    { label: 'Новые клиенты', value: '47', icon: Users, c: 'from-amber-500 to-orange-400' },
                  ].map((s, i) => (
                    <div
                      key={s.label}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.08] transition-colors"
                      style={{ animation: `fadeUp 0.6s ease-out ${0.1 * i + 0.6}s both` }}
                    >
                      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.c} shadow-lg mb-3`}>
                        <s.icon className="h-4.5 w-4.5 text-white" />
                      </div>
                      <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                      <div className="text-xs text-white/50 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 h-40 flex items-end gap-2">
                    {[40, 65, 50, 80, 45, 70, 90, 60, 85, 75, 95, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 via-violet-500 to-fuchsia-400"
                        style={{
                          height: `${h}%`,
                          animation: `growBar 1s ease-out ${0.05 * i + 1}s both`,
                          opacity: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="reveal-on-scroll relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md hover:border-white/20 hover:bg-white/[0.06] transition-all"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <s.icon className="h-5 w-5 text-white/50 mb-3" />
              <div className="text-3xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-sm text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 mb-4">
            <Layers className="h-3 w-3" />
            <span>Возможности</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Всё, что нужно для <span className="animated-gradient-text">современного бизнеса</span>
          </h2>
          <p className="mt-4 text-white/60 max-w-2xl mx-auto">
            Шесть мощных модулей в одной системе. Автоматизация, контроль и рост — без хаоса в табличках.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="reveal-on-scroll group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md hover:border-white/25 transition-all duration-300 overflow-hidden"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`} />
              <div className="relative">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 mb-4">
            <Shield className="h-3 w-3" />
            <span>Роли и доступы</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Гибкая <span className="animated-gradient-text">система прав</span>
          </h2>
          <p className="mt-4 text-white/60 max-w-2xl mx-auto">
            Каждый видит только то, что должен видеть. Полный контроль над тем, кто и что может делать.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((r, i) => (
            <div
              key={r.name}
              className={`reveal-on-scroll relative rounded-2xl border ${r.border} bg-gradient-to-b ${r.bg} to-transparent p-6 backdrop-blur-md hover:scale-[1.02] transition-transform duration-300`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`text-xs font-mono tracking-wider ${r.color} mb-3`}>● {r.name}</div>
              <p className="text-sm text-white/70 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech / Real-time */}
      <section id="tech" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="reveal-on-scroll">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 mb-4">
              <Cpu className="h-3 w-3" />
              <span>Под капотом</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Технологии, которым <span className="animated-gradient-text">можно доверять</span>
            </h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              Современный стек, продуманная архитектура и уровень безопасности корпоративных решений.
              Real-time события через SSE, JWT-аутентификация, RBAC и защищённые webhook-токены.
            </p>
            <div className="space-y-3">
              {techPoints.map((t, i) => (
                <div
                  key={t.label}
                  className="flex items-center gap-3 reveal-on-scroll"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
                    <t.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <span className="text-white/80">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal-on-scroll relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 rounded-3xl blur-2xl opacity-30" />
            <div className="relative rounded-3xl border border-white/10 bg-[#0a0c1a]/80 backdrop-blur-xl p-6 font-mono text-sm overflow-hidden">
              <div className="flex items-center gap-1.5 mb-4">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-xs text-white/40">webhook.ts</span>
              </div>
              <pre className="text-xs leading-6 text-white/80 whitespace-pre-wrap">
<span className="text-violet-400">POST</span> <span className="text-emerald-400">/api/webhook/order</span>
<span className="text-white/40">// X-Webhook-Token: ●●●●●●●●</span>
{'{'}
  <span className="text-blue-300">"customer"</span>: {'{'}
    <span className="text-blue-300">"name"</span>: <span className="text-amber-300">"Иван Петров"</span>,
    <span className="text-blue-300">"phone"</span>: <span className="text-amber-300">"+380..."</span>
  {'}'},
  <span className="text-blue-300">"items"</span>: [
    {'{'} <span className="text-blue-300">"sku"</span>: <span className="text-amber-300">"PRD-001"</span>, <span className="text-blue-300">"qty"</span>: <span className="text-fuchsia-300">2</span> {'}'}
  ]
{'}'}

<span className="text-emerald-400">→ 201 Created</span>  <span className="text-white/40">orderNum: ORD-1042</span>
<span className="text-emerald-400">→ SSE event broadcast</span>
<span className="text-emerald-400">→ Telegram notification sent</span>
              </pre>
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                live
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Полный цикл — <span className="animated-gradient-text">от лида до доставки</span>
          </h2>
        </div>
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent hidden md:block" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: Webhook, title: 'Заказ поступает', desc: 'С лендинга через webhook или вручную', color: 'from-blue-500 to-cyan-400' },
              { icon: PhoneCall, title: 'Колл-центр', desc: 'Подтверждение и сбор данных', color: 'from-amber-500 to-orange-400' },
              { icon: Bell, title: 'Уведомления', desc: 'Telegram + SSE в реальном времени', color: 'from-violet-500 to-fuchsia-400' },
              { icon: CheckCircle2, title: 'Отправка', desc: 'Новая Почта, статусы, история', color: 'from-emerald-500 to-teal-400' },
            ].map((step, i) => (
              <div
                key={step.title}
                className="reveal-on-scroll relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md text-center"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg mb-4 animate-pulse-soft`}>
                  <step.icon className="h-7 w-7 text-white" />
                </div>
                <div className="text-xs text-white/40 mb-1">Шаг {i + 1}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-white/60">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="relative rounded-3xl border border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-violet-600/30 to-fuchsia-600/30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.4),transparent_50%),radial-gradient(circle_at_70%_50%,rgba(217,70,239,0.4),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="relative px-8 py-16 md:px-16 md:py-24 text-center">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
              Готовы вывести бизнес на новый уровень?
            </h2>
            <p className="mt-6 text-lg text-white/70 max-w-xl mx-auto">
              Войдите в систему и начните управлять заказами, клиентами и аналитикой уже сегодня.
            </p>
            <button
              onClick={() => router.push('/register')}
              className="mt-10 group relative inline-flex items-center gap-2 px-8 py-4 rounded-xl font-medium overflow-hidden"
            >
              <span className="absolute inset-0 bg-white" />
              <span className="absolute inset-0 bg-white blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2 text-gray-900">
                Создать аккаунт бесплатно
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-fuchsia-500 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span>CRM Pro © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Сделано с заботой о бизнесе</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
