'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { User } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Webhook,
  Bot,
  Copy,
  CheckCircle,
  Truck,
  Shield,
  Package,
  Loader2,
  MessageSquare,
  Palette,
  FileText,
  Languages,
} from 'lucide-react';
import NovaPoshtaSelect from '@/components/nova-poshta/NovaPoshtaSelect';
import ImageUploader from '@/components/ImageUploader';
import { useBrandingStore } from '@/stores/brandingStore';
import { useLocaleStore, useT } from '@/stores/localeStore';
import { LOCALES, type Locale } from '@/lib/i18n';

interface WebhookToken {
  id: string;
  name: string;
  token: string;
  active: boolean;
  createdAt: string;
}

const WEBHOOK_FIELDS: Array<[string, string, boolean, string]> = [
  ['customer.name', 'string', true, 'ПІБ клієнта'],
  ['customer.phone', 'string', true, 'Телефон у будь-якому форматі (+380...)'],
  ['customer.email', 'string', false, 'Email клієнта'],
  ['customer.city', 'string', false, 'Місто'],
  ['customer.address', 'string', false, 'Адреса'],
  ['items', 'array', true, 'Масив товарів (мінімум 1)'],
  ['items[].name', 'string', true, 'Назва товару'],
  ['items[].quantity', 'number', true, 'Кількість'],
  ['items[].price', 'number', true, 'Ціна за одиницю (грн)'],
  ['source', 'string', false, 'LANDING, WEBSITE, FACEBOOK, INSTAGRAM, TELEGRAM, WEBHOOK'],
  ['comment', 'string', false, 'Коментар до замовлення'],
  ['delivery.service', 'string', false, 'NOVA_POSHTA, UKRPOSHTA, COURIER, PICKUP'],
  ['delivery.city', 'string', false, 'Місто доставки'],
  ['delivery.address', 'string', false, 'Адреса / № відділення'],
  ['delivery.recipientName', 'string', false, 'Отримувач (якщо інший)'],
];

function getCodeSample(lang: 'curl' | 'js' | 'php' | 'python', apiUrl: string, token: string): string {
  const url = `${apiUrl}/api/webhook/order`;

  if (lang === 'curl') {
    return `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: ${token}" \\
  -d '{
    "customer": {
      "name": "Іван Петров",
      "phone": "+380501234567",
      "email": "ivan@example.com",
      "city": "Київ"
    },
    "items": [
      { "name": "Товар 1", "quantity": 2, "price": 999 }
    ],
    "source": "LANDING",
    "comment": "Замовлення з лендінгу"
  }'`;
  }

  if (lang === 'js') {
    return `// JavaScript / Node.js / форма на сайті
const response = await fetch('${url}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Token': '${token}',
  },
  body: JSON.stringify({
    customer: {
      name: 'Іван Петров',
      phone: '+380501234567',
      email: 'ivan@example.com',
      city: 'Київ',
    },
    items: [
      { name: 'Товар 1', quantity: 2, price: 999 },
    ],
    source: 'LANDING',
    comment: 'Замовлення з лендінгу',
  }),
});

const data = await response.json();
console.log(data); // { success: true, orderId: "...", orderNum: 42 }`;
  }

  if (lang === 'php') {
    return `<?php
$payload = [
  'customer' => [
    'name'  => 'Іван Петров',
    'phone' => '+380501234567',
    'email' => 'ivan@example.com',
    'city'  => 'Київ',
  ],
  'items' => [
    ['name' => 'Товар 1', 'quantity' => 2, 'price' => 999],
  ],
  'source'  => 'LANDING',
  'comment' => 'Замовлення з лендінгу',
];

$ch = curl_init('${url}');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => json_encode($payload),
  CURLOPT_HTTPHEADER     => [
    'Content-Type: application/json',
    'X-Webhook-Token: ${token}',
  ],
]);
$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo $status === 201 ? 'Заказ створено' : "Помилка: $response";`;
  }

  // python
  return `import requests

response = requests.post(
    '${url}',
    headers={
        'Content-Type': 'application/json',
        'X-Webhook-Token': '${token}',
    },
    json={
        'customer': {
            'name': 'Іван Петров',
            'phone': '+380501234567',
            'email': 'ivan@example.com',
            'city': 'Київ',
        },
        'items': [
            {'name': 'Товар 1', 'quantity': 2, 'price': 999},
        ],
        'source': 'LANDING',
        'comment': 'Замовлення з лендінгу',
    },
)

print(response.json())  # {'success': True, 'orderId': '...', 'orderNum': 42}`;
}

interface Integration {
  id: string;
  type: string;
  name: string;
  config: string;
  active: boolean;
}

export default function SettingsPage() {
  const { user: currentUser } = useAuthStore();
  const t = useT();
  const VALID_TABS = ['users', 'webhooks', 'integrations', 'general', 'templates'] as const;
  type TabId = (typeof VALID_TABS)[number];
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'users';
    const h = window.location.hash.replace('#', '');
    return (VALID_TABS as readonly string[]).includes(h) ? (h as TabId) : 'users';
  });

  // Синхронизируем активный таб с URL hash — выживает перезагрузку и share по ссылке.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cur = window.location.hash.replace('#', '');
    if (cur !== activeTab) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);

  // Back/forward → меняем таб
  useEffect(() => {
    function onHash() {
      const h = window.location.hash.replace('#', '');
      if ((VALID_TABS as readonly string[]).includes(h)) setActiveTab(h as TabId);
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [users, setUsers] = useState<User[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookToken[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  // User modals
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'MANAGER' });
  const [savingUser, setSavingUser] = useState(false);

  // Webhook modals
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // TurboSMS
  const [turboConfig, setTurboConfig] = useState({
    token: '',
    senderName: '',
    channel: 'viber_sms' as 'sms' | 'viber' | 'viber_sms',
    active: false,
  });
  const [savingTurbo, setSavingTurbo] = useState(false);
  const [testingTurbo, setTestingTurbo] = useState(false);
  const [turboTestPhone, setTurboTestPhone] = useState('');

  // Telegram
  const [telegramConfig, setTelegramConfig] = useState({ botToken: '', chatId: '', active: false });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  // AdTrack (optional integration — wires order status to ad platforms via AdTrack)
  const [adtrackConfig, setAdtrackConfig] = useState({
    trackingId: '',
    webhookSecret: '',
    baseUrl: 'https://adtrack-backend.vercel.app',
    active: false,
  });
  const [savingAdtrack, setSavingAdtrack] = useState(false);
  const [testingAdtrack, setTestingAdtrack] = useState(false);
  // true → секрет уже лежит в БД (показываем плейсхолдер вместо маски в инпуте)
  const [adtrackSecretSaved, setAdtrackSecretSaved] = useState(false);

  // NP Tracker status
  interface TrackerStatus {
    isRunning: boolean;
    lastRun: string | null;
    lastResult: { checked: number; updated: number; errors: number } | null;
    nextRun: string | null;
    pendingOrders: number;
    schedule: string;
  }
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus | null>(null);
  const [runningTracker, setRunningTracker] = useState(false);

  const fetchTrackerStatus = async () => {
    try {
      const res = await api.get('/nova-poshta/tracker/status');
      setTrackerStatus(res.data);
    } catch {}
  };

  const handleRunTracker = async () => {
    setRunningTracker(true);
    try {
      await api.post('/nova-poshta/tracker/run');
      toast.success('Трекер запущено');
      setTimeout(fetchTrackerStatus, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setRunningTracker(false);
  };

  // Nova Poshta Sender
  const [npConfig, setNpConfig] = useState({
    apiKey: '',
    senderPhone: '',
    citySenderRef: '',
    citySenderLabel: '',
    senderAddressRef: '',
    senderAddressLabel: '',
    senderRef: '',
    contactSenderRef: '',
    active: false,
  });
  const [savingNp, setSavingNp] = useState(false);
  const [fetchingNp, setFetchingNp] = useState(false);

  useEffect(() => {
    fetchTrackerStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [usersRes, webhooksRes, intRes] = await Promise.all([
          api.get('/users'),
          api.get('/webhook/tokens'),
          api.get('/integrations'),
        ]);
        setUsers(usersRes.data);
        setWebhooks(webhooksRes.data);
        const ints = intRes.data as Integration[];
        setIntegrations(ints);
        const tg = ints.find((i) => i.type === 'TELEGRAM');
        if (tg) {
          const cfg = JSON.parse(tg.config);
          setTelegramConfig({ botToken: cfg.botToken || '', chatId: cfg.chatId || '', active: tg.active });
        }
        const turbo = ints.find((i) => i.type === 'TURBOSMS');
        if (turbo) {
          const cfg = JSON.parse(turbo.config);
          setTurboConfig({
            token: cfg.token || '',
            senderName: cfg.senderName || '',
            channel: cfg.channel || 'viber_sms',
            active: turbo.active,
          });
        }
        const np = ints.find((i) => i.type === 'NOVA_POSHTA_SENDER');
        if (np) {
          const cfg = JSON.parse(np.config);
          setNpConfig({
            apiKey: cfg.apiKey || '',
            senderPhone: cfg.senderPhone || '',
            citySenderRef: cfg.citySenderRef || '',
            citySenderLabel: cfg.citySenderLabel || '',
            senderAddressRef: cfg.senderAddressRef || '',
            senderAddressLabel: cfg.senderAddressLabel || '',
            senderRef: cfg.senderRef || '',
            contactSenderRef: cfg.contactSenderRef || '',
            active: np.active,
          });
        }
        const adt = ints.find((i) => i.type === 'ADTRACK');
        if (adt) {
          const cfg = JSON.parse(adt.config);
          const rawSecret = (cfg.webhookSecret || '') as string;
          // GET /integrations маскирует secret как aaaa****bbbb. Не показываем маску
          // в input (она вводит в заблуждение про длину). Помечаем флагом secretSet.
          const isMasked = /\*{3,}/.test(rawSecret);
          setAdtrackConfig({
            trackingId: cfg.trackingId || '',
            webhookSecret: isMasked ? '' : rawSecret,
            baseUrl: cfg.baseUrl || 'https://adtrack-backend.vercel.app',
            active: adt.active,
          });
          setAdtrackSecretSaved(isMasked || !!rawSecret);
        }
      } catch {}
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          ...(userForm.password && { password: userForm.password }),
        });
        toast.success('Пользователь обновлён');
      } else {
        await api.post('/users', userForm);
        toast.success('Пользователь создан');
      }
      setShowUserForm(false);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка';
      toast.error(msg);
    }
    setSavingUser(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await api.delete(`/users/${deleteUserId}`);
      toast.success('Пользователь удалён');
      setDeleteUserId(null);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка';
      toast.error(msg);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/webhook/tokens', { name: webhookName });
      toast.success('Токен создан');
      setWebhookName('');
      setShowWebhookForm(false);
      const res = await api.get('/webhook/tokens');
      setWebhooks(res.data);
    } catch {
      toast.error('Ошибка');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await api.delete(`/webhook/tokens/${id}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success('Токен удалён');
    } catch {}
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success('Скопировано');
  };

  const handleFetchNpSender = async () => {
    if (!npConfig.citySenderRef || !npConfig.senderAddressRef) {
      toast.error('Спочатку виберіть місто та відділення відправника');
      return;
    }
    setFetchingNp(true);
    try {
      const res = await api.post('/nova-poshta/fetch-sender', {
        phone: npConfig.senderPhone,
        cityRef: npConfig.citySenderRef,
        warehouseRef: npConfig.senderAddressRef,
      });
      setNpConfig((p) => ({
        ...p,
        senderRef: res.data.senderRef,
        contactSenderRef: res.data.contactSenderRef,
      }));
      toast.success(`Знайдено: ${res.data.senderName}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setFetchingNp(false);
  };

  const handleSaveNpSender = async () => {
    setSavingNp(true);
    try {
      await api.put('/integrations/NOVA_POSHTA_SENDER', {
        config: {
          apiKey: npConfig.apiKey,
          senderPhone: npConfig.senderPhone,
          citySenderRef: npConfig.citySenderRef,
          citySenderLabel: npConfig.citySenderLabel,
          senderAddressRef: npConfig.senderAddressRef,
          senderAddressLabel: npConfig.senderAddressLabel,
          senderRef: npConfig.senderRef,
          contactSenderRef: npConfig.contactSenderRef,
        },
        active: npConfig.active,
      });
      toast.success('Налаштування відправника НП збережено');
    } catch {
      toast.error('Помилка');
    }
    setSavingNp(false);
  };

  const handleSaveTurbo = async () => {
    setSavingTurbo(true);
    try {
      await api.put('/integrations/TURBOSMS', {
        config: { token: turboConfig.token, senderName: turboConfig.senderName, channel: turboConfig.channel },
        active: turboConfig.active,
      });
      toast.success('Налаштування TurboSMS збережено');
    } catch {
      toast.error('Помилка');
    }
    setSavingTurbo(false);
  };

  const handleTestTurbo = async () => {
    if (!turboTestPhone) { toast.error('Введіть номер телефону для тесту'); return; }
    setTestingTurbo(true);
    try {
      await api.post('/integrations/turbosms/test', {
        token: turboConfig.token,
        senderName: turboConfig.senderName,
        channel: turboConfig.channel,
        phone: turboTestPhone,
      });
      toast.success('Тестове повідомлення надіслано!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setTestingTurbo(false);
  };

  const handleSaveTelegram = async () => {
    setSavingTelegram(true);
    try {
      await api.put('/integrations/TELEGRAM', {
        config: { botToken: telegramConfig.botToken, chatId: telegramConfig.chatId },
        active: telegramConfig.active,
      });
      toast.success('Настройки Telegram сохранены');
    } catch {
      toast.error('Ошибка');
    }
    setSavingTelegram(false);
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    try {
      await api.post('/integrations/telegram/test', {
        botToken: telegramConfig.botToken,
        chatId: telegramConfig.chatId,
      });
      toast.success('Тестовое сообщение отправлено!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка';
      toast.error(msg);
    }
    setTestingTelegram(false);
  };

  // Строит config для PUT: webhookSecret отправляется только если юзер реально его ввёл.
  // Пустое поле = «не менять», backend оставит существующий ключ.
  const buildAdtrackConfig = () => {
    const cfg: Record<string, string> = {
      trackingId: adtrackConfig.trackingId.trim(),
      baseUrl: adtrackConfig.baseUrl.trim() || 'https://adtrack-backend.vercel.app',
    };
    const s = adtrackConfig.webhookSecret.trim();
    if (s) cfg.webhookSecret = s;
    return cfg;
  };

  const handleSaveAdtrack = async () => {
    setSavingAdtrack(true);
    try {
      await api.put('/integrations/ADTRACK', {
        config: buildAdtrackConfig(),
        active: adtrackConfig.active,
      });
      // Если юзер ввёл новый секрет — очищаем поле и помечаем как «збережено».
      if (adtrackConfig.webhookSecret.trim()) {
        setAdtrackConfig((p) => ({ ...p, webhookSecret: '' }));
        setAdtrackSecretSaved(true);
      }
      toast.success('AdTrack збережено');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setSavingAdtrack(false);
  };

  // Авто-сохранение при клике на тогл Активна. Не требует жать «Зберегти».
  // При выключении — пишет в БД active=false мгновенно.
  // При включении — то же, но если trackingId/secret пусты, делаем optimistic toggle
  // и подсказываем что нужно заполнить креды (само сохранение тогла active=true пройдёт,
  // адаптер silent-skip'нет вебхуки до тех пор пока конфиг не валиден).
  const toggleAdtrackActive = async () => {
    const next = !adtrackConfig.active;
    setAdtrackConfig((p) => ({ ...p, active: next }));
    try {
      await api.put('/integrations/ADTRACK', {
        config: buildAdtrackConfig(),
        active: next,
      });
      toast.success(next ? 'AdTrack увімкнено' : 'AdTrack вимкнено');
    } catch (err: unknown) {
      setAdtrackConfig((p) => ({ ...p, active: !next }));
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
  };

  const handleTestAdtrack = async () => {
    setTestingAdtrack(true);
    try {
      await api.post('/integrations/adtrack/test', {
        trackingId: adtrackConfig.trackingId.trim(),
        webhookSecret: adtrackConfig.webhookSecret.trim(),
        baseUrl: adtrackConfig.baseUrl.trim(),
      });
      toast.success('AdTrack працює — тестова подія прийнята');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(`AdTrack: ${msg}`);
    }
    setTestingAdtrack(false);
  };

  const ROLE_LABELS = { ADMIN: 'Администратор', MANAGER: 'Менеджер', VIEWER: 'Просмотр', CALL_CENTER: 'Колл-центр' };
  const ROLE_COLORS = {
    ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    VIEWER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    CALL_CENTER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  // Real backend URL (env-configured), not host:3001
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  const sampleToken = webhooks[0]?.token || 'YOUR_WEBHOOK_TOKEN';
  const [docLang, setDocLang] = useState<'curl' | 'js' | 'php' | 'python'>('curl');

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit overflow-x-auto">
        {([
          { key: 'users', tKey: 'settings.tabs.users', icon: Users },
          { key: 'general', tKey: 'settings.tabs.general', icon: Languages },
          { key: 'templates', tKey: 'settings.tabs.templates', icon: FileText },
          { key: 'webhooks', tKey: 'settings.tabs.webhooks', icon: Webhook },
          { key: 'integrations', tKey: 'settings.tabs.integrations', icon: Bot },
        ] as const).map(({ key, tKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(tKey)}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Пользователи и роли</h2>
            <button
              onClick={() => {
                setEditUser(null);
                setUserForm({ name: '', email: '', password: '', role: 'MANAGER' });
                setShowUserForm(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
              </div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                    <span className="font-semibold text-primary-700 dark:text-primary-400">
                      {u.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{u.name}</span>
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-primary-600">(вы)</span>
                      )}
                      {!u.active && (
                        <span className="text-xs text-red-500">(неактивен)</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{u.email}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role as keyof typeof ROLE_COLORS]}`}>
                    {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
                  </span>
                  {u.id !== currentUser?.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditUser(u);
                          setUserForm({ name: u.name, email: u.email, password: '', role: u.role });
                          setShowUserForm(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteUserId(u.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* General tab — language picker */}
      {activeTab === 'general' && <GeneralTab />}

      {/* Templates tab */}
      {activeTab === 'templates' && <TemplatesTab />}

      {/* Webhooks tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {/* Quick start banner */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Webhook className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Прийом замовлень з лендінгу</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Налаштуйте форму на сайті надсилати POST-запит на ваш endpoint — і нові заказы автоматично з&apos;являться в CRM.
                </p>
              </div>
            </div>
          </div>

          {/* Endpoint */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">1. Endpoint</h3>
            <div className="flex items-center gap-2 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg px-3 py-2.5 font-mono text-sm">
              <span className="text-emerald-400 font-semibold shrink-0">POST</span>
              <span className="truncate">{apiUrl}/api/webhook/order</span>
              <button
                onClick={() => handleCopy(`${apiUrl}/api/webhook/order`)}
                className="ml-auto shrink-0 text-gray-400 hover:text-white p-1 rounded transition-colors"
                title="Скопіювати"
              >
                {copiedToken === `${apiUrl}/api/webhook/order` ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Додайте заголовок <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">X-Webhook-Token</code> зі своїм токеном (з блоку нижче) або передайте токен як query-параметр <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">?token=...</code>
            </p>
          </div>

          {/* Tokens */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" /> 2. Ваші токени
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Кожен лендінг може мати свій токен — для статистики джерел</p>
              </div>
              <button onClick={() => setShowWebhookForm(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Створити токен
              </button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{wh.name}</p>
                    <p className="font-mono text-xs text-gray-400 truncate">{wh.token}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(wh.token)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                    title="Скопіювати"
                  >
                    {copiedToken === wh.token ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {webhooks.length === 0 && (
                <p className="p-6 text-center text-gray-400 text-sm">Токенів ще немає — створіть перший</p>
              )}
            </div>
          </div>

          {/* Code examples */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">3. Приклад запиту</h3>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                {(['curl', 'js', 'php', 'python'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setDocLang(lang)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      docLang === lang
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {lang === 'js' ? 'JavaScript' : lang === 'curl' ? 'cURL' : lang === 'php' ? 'PHP' : 'Python'}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => handleCopy(getCodeSample(docLang, apiUrl, sampleToken))}
                className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700 rounded transition-colors"
                title="Скопіювати"
              >
                {copiedToken === getCodeSample(docLang, apiUrl, sampleToken)
                  ? <CheckCircle className="w-4 h-4 text-green-400" />
                  : <Copy className="w-4 h-4" />}
              </button>
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-5 text-xs leading-relaxed overflow-x-auto">
                <code>{getCodeSample(docLang, apiUrl, sampleToken)}</code>
              </pre>
            </div>
          </div>

          {/* Fields reference */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">4. Поля JSON</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 text-xs">Поле</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 text-xs">Тип</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 text-xs">Обов&apos;язково</th>
                    <th className="text-left py-2 font-medium text-gray-500 text-xs">Опис</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {WEBHOOK_FIELDS.map(([field, type, req, desc]) => (
                    <tr key={field} className="border-b border-gray-100 dark:border-gray-800/50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-white whitespace-nowrap">{field}</td>
                      <td className="py-2 pr-4 text-xs text-gray-500">{type}</td>
                      <td className="py-2 pr-4 text-xs">
                        {req
                          ? <span className="text-rose-500 font-medium">так</span>
                          : <span className="text-gray-400">ні</span>}
                      </td>
                      <td className="py-2 text-xs text-gray-600 dark:text-gray-400">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Response & errors */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Успіх (201)
              </h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto">{`{
  "success": true,
  "orderId": "cmoy...",
  "orderNum": 42
}`}</pre>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Помилки
              </h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <li><b className="text-gray-900 dark:text-white">401</b> — Невалідний або відсутній токен</li>
                <li><b className="text-gray-900 dark:text-white">400</b> — Не вистачає полів (customer.name / phone / items)</li>
                <li><b className="text-gray-900 dark:text-white">429</b> — Перевищено rate-limit (500 req / 15 хв)</li>
              </ul>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-4">
            <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-300 mb-2">💡 Поради</h4>
            <ul className="text-xs text-amber-800 dark:text-amber-200/80 space-y-1.5 list-disc pl-4">
              <li>Токен можна передавати як заголовок <code>X-Webhook-Token</code> або як query: <code>?token=...</code> (зручно для тестування у браузері).</li>
              <li>Якщо клієнт з таким телефоном вже існує — створиться новий заказ для нього (а не дубль).</li>
              <li>Поле <code>source</code> впливає на аналітику «Джерела продажів» — використовуйте різні значення для різних лендінгів.</li>
              <li>Заказ автоматично отримує <code>orderNum</code> (порядковий номер у вашому воркспейсі) і призначається менеджеру по round-robin.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Integrations tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          {/* TurboSMS */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">TurboSMS — SMS / Viber клієнтам</h2>
                <p className="text-xs text-gray-400">Повідомлення клієнту при відправці (ТТН створено)</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${turboConfig.active ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => setTurboConfig((p) => ({ ...p, active: !p.active }))}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${turboConfig.active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {turboConfig.active ? 'Увімкнено' : 'Вимкнено'}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">API токен TurboSMS</label>
                <input
                  className="input font-mono text-sm"
                  type="password"
                  value={turboConfig.token}
                  onChange={(e) => setTurboConfig((p) => ({ ...p, token: e.target.value }))}
                  placeholder="Ваш токен з turbosms.ua"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Особистий кабінет → API → Генерувати токен
                </p>
              </div>
              <div>
                <label className="label">Ім&apos;я відправника</label>
                <input
                  className="input"
                  value={turboConfig.senderName}
                  onChange={(e) => setTurboConfig((p) => ({ ...p, senderName: e.target.value }))}
                  placeholder="MyShop"
                  maxLength={11}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Зареєстрований альфа-ім&apos;я (до 11 символів латиниці)
                </p>
              </div>
              <div>
                <label className="label">Канал доставки</label>
                <select
                  className="input"
                  value={turboConfig.channel}
                  onChange={(e) => setTurboConfig((p) => ({ ...p, channel: e.target.value as typeof turboConfig.channel }))}
                >
                  <option value="viber_sms">Viber → SMS (рекомендовано)</option>
                  <option value="viber">Тільки Viber</option>
                  <option value="sms">Тільки SMS</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              <button onClick={handleSaveTurbo} disabled={savingTurbo} className="btn-primary">
                {savingTurbo ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Зберегти'}
              </button>
              <input
                className="input w-40 text-sm"
                value={turboTestPhone}
                onChange={(e) => setTurboTestPhone(e.target.value)}
                placeholder="+380501234567"
              />
              <button
                onClick={handleTestTurbo}
                disabled={testingTurbo || !turboConfig.token || !turboConfig.senderName}
                className="btn-secondary"
              >
                {testingTurbo ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" /> : 'Тест'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Повідомлення відправляється автоматично після створення ТТН
            </p>
          </div>

          {/* Telegram */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Telegram Bot</h2>
                <p className="text-xs text-gray-400">Уведомления о новых заказах в Telegram</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${telegramConfig.active ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => setTelegramConfig((p) => ({ ...p, active: !p.active }))}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${telegramConfig.active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {telegramConfig.active ? 'Включён' : 'Выключен'}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Bot Token</label>
                <input
                  className="input font-mono text-sm"
                  type="password"
                  value={telegramConfig.botToken}
                  onChange={(e) => setTelegramConfig((p) => ({ ...p, botToken: e.target.value }))}
                  placeholder="1234567890:AAF..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Получите токен у <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary-600 hover:underline">@BotFather</a>
                </p>
              </div>
              <div>
                <label className="label">Chat ID</label>
                <input
                  className="input font-mono text-sm"
                  value={telegramConfig.chatId}
                  onChange={(e) => setTelegramConfig((p) => ({ ...p, chatId: e.target.value }))}
                  placeholder="-100123456789"
                />
                <p className="text-xs text-gray-400 mt-1">
                  ID чата или канала для уведомлений
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveTelegram}
                disabled={savingTelegram}
                className="btn-primary"
              >
                {savingTelegram ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Сохранить'}
              </button>
              <button
                onClick={handleTestTelegram}
                disabled={testingTelegram || !telegramConfig.botToken || !telegramConfig.chatId}
                className="btn-secondary"
              >
                {testingTelegram ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" /> : 'Тест'}
              </button>
            </div>
          </div>

          {/* AdTrack — server-side ad attribution + FB/TikTok CAPI on confirmed purchase */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <svg viewBox="0 0 32 32" className="w-10 h-10 rounded-xl shrink-0" aria-label="AdTrack">
                <defs>
                  <linearGradient id="adtrack-icon-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="7" fill="url(#adtrack-icon-grad)" />
                <path
                  d="M5 22l7-10 5 6 6-11 4 8"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">AdTrack — атрибуція реклами</h2>
                <p className="text-xs text-gray-400">
                  Шле статус замовлень у AdTrack, який навчає FB/TikTok пікселі на підтверджений викуп. Опціонально.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${adtrackConfig.active ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={toggleAdtrackActive}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${adtrackConfig.active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {adtrackConfig.active ? 'Увімкнено' : 'Вимкнено'}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Tracking ID</label>
                <input
                  className="input font-mono text-sm"
                  value={adtrackConfig.trackingId}
                  onChange={(e) => setAdtrackConfig((p) => ({ ...p, trackingId: e.target.value }))}
                  placeholder="trackingId з AdTrack → Project → CRM webhook"
                />
              </div>
              <div>
                <label className="label">
                  Webhook secret
                  {adtrackSecretSaved && !adtrackConfig.webhookSecret && (
                    <span className="ml-2 text-xs text-emerald-500">
                      ✓ збережено
                    </span>
                  )}
                </label>
                <input
                  className="input font-mono text-sm"
                  type="password"
                  value={adtrackConfig.webhookSecret}
                  onChange={(e) => setAdtrackConfig((p) => ({ ...p, webhookSecret: e.target.value }))}
                  placeholder={adtrackSecretSaved
                    ? 'Введіть новий, щоб змінити (інакше залишиться поточний)'
                    : 'secret з AdTrack → Project → CRM webhook'}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Видно в AdTrack: Проект → секція «CRM webhook» → кнопка «Показати secret»
                </p>
              </div>
              <div>
                <label className="label">Backend URL <span className="text-gray-400">(опційно)</span></label>
                <input
                  className="input font-mono text-sm"
                  value={adtrackConfig.baseUrl}
                  onChange={(e) => setAdtrackConfig((p) => ({ ...p, baseUrl: e.target.value }))}
                  placeholder="https://adtrack-backend.vercel.app"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveAdtrack} disabled={savingAdtrack} className="btn-primary">
                {savingAdtrack ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Зберегти'}
              </button>
              <button
                onClick={handleTestAdtrack}
                disabled={testingAdtrack || !adtrackConfig.trackingId || !adtrackConfig.webhookSecret}
                className="btn-secondary"
              >
                {testingAdtrack ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" /> : 'Тест'}
              </button>
            </div>
          </div>

          {/* Nova Poshta Sender */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Нова Пошта — відправник</h2>
                <p className="text-xs text-gray-400">Дані відправника для авто-створення ТТН</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${npConfig.active ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    onClick={() => setNpConfig((p) => ({ ...p, active: !p.active }))}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${npConfig.active ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {npConfig.active ? 'Увімкнено' : 'Вимкнено'}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">API ключ НП</label>
                <input
                  className="input font-mono text-sm"
                  type="password"
                  value={npConfig.apiKey}
                  onChange={(e) => setNpConfig((p) => ({ ...p, apiKey: e.target.value }))}
                  placeholder="Ваш API ключ з особистого кабінету НП"
                />
              </div>
              <div>
                <label className="label">Телефон відправника</label>
                <input
                  className="input"
                  value={npConfig.senderPhone}
                  onChange={(e) => setNpConfig((p) => ({ ...p, senderPhone: e.target.value }))}
                  placeholder="+380501234567"
                />
              </div>
              <div>
                <label className="label">Місто відправки (звідки відправляєте)</label>
                <NovaPoshtaSelect
                  cityValue={npConfig.citySenderLabel}
                  addressValue={npConfig.senderAddressLabel}
                  onCityChange={(label) => setNpConfig((p) => ({ ...p, citySenderLabel: label }))}
                  onAddressChange={(label) => setNpConfig((p) => ({ ...p, senderAddressLabel: label }))}
                  onCityRefChange={(ref) => setNpConfig((p) => ({ ...p, citySenderRef: ref }))}
                  onWarehouseRefChange={(ref) => setNpConfig((p) => ({ ...p, senderAddressRef: ref }))}
                />
              </div>
              {npConfig.senderRef && (
                <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
                  Відправника знайдено ✓ (ref: {npConfig.senderRef.slice(0, 8)}...)
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleFetchNpSender}
                disabled={fetchingNp || !npConfig.citySenderRef || !npConfig.senderAddressRef}
                className="btn-secondary"
              >
                {fetchingNp ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Знайти відправника в НП
              </button>
              <button
                onClick={handleSaveNpSender}
                disabled={savingNp || !npConfig.senderRef}
                className="btn-primary"
              >
                {savingNp ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Зберегти'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Крок 1: введіть API ключ, телефон та виберіть відділення звідки відправляєте. Крок 2: натисніть «Знайти відправника» — система автоматично знайде ваш акаунт у НП. Крок 3: збережіть.
            </p>
          </div>

          {/* NP Tracker status */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Авто-трекінг ТТН</h2>
                <p className="text-xs text-gray-400">
                  Автоматично оновлює статус замовлень за даними НП
                  {trackerStatus ? ` · Розклад: ${trackerStatus.schedule}` : ''}
                </p>
              </div>
            </div>

            {trackerStatus ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Очікує трекінгу</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{trackerStatus.pendingOrders}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Остання перевірка</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {trackerStatus.lastRun
                        ? new Date(trackerStatus.lastRun).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Ще не було'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Наступна</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {trackerStatus.nextRun
                        ? new Date(trackerStatus.nextRun).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                </div>
                {trackerStatus.lastResult && (
                  <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                    Останній запуск: перевірено <b>{trackerStatus.lastResult.checked}</b> · оновлено <b className="text-green-600">{trackerStatus.lastResult.updated}</b>
                    {trackerStatus.lastResult.errors > 0 && <span className="text-red-500"> · помилок {trackerStatus.lastResult.errors}</span>}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Завантаження...</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRunTracker}
                disabled={runningTracker || trackerStatus?.isRunning}
                className="btn-primary"
              >
                {(runningTracker || trackerStatus?.isRunning)
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Виконується...</>
                  : <><Truck className="w-4 h-4" /> Запустити зараз</>
                }
              </button>
              <button onClick={fetchTrackerStatus} className="btn-secondary">
                Оновити статус
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Змінити розклад: встановіть змінну NP_TRACKER_CRON у .env (за замовчуванням: кожні 3 години)
            </p>
          </div>

          {/* Facebook placeholder */}
          <div className="card p-5 opacity-60">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Facebook Lead Ads</h2>
                <p className="text-xs text-gray-400">Скоро</p>
              </div>
              <span className="ml-auto text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      <Modal open={showUserForm} onClose={() => setShowUserForm(false)} title={editUser ? 'Редактировать пользователя' : 'Новый пользователь'} size="sm">
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div>
            <label className="label">Имя *</label>
            <input className="input" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} placeholder="Иван Петров" required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} placeholder="user@example.com" required />
          </div>
          <div>
            <label className="label">{editUser ? 'Новый пароль (оставьте пустым для сохранения)' : 'Пароль *'}</label>
            <input
              className="input"
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
              placeholder={editUser ? '••••••' : 'Минимум 6 символов'}
              minLength={editUser ? 0 : 6}
              required={!editUser}
            />
          </div>
          <div>
            <label className="label">Роль</label>
            <select className="input" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
              <option value="ADMIN">Администратор</option>
              <option value="MANAGER">Менеджер</option>
              <option value="VIEWER">Просмотр</option>
              <option value="CALL_CENTER">Колл-центр</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowUserForm(false)} className="btn-secondary flex-1 justify-center">Отмена</button>
            <button type="submit" disabled={savingUser} className="btn-primary flex-1 justify-center">
              {savingUser ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editUser ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Webhook form */}
      <Modal open={showWebhookForm} onClose={() => setShowWebhookForm(false)} title="Новый Webhook токен" size="sm">
        <form onSubmit={handleCreateWebhook} className="space-y-4">
          <div>
            <label className="label">Название</label>
            <input className="input" value={webhookName} onChange={(e) => setWebhookName(e.target.value)} placeholder="Мой лендинг" required />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowWebhookForm(false)} className="btn-secondary flex-1 justify-center">Отмена</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Создать</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={handleDeleteUser}
        message="Удалить пользователя? Его заказы останутся без менеджера."
      />
    </div>
  );
}

// ============================== GENERAL TAB (language) ==============================
function GeneralTab() {
  const t = useT();
  const { locale, setLocale } = useLocaleStore();

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('settings.language')}</h3>
            <p className="text-xs text-gray-500">{t('settings.languageHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code as Locale)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                locale === l.code
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">{l.flag}</span>
              <span className="font-medium">{l.label}</span>
              {locale === l.code && <span className="ml-auto text-primary-600">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================== TEMPLATES TAB ==============================
interface OrderTpl {
  id: string;
  name: string;
  items: Array<{ productId?: string; name: string; quantity: number; price: number }>;
  source?: string | null;
  comment?: string | null;
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<OrderTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<OrderTpl | null>(null);
  const [name, setName] = useState('');
  const [items, setItems] = useState<Array<{ name: string; quantity: number; price: number }>>([{ name: '', quantity: 1, price: 0 }]);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/order-templates');
      setTemplates(res.data);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const openNew = () => {
    setEdit(null);
    setName('');
    setItems([{ name: '', quantity: 1, price: 0 }]);
    setShowForm(true);
  };

  const openEdit = (t: OrderTpl) => {
    setEdit(t);
    setName(t.name);
    setItems(t.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })));
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Назва обов\'язкова'); return; }
    if (!items.length || items.some((i) => !i.name.trim())) { toast.error('Заповніть товари'); return; }
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/order-templates/${edit.id}`, { name, items });
      } else {
        await api.post('/order-templates', { name, items });
      }
      toast.success(edit ? 'Шаблон оновлено' : 'Шаблон створено');
      setShowForm(false);
      fetchAll();
    } catch {
      toast.error('Помилка');
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Видалити шаблон?')) return;
    try { await api.delete(`/order-templates/${id}`); toast.success('Видалено'); fetchAll(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Шаблони замовлень</h3>
            <p className="text-xs text-gray-500 mt-0.5">Готові набори товарів для швидкого створення заказу</p>
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus className="w-4 h-4" /> Новий шаблон
          </button>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {loading ? (
            <p className="p-8 text-center text-gray-400">Завантаження…</p>
          ) : templates.length === 0 ? (
            <p className="p-8 text-center text-gray-400 text-sm">Шаблонів ще немає</p>
          ) : (
            templates.map((t) => {
              const total = t.items.reduce((s, i) => s + i.quantity * i.price, 0);
              return (
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {t.items.length} товарів · {total.toLocaleString('uk-UA')} ₴
                    </p>
                  </div>
                  <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(t.id)} className="p-1.5 text-gray-400 hover:text-rose-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={edit ? 'Редагувати шаблон' : 'Новий шаблон'} size="md">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Назва *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Комплект з 3 товарів" required />
          </div>
          <div>
            <label className="label">Товари</label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    value={it.name}
                    onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                    placeholder="Назва"
                  />
                  <input
                    className="input text-sm w-20"
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))}
                  />
                  <input
                    className="input text-sm w-24"
                    type="number"
                    step="0.01"
                    value={it.price}
                    onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                  />
                  <button
                    type="button"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                    className="p-2 text-gray-400 hover:text-rose-500 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setItems((p) => [...p, { name: '', quantity: 1, price: 0 }])}
              className="text-sm text-primary-600 hover:underline mt-2 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Додати рядок
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Скасувати</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : edit ? 'Зберегти' : 'Створити'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
