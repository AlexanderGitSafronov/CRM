'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Bookmark, Plus, X, Save, Globe, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';

export interface OrderFilters {
  search?: string;
  status?: string;
  managerId?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: OrderFilters;
  icon?: string | null;
  userId: string | null;
  sortOrder: number;
}

interface Props {
  currentFilters: OrderFilters;
  onApply: (f: OrderFilters) => void;
  activeViewId: string | null;
  onActiveViewChange: (id: string | null) => void;
}

export default function SavedOrderViews({ currentFilters, onApply, activeViewId, onActiveViewChange }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIcon, setSaveIcon] = useState('');
  const [saveShared, setSaveShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchViews = async () => {
    try {
      const r = await api.get('/order-views');
      setViews(r.data);
    } catch {}
  };

  useEffect(() => { fetchViews(); }, []);

  const isFiltersEmpty = !currentFilters.search && !currentFilters.status && !currentFilters.managerId && !currentFilters.source && !currentFilters.dateFrom && !currentFilters.dateTo;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await api.post('/order-views', {
        name: saveName,
        filters: currentFilters,
        icon: saveIcon || undefined,
        shared: saveShared,
      });
      toast.success('Вид збережено');
      setShowSave(false);
      setSaveName('');
      setSaveIcon('');
      setSaveShared(false);
      fetchViews();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setSaving(false);
  };

  const remove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Видалити цей вид?')) return;
    try {
      await api.delete(`/order-views/${id}`);
      toast.success('Видалено');
      if (activeViewId === id) onActiveViewChange(null);
      fetchViews();
    } catch { toast.error('Помилка'); }
  };

  const apply = (v: SavedView) => {
    onActiveViewChange(v.id);
    onApply(v.filters);
  };

  const clear = () => {
    onActiveViewChange(null);
    onApply({});
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={clear}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            !activeViewId
              ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
          }`}
        >
          Усі
        </button>
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => apply(v)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              activeViewId === v.id
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
            }`}
          >
            {v.icon && <span className="text-base leading-none">{v.icon}</span>}
            <span>{v.name}</span>
            {v.userId === null
              ? <Globe className="w-3 h-3 opacity-50" />
              : <UserIcon className="w-3 h-3 opacity-40" />}
            <X
              className="w-3 h-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-rose-500 transition-opacity"
              onClick={(e) => remove(e, v.id)}
            />
          </button>
        ))}
        {!isFiltersEmpty && !activeViewId && (
          <button
            onClick={() => setShowSave(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Зберегти вид
          </button>
        )}
        {views.length === 0 && isFiltersEmpty && (
          <span className="text-xs text-gray-400 inline-flex items-center gap-1.5">
            <Bookmark className="w-3 h-3" />
            Поставте фільтри і збережіть як швидкий вид
          </span>
        )}
      </div>

      <Modal open={showSave} onClose={() => setShowSave(false)} title="Зберегти вид" size="sm">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Назва</label>
            <input
              className="input"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Мої сьогодні в обробці"
              required
              autoFocus
              maxLength={60}
            />
          </div>
          <div>
            <label className="label">Іконка (емодзі, опціонально)</label>
            <input
              className="input"
              value={saveIcon}
              onChange={(e) => setSaveIcon(e.target.value.slice(0, 4))}
              placeholder="🔥"
              maxLength={4}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={saveShared}
              onChange={(e) => setSaveShared(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Спільний для всієї команди</span>
            <Globe className="w-3.5 h-3.5 text-gray-400" />
          </label>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-xs text-gray-500">
            <b>Збережені фільтри:</b>
            <pre className="mt-1 text-[11px]">{JSON.stringify(currentFilters, null, 2)}</pre>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowSave(false)} className="btn-secondary flex-1 justify-center">Скасувати</button>
            <button type="submit" disabled={saving || !saveName.trim()} className="btn-primary flex-1 justify-center">
              <Plus className="w-4 h-4" />
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
