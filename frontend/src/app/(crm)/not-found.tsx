import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
          <Compass className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white">404</p>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
          Сторінку не знайдено
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Можливо, її було переміщено або видалено.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 mx-auto">
          <ArrowLeft className="w-4 h-4" />
          На головну
        </Link>
      </div>
    </div>
  );
}
