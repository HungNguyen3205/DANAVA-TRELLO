import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { RobotAvatar } from './RobotAvatar';
import type { AvatarMood } from './AssistantAvatar';
import { DEFAULT_PREFS, EYE_PRESETS, RING_PRESETS, savePrefs, useAssistantPrefs } from './assistantPrefs';

const EXPRESSIONS: { mood: AvatarMood; label: string; emoji: string }[] = [
  { mood: 'waving', label: 'Vui', emoji: '😊' },
  { mood: 'wink', label: 'Nháy mắt', emoji: '😉' },
  { mood: 'surprised', label: 'Ngạc nhiên', emoji: '😮' },
  { mood: 'thinking', label: 'Suy nghĩ', emoji: '🤔' },
  { mood: 'talking', label: 'Đang nói', emoji: '💬' },
];

/** Colour and expression playground for the robot assistant (saved per browser). */
export function RobotCustomizer({ onClose }: { onClose: () => void }) {
  const prefs = useAssistantPrefs();
  const [mood, setMood] = useState<AvatarMood>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = (m: AvatarMood) => {
    window.clearTimeout(timer.current);
    setMood(m);
    timer.current = window.setTimeout(() => setMood('idle'), 2500);
  };

  const set = (patch: Partial<typeof prefs>) => savePrefs({ ...prefs, ...patch });

  return (
    <div className="border-b border-border bg-card px-3.5 py-3 space-y-3 max-h-[55%] overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-foreground">Tùy chỉnh trợ lý</div>
        <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted" aria-label="Đóng tùy chỉnh">
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-2xl bg-muted/40 p-1">
          <RobotAvatar mood={mood} size={76} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXPRESSIONS.map((e) => (
            <button
              key={e.mood}
              type="button"
              onClick={() => play(e.mood)}
              className={`inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${
                mood === e.mood ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-foreground'
              }`}
            >
              <span aria-hidden="true">{e.emoji}</span> {e.label}
            </button>
          ))}
        </div>
      </div>

      <ColorRow label="Màu mắt LED" value={prefs.eyeColor} presets={EYE_PRESETS} onChange={(v) => set({ eyeColor: v })} />
      <ColorRow label="Màu nền tròn" value={prefs.ringColor} presets={RING_PRESETS} onChange={(v) => set({ ringColor: v })} />

      <label className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground cursor-pointer">
        <span>
          Giới thiệu khi mở trang mới
          <span className="block font-normal text-muted-foreground">Em nói ngắn gọn trang đó dùng để làm gì.</span>
        </span>
        <input type="checkbox" checked={prefs.pageIntros} onChange={(e) => set({ pageIntros: e.target.checked })} className="w-4 h-4 accent-primary shrink-0" />
      </label>

      <button
        type="button"
        onClick={() => savePrefs({ ...DEFAULT_PREFS, pageIntros: prefs.pageIntros })}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <RotateCcw size={13} /> Khôi phục mặc định
      </button>
    </div>
  );
}

function ColorRow({ label, value, presets, onChange }: { label: string; value: string; presets: { name: string; value: string }[]; onChange: (v: string) => void }) {
  const isCustom = !presets.some((p) => p.value.toLowerCase() === value.toLowerCase());
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const active = p.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={p.value}
              type="button"
              title={p.name}
              aria-label={p.name}
              aria-pressed={active}
              onClick={() => onChange(p.value)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 ${active ? 'border-foreground' : 'border-white shadow'}`}
              style={{ background: p.value }}
            >
              {active && <Check size={13} className="text-white drop-shadow" />}
            </button>
          );
        })}
        <label
          title="Chọn màu khác"
          className={`relative w-7 h-7 rounded-full border-2 cursor-pointer overflow-hidden ${isCustom ? 'border-foreground' : 'border-dashed border-muted-foreground/50'}`}
          style={{ background: isCustom ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
        >
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={`${label}: chọn màu khác`} />
        </label>
      </div>
    </div>
  );
}
