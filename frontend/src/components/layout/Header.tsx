'use client';

import { Menu, Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

interface HeaderProps {
  onMenuToggle: () => void;
  title?: string;
  soundEnabled?: boolean;
  onSoundToggle?: () => void;
}

export default function Header({ onMenuToggle, title, soundEnabled = true, onSoundToggle }: HeaderProps) {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 sticky top-0 z-30">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {title && (
        <h1 className="font-semibold text-gray-900 dark:text-white hidden sm:block">{title}</h1>
      )}

      <div className="flex-1" />

      {/* Sound toggle */}
      {onSoundToggle && (
        <button
          onClick={onSoundToggle}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={soundEnabled ? 'Выключить звук уведомлений' : 'Включить звук уведомлений'}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>
    </header>
  );
}
