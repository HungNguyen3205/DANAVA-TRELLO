import { useEffect, useState } from 'react';

/** Per-browser look of the robot assistant. */
export interface AssistantPrefs {
  eyeColor: string;
  ringColor: string;
}

export const EYE_PRESETS = [
  { name: 'Cyan', value: '#00f5ff' },
  { name: 'Tím', value: '#a855f7' },
  { name: 'Xanh lá', value: '#22e58b' },
  { name: 'Vàng', value: '#fbbf24' },
  { name: 'Hồng', value: '#f472b6' },
  { name: 'Cam', value: '#fb923c' },
];

export const RING_PRESETS = [
  { name: 'Xanh dương', value: '#0070f3' },
  { name: 'Tím', value: '#6d28d9' },
  { name: 'Xanh lá', value: '#059669' },
  { name: 'Cam DANAVA', value: '#f47624' },
  { name: 'Đen', value: '#1e293b' },
];

export const DEFAULT_PREFS: AssistantPrefs = { eyeColor: '#00f5ff', ringColor: '#0070f3' };

const KEY = 'assistant-robot-prefs';
const EVENT = 'assistant-prefs-changed';
const HEX = /^#[0-9a-f]{6}$/i;

export function loadPrefs(): AssistantPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      eyeColor: HEX.test(raw.eyeColor) ? raw.eyeColor : DEFAULT_PREFS.eyeColor,
      ringColor: HEX.test(raw.ringColor) ? raw.ringColor : DEFAULT_PREFS.ringColor,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AssistantPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: change still applies for this page view */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: prefs }));
}

/** Current prefs, updated live in every robot on the page. */
export function useAssistantPrefs(): AssistantPrefs {
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => {
    const on = (e: Event) => setPrefs((e as CustomEvent<AssistantPrefs>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return prefs;
}

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
