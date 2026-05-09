'use client';

import { Menu, Sun, Moon, Volume2, VolumeX, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useT } from '@/stores/localeStore';

interface HeaderProps {
  onMenuToggle: () => void;
  title?: string;
  soundEnabled?: boolean;
  onSoundToggle?: () => void;
}

export default function Header({ onMenuToggle, title, soundEnabled = true, onSoundToggle }: HeaderProps) {
  const { theme, toggleTheme } = useThemeStore();
  const t = useT();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac/i.test(navigator.platform || ''));
  }, []);

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }));
  };

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

      {/* Global search button */}
      <button
        onClick={openSearch}
        data-tour="search"
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-sm"
      >
        <Search className="w-4 h-4" />
        <span>{t('header.search')}</span>
        <kbd className="ml-3 inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-[10px] font-mono text-gray-500">
          {isMac ? '⌘' : 'Ctrl'}K
        </kbd>
      </button>
      <button
        onClick={openSearch}
        className="sm:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={t('header.search')}
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Sound toggle */}
      {onSoundToggle && (
        <button
          onClick={onSoundToggle}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={soundEnabled ? t('header.soundOn') : t('header.soundOff')}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={theme === 'light' ? t('header.themeDark') : t('header.themeLight')}
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>
    </header>
  );
}
