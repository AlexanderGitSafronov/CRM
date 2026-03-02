'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pages, total, limit, onChange }: PaginationProps) {
  if (pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const getPages = () => {
    const result: (number | '...')[] = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) result.push(i);
    } else {
      result.push(1);
      if (page > 3) result.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
        result.push(i);
      }
      if (page < pages - 2) result.push('...');
      result.push(pages);
    }
    return result;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {from}–{to} из {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPages().map((p, i) => (
          <button
            key={i}
            onClick={() => typeof p === 'number' && onChange(p)}
            disabled={p === '...'}
            className={cn(
              'w-8 h-8 rounded-md text-sm transition-colors',
              p === page
                ? 'bg-primary-600 text-white font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              p === '...' && 'cursor-default'
            )}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
