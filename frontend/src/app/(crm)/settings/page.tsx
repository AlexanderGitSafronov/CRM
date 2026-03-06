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
} from 'lucide-react';
import NovaPoshtaSelect from '@/components/nova-poshta/NovaPoshtaSelect';

interface WebhookToken {
  id: string;
  name: string;
  token: string;
  active: boolean;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<'users' | 'webhooks' | 'integrations'>('users');
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

  const ROLE_LABELS = { ADMIN: 'Администратор', MANAGER: 'Менеджер', VIEWER: 'Просмотр' };
  const ROLE_COLORS = {
    ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    VIEWER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const apiUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Настройки</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {([
          { key: 'users', label: 'Пользователи', icon: Users },
          { key: 'webhooks', label: 'Webhook API', icon: Webhook },
          { key: 'integrations', label: 'Интеграции', icon: Bot },
        ] as const).map(({ key, label, icon: Icon }) => (
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
            {label}
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

      {/* Webhooks tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Webhook для форм</h2>
            <p className="text-sm text-gray-500 mb-4">
              Используйте этот endpoint и токен для приёма заказов с ваших лендингов.
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono text-sm text-gray-700 dark:text-gray-300">
              POST {apiUrl}/api/webhook/order
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Добавьте заголовок: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">X-Webhook-Token: {'<your-token>'}</code>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Токены</h2>
              </div>
              <button onClick={() => setShowWebhookForm(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Создать токен
              </button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{wh.name}</p>
                    <p className="font-mono text-xs text-gray-400 truncate">{wh.token}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(wh.token)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
                    title="Скопировать"
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
                <p className="p-6 text-center text-gray-400 text-sm">Токены не созданы</p>
              )}
            </div>
          </div>

          {/* Webhook payload example */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Пример запроса</h3>
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">{`curl -X POST ${apiUrl}/api/webhook/order \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: demo-webhook-token-change-in-production" \\
  -d '{
    "customer": {
      "name": "Иван Петров",
      "phone": "+380501234567",
      "email": "ivan@example.com",
      "city": "Киев"
    },
    "items": [
      { "name": "Товар 1", "quantity": 2, "price": 999 }
    ],
    "source": "LANDING",
    "comment": "Комментарий"
  }'`}</pre>
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
