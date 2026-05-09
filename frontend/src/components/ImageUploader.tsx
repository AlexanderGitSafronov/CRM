'use client';

import { useState, useRef } from 'react';
import { Image as ImageIcon, X, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fileToResizedDataUrl } from '@/lib/imageUtils';

interface Props {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  maxDim?: number;
  maxBytes?: number;
  shape?: 'square' | 'rounded';
  hint?: string;
  label?: string;
}

export default function ImageUploader({
  value, onChange,
  maxDim = 800, maxBytes = 400_000,
  shape = 'rounded', hint, label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const url = await fileToResizedDataUrl(file, { maxDim, maxBytes });
      if (!url) {
        toast.error('Файл занадто великий або не зображення');
        return;
      }
      onChange(url);
    } catch (e) {
      toast.error('Помилка обробки зображення');
    } finally {
      setBusy(false);
    }
  };

  const onPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const radius = shape === 'square' ? 'rounded-md' : 'rounded-xl';

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-3">
        <div
          className={`relative w-20 h-20 ${radius} bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shrink-0`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-300" />
          )}
          {busy && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary text-sm"
              disabled={busy}
            >
              <Upload className="w-3.5 h-3.5" />
              {value ? 'Замінити' : 'Завантажити'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="btn-secondary text-sm text-rose-600 dark:text-rose-400"
              >
                <X className="w-3.5 h-3.5" />
                Видалити
              </button>
            )}
          </div>
          {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPicked}
        />
      </div>
    </div>
  );
}
