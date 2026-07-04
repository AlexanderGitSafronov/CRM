'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  endpoint: '/import/customers' | '/import/products';
  onSuccess?: () => void;
}

const CUSTOMER_TEMPLATE = `name;phone;email;city;address;notes
Іван Петров;+380501234567;ivan@example.com;Київ;вул. Хрещатик 1;VIP
Марія Коваленко;+380671112233;;Львів;;
`;

const PRODUCT_TEMPLATE = `name;sku;description;purchasePrice;salePrice;stock
Куртка зимова;JKT-001;Тепла куртка;500;1200;10
Шапка вʼязана;HAT-002;;100;299;25
`;

export default function CsvImport({ open, onClose, endpoint, onSuccess }: Props) {
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCustomers = endpoint === '/import/customers';
  const sample = isCustomers ? CUSTOMER_TEMPLATE : PRODUCT_TEMPLATE;
  const title = isCustomers ? 'Імпорт клієнтів' : 'Імпорт товарів';

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.csv$/i)) {
      toast.error('Тільки CSV файли');
      return;
    }
    setFilename(file.name);
    const text = await file.text();
    setCsv(text);
    setResult(null);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const downloadSample = () => {
    const blob = new Blob(['﻿' + sample], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${isCustomers ? 'customers' : 'products'}-template.csv`;
    a.click();
  };

  const submit = async () => {
    if (!csv.trim()) { toast.error('Виберіть файл'); return; }
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post(endpoint, { csv });
      setResult(res.data);
      toast.success(`Імпортовано: ${res.data.imported}`);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Помилка';
      toast.error(msg);
    }
    setBusy(false);
  };

  const reset = () => {
    setCsv('');
    setFilename('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm">
          <p className="text-blue-900 dark:text-blue-300 mb-1">
            <b>Формат CSV.</b> Перший рядок — заголовки. Розділювач: <code>;</code> або <code>,</code>
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Очікувані колонки: {isCustomers ? 'name, phone (обов\'язкові), email, city, address, notes' : 'name (обов\'язкове), sku, description, purchasePrice, salePrice, stock'}.
            Підтримуються українські назви: {isCustomers ? '«Імʼя», «Телефон», «Місто»' : '«Назва», «Артикул», «Ціна», «Залишок»'}.
          </p>
          <button onClick={downloadSample} className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:underline">
            <Download className="w-3 h-3" /> Завантажити шаблон-приклад
          </button>
        </div>

        {!filename ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => {
              // Без preventDefault браузер открыл бы файл вместо импорта.
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={`w-full border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-2 transition-colors ${
              dragActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'
            }`}
          >
            <Upload className="w-8 h-8 text-gray-400" />
            <p className="font-medium text-gray-700 dark:text-gray-300">Виберіть CSV файл</p>
            <p className="text-xs text-gray-400">або перетягніть сюди</p>
          </button>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
            <FileText className="w-5 h-5 text-primary-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{filename}</p>
              <p className="text-xs text-gray-400">{(csv.length / 1024).toFixed(1)} KB · {csv.split('\n').length - 1} рядків</p>
            </div>
            <button onClick={reset} className="p-1 text-gray-400 hover:text-rose-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />

        {result && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{result.imported}</p>
                <p className="text-[11px] text-emerald-600">Імпортовано</p>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.skipped}</p>
                <p className="text-[11px] text-amber-600">Пропущено (дублі)</p>
              </div>
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-3">
                <X className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{result.errors.length}</p>
                <p className="text-[11px] text-rose-600">Помилок</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <details className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <summary className="text-sm cursor-pointer text-gray-600 dark:text-gray-400">Перегляд помилок ({result.errors.length})</summary>
                <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i} className="text-rose-600 dark:text-rose-400">Рядок {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            {result ? 'Закрити' : 'Скасувати'}
          </button>
          {!result && (
            <button onClick={submit} disabled={busy || !csv} className="btn-primary flex-1 justify-center">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Імпортувати'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
