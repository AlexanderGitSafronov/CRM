'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import type { Product, Pagination as PaginationType } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  TrendingUp,
  X,
  Upload,
} from 'lucide-react';
import CsvImport from '@/components/CsvImport';
import ImageUploader from '@/components/ImageUploader';
import { useT } from '@/stores/localeStore';

interface ProductForm {
  name: string;
  sku: string;
  description: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  lowStockThreshold: string;
  image: string;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  sku: '',
  description: '',
  purchasePrice: '',
  salePrice: '',
  stock: '0',
  lowStockThreshold: '5',
  image: '',
};

export default function ProductsPage() {
  const { user } = useAuthStore();
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ total: 0, page: 1, limit: 50, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [importOpen, setImportOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: { page, limit: 50, ...(search && { search }) },
      });
      setProducts(res.data.products);
      setPagination(res.data.pagination);
    } catch {}
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreate = () => {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      sku: product.sku || '',
      description: product.description || '',
      purchasePrice: product.purchasePrice.toString(),
      salePrice: product.salePrice.toString(),
      stock: product.stock.toString(),
      lowStockThreshold: ((product as Product & { lowStockThreshold?: number }).lowStockThreshold ?? 5).toString(),
      image: product.image || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Введите название товара');
      return;
    }
    setSaving(true);
    try {
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, form);
        toast.success('Товар обновлён');
      } else {
        await api.post('/products', form);
        toast.success('Товар добавлен');
      }
      setShowForm(false);
      fetchProducts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка';
      toast.error(msg);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/products/${deleteId}`);
      toast.success('Товар удалён');
      setDeleteId(null);
      fetchProducts();
    } catch {
      toast.error('Ошибка');
    }
    setDeleteLoading(false);
  };

  const canEdit = user?.role !== 'VIEWER';
  const totalValue = products.reduce((s, p) => s + p.salePrice * p.stock, 0);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('products.title')}</h1>
          <p className="text-sm text-gray-400">{pagination.total} {t('products.count')} · {t('products.warehouse')}: {formatCurrency(totalValue)}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setImportOpen(true)} className="btn-secondary">
              <Upload className="w-4 h-4" /> {t('customers.csvImport')}
            </button>
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" />
              {t('products.add')}
            </button>
          </div>
        )}
      </div>
      <CsvImport open={importOpen} onClose={() => setImportOpen(false)} endpoint="/import/products" onSuccess={fetchProducts} />

      <div className="card p-3 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder={t('products.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="btn-secondary px-2">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <th className="text-left table-header p-4">Товар</th>
                <th className="text-left table-header p-4 hidden sm:table-cell">Артикул</th>
                <th className="text-right table-header p-4">Себест.</th>
                <th className="text-right table-header p-4">Цена</th>
                <th className="text-right table-header p-4 hidden md:table-cell">Маржа</th>
                <th className="text-center table-header p-4">Остаток</th>
                <th className="text-right table-header p-4 hidden lg:table-cell">Стоимость</th>
                {canEdit && <th className="p-4 w-20" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>Товаров не найдено</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {product.sku || '—'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(product.purchasePrice)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(product.salePrice)}
                      </span>
                    </td>
                    <td className="p-4 text-right hidden md:table-cell">
                      <div>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(product.margin ?? 0)}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          ({(product.marginPercent ?? 0).toFixed(0)}%)
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {product.stock < 5 && (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            product.stock === 0
                              ? 'text-red-500'
                              : product.stock < 5
                              ? 'text-yellow-500'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right hidden lg:table-cell">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(product.salePrice * product.stock)}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(product)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => setDeleteId(product.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
          onChange={setPage}
        />
      </div>

      {/* Product Form Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editProduct ? `Редактировать: ${editProduct.name}` : 'Новый товар'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Название *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Название товара"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Артикул (SKU)</label>
              <input
                className="input font-mono"
                value={form.sku}
                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                placeholder="PROD-001"
              />
            </div>
            <div>
              <label className="label">Остаток на складе</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Закупочная цена</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Цена продажи</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm((p) => ({ ...p, salePrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          {form.purchasePrice && form.salePrice && (
            <div className="flex items-center gap-2 text-sm p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
              <TrendingUp className="w-4 h-4" />
              Маржа: {formatCurrency(parseFloat(form.salePrice || '0') - parseFloat(form.purchasePrice || '0'))}
              {parseFloat(form.purchasePrice) > 0 && (
                <span className="ml-1">
                  ({(((parseFloat(form.salePrice || '0') - parseFloat(form.purchasePrice || '0')) / parseFloat(form.purchasePrice)) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          )}
          <div>
            <label className="label">Поріг закінчення (для алертів)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.lowStockThreshold}
              onChange={(e) => setForm((p) => ({ ...p, lowStockThreshold: e.target.value }))}
              placeholder="5"
            />
            <p className="text-xs text-gray-400 mt-1">Якщо залишок ≤ цього значення — щоденний алерт у Telegram</p>
          </div>
          <ImageUploader
            label="Фото товару"
            value={form.image || null}
            onChange={(url) => setForm((p) => ({ ...p, image: url || '' }))}
            maxDim={600}
            maxBytes={300_000}
            shape="rounded"
            hint="JPG/PNG, ≤600px, ~300KB"
          />
          <div>
            <label className="label">Описание</label>
            <textarea
              className="input min-h-[72px] resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Краткое описание товара..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">
              Отмена
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editProduct ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Удалить товар? Если у товара есть заказы, он будет деактивирован."
        loading={deleteLoading}
      />
    </div>
  );
}
