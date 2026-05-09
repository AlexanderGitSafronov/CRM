'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Target, Calendar, TrendingUp, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface Goal {
  id: string;
  period: 'MONTH' | 'QUARTER' | 'YEAR';
  startDate: string;
  endDate: string;
  targetRevenue: number;
  targetOrders: number;
  active: boolean;
  progress: {
    revenue: number; orders: number;
    revenuePct: number; ordersPct: number;
    elapsedPct: number; daysLeft: number;
  };
}

const PERIOD_LABEL: Record<Goal['period'], string> = { MONTH: 'Місяць', QUARTER: 'Квартал', YEAR: 'Рік' };

function startOfPeriod(period: Goal['period'], now = new Date()): Date {
  const d = new Date(now);
  if (period === 'MONTH') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (period === 'QUARTER') {
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q, 1);
  }
  return new Date(d.getFullYear(), 0, 1);
}

function endOfPeriod(period: Goal['period'], now = new Date()): Date {
  const d = new Date(now);
  if (period === 'MONTH') return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  if (period === 'QUARTER') {
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q + 3, 0, 23, 59, 59);
  }
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59);
}

const toDateInput = (d: Date) => d.toISOString().split('T')[0];

export default function GoalsPage() {
  const { user } = useAuthStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    period: 'MONTH' as Goal['period'],
    startDate: toDateInput(startOfPeriod('MONTH')),
    endDate: toDateInput(endOfPeriod('MONTH')),
    targetRevenue: '',
    targetOrders: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const r = await api.get('/goals');
      setGoals(r.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchGoals(); }, []);

  const openNew = (period: Goal['period'] = 'MONTH') => {
    setEditGoal(null);
    setForm({
      period,
      startDate: toDateInput(startOfPeriod(period)),
      endDate: toDateInput(endOfPeriod(period)),
      targetRevenue: '',
      targetOrders: '',
      active: true,
    });
    setShowForm(true);
  };

  const openEdit = (g: Goal) => {
    setEditGoal(g);
    setForm({
      period: g.period,
      startDate: g.startDate.slice(0, 10),
      endDate: g.endDate.slice(0, 10),
      targetRevenue: g.targetRevenue.toString(),
      targetOrders: g.targetOrders.toString(),
      active: g.active,
    });
    setShowForm(true);
  };

  // Auto-update dates when period changes
  const setPeriod = (period: Goal['period']) => {
    setForm((p) => ({
      ...p,
      period,
      startDate: toDateInput(startOfPeriod(period)),
      endDate: toDateInput(endOfPeriod(period)),
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRevenue = parseFloat(form.targetRevenue) || 0;
    const targetOrders = parseInt(form.targetOrders) || 0;
    if (!targetRevenue && !targetOrders) {
      toast.error('Задайте хоча б одну ціль (виручка або кількість)');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        period: form.period,
        startDate: form.startDate,
        endDate: form.endDate,
        targetRevenue,
        targetOrders,
        active: form.active,
      };
      if (editGoal) {
        await api.put(`/goals/${editGoal.id}`, payload);
      } else {
        await api.post('/goals', payload);
      }
      toast.success(editGoal ? 'Ціль оновлено' : 'Ціль створено');
      setShowForm(false);
      fetchGoals();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/goals/${deleteId}`);
      toast.success('Видалено');
      setDeleteId(null);
      fetchGoals();
    } catch { toast.error('Помилка'); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Цілі продажів</h1>
          <p className="text-sm text-gray-400">Плани на місяць, квартал, рік</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => openNew('MONTH')} className="btn-secondary text-sm">
              <Plus className="w-3.5 h-3.5" /> На місяць
            </button>
            <button onClick={() => openNew('QUARTER')} className="btn-secondary text-sm">
              <Plus className="w-3.5 h-3.5" /> На квартал
            </button>
            <button onClick={() => openNew('YEAR')} className="btn-primary text-sm">
              <Plus className="w-3.5 h-3.5" /> На рік
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : goals.length === 0 ? (
        <div className="card p-12 text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Цілей ще немає</h3>
          <p className="text-sm text-gray-500 mb-5">
            Поставте план продажів — і відстежуйте прогрес у реальному часі
          </p>
          {canEdit && (
            <button onClick={() => openNew('MONTH')} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Створити першу ціль
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => (
            <div key={g.id} className="card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {PERIOD_LABEL[g.period]}
                      {!g.active && <span className="ml-2 text-xs text-gray-400">(неактивна)</span>}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(g.startDate).toLocaleDateString('uk-UA')} — {new Date(g.endDate).toLocaleDateString('uk-UA')}
                      <span className={`ml-2 ${g.progress.daysLeft <= 3 ? 'text-rose-500' : ''}`}>
                        {g.progress.daysLeft > 0 ? `${g.progress.daysLeft} дн залишилось` : 'завершено'}
                      </span>
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(g)} className="p-2 text-gray-400 hover:text-primary-600 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(g.id)} className="p-2 text-gray-400 hover:text-rose-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {g.targetRevenue > 0 && (
                  <BigProgress
                    icon={TrendingUp}
                    label="Виручка"
                    current={g.progress.revenue}
                    target={g.targetRevenue}
                    pct={g.progress.revenuePct}
                    elapsedPct={g.progress.elapsedPct}
                    format={formatCurrency}
                  />
                )}
                {g.targetOrders > 0 && (
                  <BigProgress
                    icon={ShoppingCart}
                    label="Кількість замовлень"
                    current={g.progress.orders}
                    target={g.targetOrders}
                    pct={g.progress.ordersPct}
                    elapsedPct={g.progress.elapsedPct}
                    format={(n) => n.toLocaleString('uk-UA')}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editGoal ? 'Редагувати ціль' : 'Нова ціль'} size="md">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Період</label>
            <div className="grid grid-cols-3 gap-2">
              {(['MONTH', 'QUARTER', 'YEAR'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.period === p
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Початок</label>
              <input className="input" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Кінець</label>
              <input className="input" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Цільова виручка (₴)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="100"
              value={form.targetRevenue}
              onChange={(e) => setForm((p) => ({ ...p, targetRevenue: e.target.value }))}
              placeholder="50000"
            />
          </div>
          <div>
            <label className="label">Цільова кількість замовлень</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.targetOrders}
              onChange={(e) => setForm((p) => ({ ...p, targetOrders: e.target.value }))}
              placeholder="100"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Активна (показувати на дашборді)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Скасувати</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editGoal ? 'Зберегти' : 'Створити'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={remove}
        message="Видалити цю ціль?"
      />
    </div>
  );
}

function BigProgress({
  icon: Icon, label, current, target, pct, elapsedPct, format,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: number; target: number;
  pct: number; elapsedPct: number;
  format: (n: number) => string;
}) {
  const ahead = pct >= elapsedPct;
  const completed = pct >= 100;
  const barClass = completed
    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
    : ahead
      ? 'bg-gradient-to-r from-blue-400 via-violet-500 to-fuchsia-500'
      : 'bg-gradient-to-r from-amber-400 to-rose-500';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">{label}</span>
        </div>
        <span className={`text-sm font-bold ${completed ? 'text-emerald-600' : ahead ? 'text-violet-600' : 'text-amber-600'}`}>
          {pct}%
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {format(current)}
        <span className="text-sm font-normal text-gray-400 ml-2">/ {format(target)}</span>
      </div>
      <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        {elapsedPct > 0 && elapsedPct < 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-700 dark:bg-gray-300 opacity-60"
            style={{ left: `${elapsedPct}%` }}
            title={`Темп: ${elapsedPct}%`}
          />
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {completed ? '🎉 ціль досягнуто' : ahead ? '✓ випереджаєте темп' : `відставання ${elapsedPct - pct}% від темпу`}
      </p>
    </div>
  );
}
