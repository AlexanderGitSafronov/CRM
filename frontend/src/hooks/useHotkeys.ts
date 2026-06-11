'use client';

import { useEffect } from 'react';

type HotkeyHandler = (e: KeyboardEvent) => void;
type Bindings = Record<string, HotkeyHandler>;

interface HotkeyOptions {
  enabled?: boolean;
}

/**
 * Normalize a KeyboardEvent into a binding key like 'j', 'mod+enter', '1'.
 * `mod` = Cmd on macOS, Ctrl elsewhere.
 */
function eventToCombo(e: KeyboardEvent): string {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? e.metaKey : e.ctrlKey;

  const parts: string[] = [];
  if (mod) parts.push('mod');

  let key = e.key.toLowerCase();
  if (key === ' ') key = 'space';
  parts.push(key);

  return parts.join('+');
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Register window keydown hotkeys.
 *
 * @param bindings  map of combo -> handler, e.g. { 'j': fn, 'mod+enter': fn, '1': fn }
 * @param opts      { enabled?: boolean } — default enabled true
 *
 * Events are ignored when the target is an input/textarea/select or contentEditable,
 * except for 'mod+enter' which is allowed to fire inside those (e.g. submit-from-textarea).
 */
export default function useHotkeys(bindings: Bindings, opts: HotkeyOptions = {}) {
  const { enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const combo = eventToCombo(e);
      const fn = bindings[combo];
      if (!fn) return;

      const isModEnter = combo === 'mod+enter';
      if (isEditableTarget(e.target) && !isModEnter) return;

      fn(e);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // bindings/enabled captured fresh each render via the effect deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, bindings]);
}
