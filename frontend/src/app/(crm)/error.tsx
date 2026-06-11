'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging in dev / logs.
    console.error(error);
  }, [error]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          Щось пішло не так
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Сталася помилка під час завантаження сторінки.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-mono">
            {error.digest}
          </p>
        )}
        <button onClick={() => reset()} className="btn-primary mt-6 mx-auto">
          <RefreshCw className="w-4 h-4" />
          Спробувати ще раз
        </button>
      </div>
    </div>
  );
}
