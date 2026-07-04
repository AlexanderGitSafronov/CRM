'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // Когда true — закрытие по клику вне модалки/Escape/крестику спрашивает подтверждение
  // (используется для длинных форм, чтобы случайный клик не терял введённые данные).
  confirmClose?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, size = 'md', confirmClose = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Единая точка выхода: при confirmClose спрашиваем подтверждение перед закрытием.
  const requestClose = () => {
    if (confirmClose && !window.confirm('Закрити без збереження? Введені дані буде втрачено.')) return;
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    // Запоминаем фокус, чтобы вернуть его после закрытия (доступность).
    const prevActive = document.activeElement as HTMLElement | null;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      // Focus-trap: Tab не должен уходить за пределы модалки.
      if (e.key === 'Tab' && contentRef.current) {
        const nodes = Array.from(
          contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    // Фокус внутрь модалки при открытии.
    const focusTimer = setTimeout(() => {
      const firstFocusable = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (firstFocusable ?? contentRef.current)?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      clearTimeout(focusTimer);
      prevActive?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => e.target === overlayRef.current && requestClose()}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Діалог'}
        tabIndex={-1}
        className={cn('modal-content w-full outline-none', sizeClasses[size])}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Закрити"
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
