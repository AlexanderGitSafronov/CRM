'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowRight,
  Play,
  Zap,
  Globe,
  Lock,
  ShieldCheck,
  Check,
  Plus,
  Minus,
  Truck,
  TrendingUp,
  PhoneCall,
  BellRing,
  Webhook,
  LayoutGrid,
  Table2,
  RotateCcw,
  HelpCircle,
  MessageCircle,
  Target,
  Wallet,
  Send,
  Instagram,
  Mail,
  Star,
} from 'lucide-react';

/* ------------------------------------------------------------------ data */

const integrations = [
  { icon: Truck, name: 'Нова Пошта' },
  { icon: MessageCircle, name: 'TurboSMS' },
  { icon: PhoneCall, name: 'Viber' },
  { icon: Send, name: 'Telegram' },
  { icon: Target, name: 'AdTrack' },
  { icon: Wallet, name: 'Rashod' },
  { icon: Webhook, name: 'Webhook API' },
];

const pains = [
  {
    icon: Table2,
    bg: '#FDECEC',
    fg: '#E5564D',
    title: 'Замовлення в табличках',
    desc: 'Excel і нотатки в телефоні — дублі, втрачені ліди й жодної історії дзвінків.',
  },
  {
    icon: Truck,
    bg: '#FFF3E2',
    fg: '#E08A2B',
    title: 'ТТН вручну, статуси наосліп',
    desc: 'Копіюєте адреси в кабінет Нової Пошти й по черзі перевіряєте, де яка посилка.',
  },
  {
    icon: HelpCircle,
    bg: '#EFEAFE',
    fg: '#7C5CE0',
    title: 'Незрозуміла ефективність',
    desc: 'Хто з менеджерів продає, які товари в плюсі, звідки приходять викупи — невідомо.',
  },
  {
    icon: RotateCcw,
    bg: '#E6F1FB',
    fg: '#2E72C7',
    title: 'Повернення зʼїдають прибуток',
    desc: 'Виручка є, а грошей нема: доставка в обидва боки й собівартість тихо вбивають маржу.',
  },
];

const features = [
  {
    icon: LayoutGrid,
    title: 'Замовлення під контролем',
    desc: 'Канбан і таблиця в одному вікні: тягніть картки по статусах, фільтруйте по SLA та «Недозвон», міняйте статуси масово. Повна історія, виявлення дублів і чорний список.',
  },
  {
    icon: Truck,
    title: 'ТТН Нової Пошти в один клік',
    desc: 'Накладна прямо з картки замовлення з автопошуком міст і відділень. Система сама трекає посилки кожні 5 хв і шле клієнту SMS, щойно вони прибули у відділення.',
  },
  {
    icon: TrendingUp,
    title: 'Чесний прибуток, а не виручка',
    desc: 'Виручка рахується лише по викуплених. Бачте вартість повернень, гроші в дорозі та вердикт по кожному товару: масштабувати, оптимізувати чи вимкнути.',
  },
  {
    icon: PhoneCall,
    title: 'Колл-центр на автопілоті',
    desc: 'Смарт-черга прозвону, авто-передзвін після «Недозвон», конверсія операторів і розрахунок зарплати КЦ: бонус за підтвердження плюс відсоток з допродажу.',
  },
  {
    icon: BellRing,
    title: 'Сповіщення в реальному часі',
    desc: 'Нове замовлення миттєво падає в Telegram з кнопками «Підтвердити / Скасувати». SSE-сповіщення команді, нагадування про передзвони й алерти про низький залишок.',
  },
  {
    icon: Webhook,
    title: 'Webhook API для будь-якого сайту',
    desc: 'Приймайте замовлення з лендингів, Instagram чи Facebook одним POST-запитом. UTM і Click ID зберігаються — видно, який канал приносить викуплені продажі, а не лише кліки.',
  },
];

const steps = [
  {
    n: '1',
    title: 'Замовлення надходить',
    desc: 'З лендингу, Instagram чи Telegram через Webhook API — автоматично потрапляє у вашу CRM.',
  },
  {
    n: '2',
    title: 'Колл-центр підтверджує',
    desc: 'Оператор телефонує з черги, уточнює деталі й ставить статус «Підтверджено».',
  },
  {
    n: '3',
    title: 'Сповіщення клієнту',
    desc: 'Telegram і SMS повідомляють про підтвердження, відправку та прибуття посилки у відділення.',
  },
  {
    n: '4',
    title: 'Відправка Новою Поштою',
    desc: 'ТТН в один клік, автотрекінг кожні 5 хв і статус «Доставлено» — без ручної роботи.',
  },
];

const plans = [
  {
    name: 'FREE',
    price: '0 ₴',
    period: 'назавжди',
    tag: 'Щоб почати й автоматизувати перші продажі',
    cta: 'Почати безкоштовно',
    highlight: false,
    features: [
      'До 3 користувачів',
      '500 замовлень / міс',
      '50 товарів у каталозі',
      'Нова Пошта, ТТН і автотрекінг',
      'Колл-центр і Webhook API',
    ],
  },
  {
    name: 'PRO',
    price: '599 ₴',
    period: '/ міс',
    tag: 'Для команд, що ростуть і рахують прибуток',
    cta: 'Обрати PRO',
    highlight: true,
    features: [
      'Розширені ліміти команди й замовлень',
      'SMS / Viber через TurboSMS',
      'Повна аналітика прибутку й повернень',
      'Вартість повернень і гроші в дорозі',
      'Розрахунок зарплати колл-центру',
    ],
  },
  {
    name: 'BUSINESS',
    price: 'Індивідуально',
    period: '',
    tag: 'Без лімітів, інтеграції та персональний супровід',
    cta: 'Звʼязатися з нами',
    highlight: false,
    features: [
      'Без лімітів команди та замовлень',
      'Інтеграції AdTrack і Rashod',
      'Атрибуція UTM / FB / TikTok',
      'Брендований трекінг і API-доступ',
      'Персональний менеджер і навчання',
    ],
  },
];

const faqs = [
  {
    q: 'Чи потрібна кредитна картка, щоб почати?',
    a: 'Ні. Тариф FREE безкоштовний назавжди: 3 користувачі, 500 замовлень на місяць і 50 товарів — без картки й прихованих умов.',
  },
  {
    q: 'Що буде, коли я перевищу ліміт замовлень?',
    a: 'Ми попередимо заздалегідь. Перейти на PRO можна будь-якої миті — дані залишаються на місці, нічого переносити не треба.',
  },
  {
    q: 'Чи безпечні мої дані?',
    a: 'Так. Кожен бізнес — ізольований воркспейс. Доступ захищено JWT + bcrypt і перевіркою ролей на кожному запиті, ведеться повний аудит-лог дій.',
  },
  {
    q: 'Чи можна імпортувати клієнтів і товари?',
    a: 'Так, через CSV з українськими, російськими чи англійськими заголовками. Дублі по номеру телефону зливаються автоматично.',
  },
  {
    q: 'Як підключити Нову Пошту й Telegram?',
    a: 'У налаштуваннях вставляєте API-ключ Нової Пошти й токен Telegram-бота — ТТН, трекінг і сповіщення вмикаються одразу.',
  },
  {
    q: 'Скільки коштує після безкоштовного тарифу?',
    a: 'PRO — від 599 ₴/міс. BUSINESS — індивідуально, з інтеграціями AdTrack / Rashod і персональним менеджером.',
  },
];

/* ------------------------------------------------------------- helpers */

function delay(i: number, step = 80): CSSProperties {
  return { '--reveal-delay': `${i * step}ms` } as CSSProperties;
}

function BrowserFrame({
  src,
  alt,
  url,
  theme = 'dark',
  className = '',
}: {
  src: string;
  alt: string;
  url: string;
  theme?: 'dark' | 'light';
  className?: string;
}) {
  const dark = theme === 'dark';
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        dark
          ? 'border-[#33407a] bg-[#0b1228] shadow-2xl shadow-black/60'
          : 'border-[#e2e8f2] bg-white shadow-2xl shadow-slate-900/15'
      } ${className}`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3.5 py-2.5 ${
          dark ? 'border-[#222c52] bg-[#0e1430]' : 'border-[#e2e8f2] bg-[#f1f4f9]'
        }`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div
          className={`ml-1.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] ${
            dark
              ? 'bg-[#0a0f26] text-[#8893b5]'
              : 'border border-[#e2e8f2] bg-white text-[#64748b]'
          }`}
        >
          <Lock className="h-3 w-3 opacity-70" />
          {url}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  );
}

function Eyebrow({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'cyan' }) {
  return (
    <span
      className={`font-mono text-[13px] font-semibold uppercase tracking-[0.16em] ${
        tone === 'cyan' ? 'text-[#22d3ee]' : 'text-[#2563eb]'
      }`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- page */

export default function HomePage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number>(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (_hasHydrated && user) router.replace('/dashboard');
  }, [user, _hasHydrated, router]);

  // Scroll-reveal: add .is-visible as elements enter the viewport.
  useEffect(() => {
    if (!mounted) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [mounted]);

  // Спиннер показываем ТОЛЬКО когда реально редиректим залогиненного пользователя
  // (после mount). На сервере mounted=false → рендерим полный маркетинговый контент,
  // иначе единственная SEO-страница отдавала бы краулерам/скрейперам пустой спиннер.
  if (mounted && _hasHydrated && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05060f]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  const goRegister = () => router.push('/register');
  const goLogin = () => router.push('/login');

  return (
    <div className="min-h-screen bg-white font-sans text-[#0b1220] antialiased">
      {/* ============================================================ NAV */}
      <header className="sticky top-0 z-50 border-b border-[#1e274b] bg-[#05060f]">
        <nav className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-4">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#2563eb] to-[#06b6d4] shadow-lg shadow-primary-600/30">
              <Zap className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-[20px] font-bold text-white">CRM Pro</span>
          </a>
          <div className="hidden items-center gap-8 text-[15px] text-[#9aa6c7] lg:flex">
            <a href="#features" className="transition-colors hover:text-white">Можливості</a>
            <a href="#nova" className="transition-colors hover:text-white">Нова Пошта</a>
            <a href="#money" className="transition-colors hover:text-white">Аналітика</a>
            <a href="#pricing" className="transition-colors hover:text-white">Тарифи</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="hidden items-center gap-1.5 rounded-lg border border-[#1e274b] px-2.5 py-1.5 text-[14px] font-semibold text-[#9aa6c7] sm:inline-flex">
              <Globe className="h-3.5 w-3.5" /> UA
            </span>
            <button onClick={goLogin} className="hidden text-[15px] font-medium text-white transition-opacity hover:opacity-80 sm:block">
              Увійти
            </button>
            <button
              onClick={goRegister}
              className="btn-shine inline-flex items-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] px-5 py-2.5 text-[15px] font-semibold text-white shadow-lg shadow-primary-600/30 transition-transform hover:scale-[1.03]"
            >
              Почати безкоштовно
            </button>
          </div>
        </nav>
      </header>

      {/* =========================================================== HERO */}
      <section id="top" className="relative overflow-hidden bg-[#05060f] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/hero-warehouse.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05060f] via-[#05060f]/92 to-[#05060f]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05060f] via-transparent to-[#05060f]/70" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-20 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:py-28">
          {/* left */}
          <div className="flex flex-col items-start">
            <div data-reveal className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold text-[#e5ecff] backdrop-blur">
              🇺🇦 Створено для українського товарного бізнесу
            </div>
            <h1 data-reveal style={delay(1)} className="font-display text-[44px] font-bold leading-[1.08] tracking-tight md:text-[50px]">
              Від ліда до Нової Пошти — увесь товарний бізнес в одній системі
            </h1>
            <p data-reveal style={delay(2)} className="mt-6 max-w-[548px] text-[18px] leading-relaxed text-[#c2cbe0]">
              CRM Pro збирає замовлення з лендингів, Instagram і Telegram, виставляє ТТН Нової Пошти в один клік, веде колл-центр і показує реальний прибуток після викупу й повернень.
            </p>
            <div data-reveal style={delay(3)} className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                onClick={goRegister}
                className="btn-shine group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] px-7 py-4 text-[16px] font-semibold text-white shadow-xl shadow-primary-600/40 transition-all hover:shadow-2xl hover:shadow-primary-600/50"
              >
                Почати безкоштовно
                <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] px-6 py-4 text-[16px] font-medium text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                <Play className="h-4 w-4" />
                Подивитися демо
              </a>
            </div>
            <div data-reveal style={delay(4)} className="mt-7 flex items-center gap-2.5 text-[14px] font-medium text-[#9aa6c7]">
              <ShieldCheck className="h-[18px] w-[18px] text-[#22d3ee]" />
              Без картки · 3 користувачі · 500 замовлень/міс безкоштовно
            </div>
          </div>

          {/* right — real product dashboard */}
          <div data-reveal style={delay(2)} className="relative lg:pl-6">
            <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_60%_40%,rgba(37,99,235,0.45),transparent_65%)] blur-2xl" />
            <BrowserFrame
              className="animate-floaty"
              src="/landing/dashboard.png"
              alt="Дашборд CRM Pro"
              url="app.crmpro.ua/dashboard"
              theme="dark"
            />
          </div>
        </div>
      </section>

      {/* ========================================================== TRUST */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-11">
          <p data-reveal className="mb-6 text-center text-[13px] font-semibold tracking-wide text-[#94a0b5]">
            Працює з інструментами, якими ви вже користуєтесь
          </p>
          <div data-reveal style={delay(1)} className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
            {integrations.map((it) => (
              <div key={it.name} className="group flex items-center gap-2.5">
                <it.icon className="h-5 w-5 text-[#9aa6b8] transition-colors group-hover:text-[#2563eb]" />
                <span className="font-display text-[17px] font-semibold text-[#6b7891] transition-colors group-hover:text-[#0b1220]">
                  {it.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== PROBLEM */}
      <section className="bg-[#f7f9fc]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
            <div data-reveal><Eyebrow>Знайома ситуація?</Eyebrow></div>
            <h2 data-reveal style={delay(1)} className="mt-4 font-display text-[40px] font-bold leading-[1.12] tracking-tight">
              Замовлень більше — а контролю менше
            </h2>
            <p data-reveal style={delay(2)} className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-[#5b6573]">
              Коли все в табличках, месенджерах і голові — щось обовʼязково губиться. Ось що щодня зʼїдає ваш час і прибуток:
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pains.map((p, i) => (
              <div key={p.title} data-reveal style={delay(i)} className="hover-lift rounded-[18px] border border-[#e6ebf2] bg-white p-7 hover:border-[#cdd7e6] hover:shadow-xl hover:shadow-slate-900/5">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: p.bg }}>
                  <p.icon className="h-[23px] w-[23px]" style={{ color: p.fg }} />
                </span>
                <h3 className="font-display text-[18px] font-semibold">{p.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#5b6573]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= FEATURES */}
      <section id="features" className="bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="mx-auto flex max-w-[840px] flex-col items-center text-center">
            <div data-reveal><Eyebrow>Можливості</Eyebrow></div>
            <h2 data-reveal style={delay(1)} className="mt-4 font-display text-[42px] font-bold leading-[1.12] tracking-tight">
              Усе, щоб продавати більше — і <span className="text-grad-brand">втрачати менше</span>
            </h2>
            <p data-reveal style={delay(2)} className="mt-4 max-w-[680px] text-[17px] leading-relaxed text-[#5b6573]">
              Один інструмент замість десяти вкладок: від прийому замовлення до виплати й чесної аналітики прибутку.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                style={delay(i % 3)}
                className="hover-lift group relative overflow-hidden rounded-[18px] border border-[#e6ebf2] bg-white p-7 shadow-sm hover:border-[#cdd7e6] hover:shadow-xl hover:shadow-slate-900/5"
              >
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-15" />
                <span className="relative mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-gradient-to-br from-[#2563eb] to-[#06b6d4] shadow-lg shadow-primary-600/25 transition-transform duration-300 group-hover:scale-105">
                  <f.icon className="h-[26px] w-[26px] text-white" />
                </span>
                <h3 className="relative font-display text-[19px] font-semibold">{f.title}</h3>
                <p className="relative mt-3 text-[14.5px] leading-relaxed text-[#5b6573]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================== SHOWCASE: NP */}
      <section id="nova" className="bg-[#05060f] text-white">
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div data-reveal>
            <BrowserFrame src="/landing/order-detail.png" alt="Картка замовлення з ТТН Нової Пошти" url="app.crmpro.ua/orders/5" theme="dark" />
          </div>
          <div data-reveal style={delay(1)} className="flex flex-col items-start gap-[22px]">
            <Eyebrow tone="cyan">Нова Пошта · Замовлення</Eyebrow>
            <h2 className="font-display text-[36px] font-bold leading-[1.15] tracking-tight">
              Кожне замовлення — від дзвінка до дверей клієнта
            </h2>
            <p className="text-[17px] leading-relaxed text-[#9aa6c7]">
              Створюйте ТТН прямо з картки замовлення, змінюйте статус в один клік і бачте повну історію змін із автором і часом. Клієнт отримує SMS, щойно посилка прибула у відділення.
            </p>
            <ul className="flex flex-col gap-3.5">
              {[
                'ТТН і автотрекінг Нової Пошти кожні 5 хвилин',
                'Статуси: Новий → Підтверджено → Відправлено → Доставлено',
                'SMS клієнту та публічне посилання для стеження',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[15px] text-[#c2cbe0]">
                  <Check className="h-[18px] w-[18px] shrink-0 text-[#22d3ee]" /> {t}
                </li>
              ))}
            </ul>
            <a href="#features" className="group inline-flex items-center gap-2 text-[16px] font-semibold text-[#22d3ee]">
              Як працює доставка
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* ================================================ SHOWCASE: MONEY */}
      <section id="money" className="bg-[#f7f9fc]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 py-24 lg:grid-cols-[460px_minmax(0,1fr)]">
          <div data-reveal className="flex flex-col items-start gap-[22px]">
            <Eyebrow>Гроші · Аналітика</Eyebrow>
            <h2 className="font-display text-[36px] font-bold leading-[1.15] tracking-tight">
              Бачте чистий прибуток, а не лише виручку
            </h2>
            <p className="text-[17px] leading-relaxed text-[#5b6573]">
              CRM Pro рахує виручку тільки по викуплених замовленнях, віднімає вартість повернень і собівартість — і показує, скільки ви реально заробили. Плюс гроші в дорозі та прогноз виплат.
            </p>
            <ul className="flex flex-col gap-3.5">
              {[
                'Виручка, витрати й чистий прибуток за період',
                '% викупу: доставлено / повернено та вартість повернень',
                'Продажі по менеджерах і вердикт по кожному товару',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[15px] text-[#3f4a5c]">
                  <Check className="h-[18px] w-[18px] shrink-0 text-[#2563eb]" /> {t}
                </li>
              ))}
            </ul>
            <a href="#pricing" className="group inline-flex items-center gap-2 text-[16px] font-semibold text-[#2563eb]">
              Подивитися аналітику
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </a>
          </div>
          <div data-reveal style={delay(1)} className="lg:order-last">
            <BrowserFrame src="/landing/analytics.png" alt="Аналітика прибутку CRM Pro" url="app.crmpro.ua/analytics" theme="light" />
          </div>
        </div>
      </section>

      {/* =============================================== SHOWCASE: CALL-C */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 py-24 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div data-reveal>
            <BrowserFrame src="/landing/cc-orders.png" alt="Колл-центр CRM Pro" url="app.crmpro.ua/cc/queue" theme="light" />
          </div>
          <div data-reveal style={delay(1)} className="flex flex-col items-start gap-[22px]">
            <Eyebrow>Колл-центр · Команда</Eyebrow>
            <h2 className="font-display text-[36px] font-bold leading-[1.15] tracking-tight">
              Черга прозвону, що сама ставить задачі
            </h2>
            <p className="text-[17px] leading-relaxed text-[#5b6573]">
              Оператор бачить, кому дзвонити першим: спершу прострочені передзвони, потім нові замовлення, далі «Недозвон». Після невдалого дзвінка передзвін ставиться автоматично.
            </p>
            <ul className="flex flex-col gap-3.5">
              {[
                'Смарт-пріоритет черги та авто-передзвін',
                'Конверсія операторів і середній час відповіді',
                'Зарплата КЦ: бонус за підтвердження + % з допродажу',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[15px] text-[#3f4a5c]">
                  <Check className="h-[18px] w-[18px] shrink-0 text-[#2563eb]" /> {t}
                </li>
              ))}
            </ul>
            <a href="#features" className="group inline-flex items-center gap-2 text-[16px] font-semibold text-[#2563eb]">
              Як працює колл-центр
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* ==================================================== HOW IT WORKS */}
      <section className="bg-[#05060f] text-white">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="mx-auto flex max-w-[780px] flex-col items-center text-center">
            <div data-reveal><Eyebrow tone="cyan">Як це працює</Eyebrow></div>
            <h2 data-reveal style={delay(1)} className="mt-4 font-display text-[40px] font-bold leading-[1.12] tracking-tight">
              Від заявки до виплати — за чотири кроки
            </h2>
            <p data-reveal style={delay(2)} className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-[#9aa6c7]">
              Налаштуйте один раз — далі CRM Pro веде кожне замовлення майже сама.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.n} data-reveal style={delay(i)} className="hover-lift rounded-[18px] border border-[#1e274b] bg-[#0e142b] p-7">
                <span className="mb-4 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] font-display text-[18px] font-bold text-white">
                  {s.n}
                </span>
                <h3 className="font-display text-[18px] font-semibold">{s.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#9aa6c7]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================== MOBILE/APP */}
      <section className="bg-[#f7f9fc]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-16 px-6 py-24 lg:flex-row lg:gap-24">
          <div data-reveal className="shrink-0">
            <div className="animate-floaty rounded-[42px] border border-[#26304d] bg-[#0b0f1c] p-2.5 shadow-2xl shadow-slate-900/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/m-dashboard.png" alt="CRM Pro на смартфоні" className="block w-[280px] rounded-[32px]" loading="lazy" />
            </div>
          </div>
          <div data-reveal style={delay(1)} className="flex max-w-[460px] flex-col items-start gap-[22px]">
            <Eyebrow>Мобільно · Для клієнтів</Eyebrow>
            <h2 className="font-display text-[36px] font-bold leading-[1.15] tracking-tight">
              Уся CRM — у вашій кишені
            </h2>
            <p className="text-[17px] leading-relaxed text-[#5b6573]">
              Дашборд, замовлення й колл-центр працюють прямо в браузері смартфона. А клієнт стежить за посилкою за персональним посиланням — без реєстрації та у ваших кольорах.
            </p>
            <ul className="flex flex-col gap-3.5">
              {[
                'Адаптивний інтерфейс: телефон, планшет, десктоп',
                'Публічна сторінка трекінгу під вашим брендом',
                'Сповіщення в Telegram про кожну важливу подію',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[15px] text-[#3f4a5c]">
                  <Check className="h-[18px] w-[18px] shrink-0 text-[#2563eb]" /> {t}
                </li>
              ))}
            </ul>
            <button onClick={goRegister} className="group inline-flex items-center gap-2 text-[16px] font-semibold text-[#2563eb]">
              Спробувати на телефоні
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================== PRICING */}
      <section id="pricing" className="bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="mx-auto flex max-w-[780px] flex-col items-center text-center">
            <div data-reveal><Eyebrow>Тарифи</Eyebrow></div>
            <h2 data-reveal style={delay(1)} className="mt-4 font-display text-[42px] font-bold leading-[1.12] tracking-tight">
              Почніть безкоштовно — платіть, коли виростете
            </h2>
            <p data-reveal style={delay(2)} className="mt-4 max-w-[640px] text-[17px] leading-relaxed text-[#5b6573]">
              Без прихованих комісій. Тариф FREE — назавжди безкоштовний і без кредитної картки.
            </p>
          </div>
          <div className="mt-14 grid items-start gap-6 md:grid-cols-3">
            {plans.map((plan, i) => (
              <div key={plan.name} data-reveal style={delay(i)} className={plan.highlight ? 'relative rounded-[22px] bg-gradient-to-br from-[#2563eb] to-[#06b6d4] p-[1.5px] shadow-2xl shadow-primary-600/30' : ''}>
                <div
                  className={`flex h-full flex-col gap-[22px] rounded-[21px] p-8 ${
                    plan.highlight ? 'bg-[#05060f] text-white' : 'hover-lift border border-[#e6ebf2] bg-white hover:shadow-xl hover:shadow-slate-900/5'
                  }`}
                >
                  {plan.highlight && (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-white">
                      <Star className="h-3 w-3" /> Найпопулярніше
                    </span>
                  )}
                  <div className="flex flex-col gap-2.5">
                    <span className={`font-display text-[14px] font-bold uppercase tracking-wider ${plan.highlight ? 'text-[#22d3ee]' : 'text-[#2563eb]'}`}>
                      {plan.name}
                    </span>
                    <div className="flex items-end gap-1.5">
                      <span className={`font-display font-bold tracking-tight ${plan.name === 'BUSINESS' ? 'text-[32px]' : 'text-[40px]'} ${plan.highlight ? 'text-white' : 'text-[#0b1220]'}`}>
                        {plan.price}
                      </span>
                      {plan.period && <span className={`pb-1.5 text-[14px] ${plan.highlight ? 'text-[#9aa6c7]' : 'text-[#5b6573]'}`}>{plan.period}</span>}
                    </div>
                    <p className={`text-[14px] leading-snug ${plan.highlight ? 'text-[#9aa6c7]' : 'text-[#5b6573]'}`}>{plan.tag}</p>
                  </div>
                  <div className={`h-px w-full ${plan.highlight ? 'bg-[#1e274b]' : 'bg-[#e6ebf2]'}`} />
                  <ul className="flex flex-col gap-3.5">
                    {plan.features.map((feat) => (
                      <li key={feat} className={`flex items-center gap-2.5 text-[15px] ${plan.highlight ? 'text-[#c8d0e4]' : 'text-[#3f4a5c]'}`}>
                        <Check className={`h-[17px] w-[17px] shrink-0 ${plan.highlight ? 'text-[#22d3ee]' : 'text-[#2563eb]'}`} />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={plan.name === 'BUSINESS' ? goLogin : goRegister}
                    className={`btn-shine mt-auto w-full rounded-[10px] py-3.5 text-[15px] font-semibold transition ${
                      plan.highlight
                        ? 'bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white hover:shadow-lg hover:shadow-primary-600/40'
                        : 'border-[1.5px] border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb] hover:text-white'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ FAQ */}
      <section id="faq" className="bg-[#f7f9fc]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
            <div data-reveal><Eyebrow>Питання і відповіді</Eyebrow></div>
            <h2 data-reveal style={delay(1)} className="mt-4 font-display text-[40px] font-bold leading-[1.12] tracking-tight">
              Часті запитання
            </h2>
          </div>
          <div className="mx-auto mt-11 flex max-w-[880px] flex-col gap-4">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} data-reveal style={delay(Math.min(i, 4))} className="overflow-hidden rounded-2xl border border-[#e6ebf2] bg-white">
                  <button
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-7 py-6 text-left"
                  >
                    <span className="font-display text-[17px] font-semibold text-[#0b1220]">{f.q}</span>
                    {open ? <Minus className="h-5 w-5 shrink-0 text-[#2563eb]" /> : <Plus className="h-5 w-5 shrink-0 text-[#2563eb]" />}
                  </button>
                  <div
                    id={`faq-panel-${i}`}
                    className="grid transition-all duration-300 ease-out"
                    style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-7 pb-6 text-[15px] leading-relaxed text-[#5b6573]">{f.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================== FINAL CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1d4ed8] via-[#4f2eb0] to-[#7c3aed] text-white">
        <div className="absolute -left-40 -top-32 h-[520px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.55),transparent_70%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_85%)]" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-6 py-[104px] text-center">
          <div data-reveal><span className="font-mono text-[13px] font-semibold uppercase tracking-[0.2em] text-[#bfd3ff]">Почати зараз</span></div>
          <h2 data-reveal style={delay(1)} className="mt-5 max-w-[820px] font-display text-[46px] font-bold leading-[1.12] tracking-tight">
            Готові перестати губити замовлення?
          </h2>
          <p data-reveal style={delay(2)} className="mt-5 max-w-[640px] text-[18px] leading-relaxed text-[#dce4ff]">
            Створіть безкоштовний акаунт за хвилину — і вже сьогодні приймайте замовлення, виставляйте ТТН і бачте прибуток в одному вікні.
          </p>
          <div data-reveal style={delay(3)} className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
            <button onClick={goRegister} className="btn-shine group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[16px] font-semibold text-[#2563eb] shadow-xl shadow-black/20 transition-transform hover:scale-[1.03]">
              Створити акаунт безкоштовно
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/[0.1] px-6 py-4 text-[16px] font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Play className="h-4 w-4" /> Подивитися демо
            </a>
          </div>
          <p data-reveal style={delay(4)} className="mt-6 text-[14px] font-medium text-[#c7d2fe]">
            Без кредитної картки &nbsp;·&nbsp; Налаштування за 5 хвилин &nbsp;·&nbsp; Скасування будь-коли
          </p>
        </div>
      </section>

      {/* ========================================================= FOOTER */}
      <footer className="bg-[#0a0f22] text-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div className="flex flex-col justify-between gap-12 lg:flex-row">
            <div className="max-w-[330px]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-[#2563eb] to-[#06b6d4]">
                  <Zap className="h-[19px] w-[19px] text-white" />
                </span>
                <span className="font-display text-[19px] font-bold">CRM Pro</span>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-[#8e9aba]">
                CRM для українського товарного бізнесу: замовлення, Нова Пошта, колл-центр і чесна аналітика прибутку — в одній системі.
              </p>
              <div className="mt-5 flex items-center gap-2.5">
                {[Send, Instagram, Mail].map((Icon, i) => (
                  <span key={i} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#242e4f] bg-[#141b33] text-[#9aa6c7] transition-colors hover:border-[#2563eb] hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-[72px] gap-y-10">
              {[
                { h: 'Продукт', links: ['Можливості', 'Нова Пошта', 'Аналітика', 'Тарифи'] },
                { h: 'Компанія', links: ['Про нас', 'Блог', 'Контакти', 'Партнерам'] },
                { h: 'Ресурси', links: ['Документація', 'Webhook API', 'Підтримка', 'Статус системи'] },
              ].map((col) => (
                <div key={col.h} className="flex flex-col gap-3.5">
                  <span className="font-display text-[13px] font-bold tracking-wide text-white">{col.h}</span>
                  {col.links.map((l) => (
                    <a key={l} href="#top" className="text-[14.5px] text-[#9aa6c7] transition-colors hover:text-white">{l}</a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="my-11 h-px w-full bg-[#1b2342]" />
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-[14px] text-[#7886a6]">© 2026 CRM Pro · Зроблено з турботою про український бізнес 🇺🇦</span>
            <div className="flex items-center gap-6">
              <a href="/privacy" className="text-[14px] text-[#7886a6] transition-colors hover:text-white">Політика конфіденційності</a>
              <a href="/terms" className="text-[14px] text-[#7886a6] transition-colors hover:text-white">Умови використання</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
