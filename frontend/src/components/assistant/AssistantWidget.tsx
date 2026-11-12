import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { projectsApi } from '../../lib/api/projects';
import { introFor, type PageIntro } from './pageIntros';
import { savePrefs, useAssistantPrefs } from './assistantPrefs';
import { Trash2, X, EyeOff, Loader2, Palette, Upload, MessageCircleQuestion } from 'lucide-react';
import { CopyMessageButton } from './CopyMessageButton';
import { FitText } from './FitText';
import { toast } from 'sonner';
import { type AvatarMood } from './AssistantAvatar';
import { RobotAvatar } from './RobotAvatar';
import { RobotCustomizer } from './RobotCustomizer';
import { TaskPreviewCard } from './TaskPreviewCard';
import { GeminiKeyForm } from './GeminiKeyForm';
import { MarkdownLite } from './MarkdownLite';
import { ChatComposer } from './ChatComposer';
import { MessageAttachments } from './MessageAttachments';
import { prepareFiles, releaseFiles, type PendingFile } from './chatFiles';
import { useAuthStore } from '../../store/authStore';
import { assistantApi, assistantSettingsApi, type AssistantMessage, type ChatAttachment, type AssistantSettingsStatus, type AssistantState } from '../../lib/api/assistant';
import './assistant.css';

const MINIMIZED_KEY = 'assistant-minimized';
const REMINDER_KEY = 'assistant-key-reminder-dismissed';

function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function reminderDismissedToday(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === todayVN();
  } catch {
    return false;
  }
}

function dismissReminderToday() {
  try {
    localStorage.setItem(REMINDER_KEY, todayVN());
  } catch {
    /* ignore */
  }
}
const SUGGESTIONS = ['Hôm nay tôi có việc gì?', 'Tôi có việc nào quá hạn không?', 'Chấm công hôm nay của tôi', 'Cách giao việc bằng tin nhắn?'];

function readMinimized(): boolean {
  try {
    return localStorage.getItem(MINIMIZED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMinimized(v: boolean) {
  try {
    localStorage.setItem(MINIMIZED_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Pointer direction relative to an element's eyes, normalised to -1..1. */
function useLookAt(ref: React.RefObject<HTMLElement | null>) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  useEffect(() => {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.37; // eye line
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const strength = Math.min(1, dist / 260);
        setLook({ x: (dx / dist) * strength, y: (dy / dist) * strength });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return look;
}

function useCompact(): boolean {
  const query = '(max-width: 640px)';
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

export function AssistantWidget() {
  const compact = useCompact();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.system_role === 'system_admin' || user?.system_role === 'admin';
  const [settings, setSettings] = useState<AssistantSettingsStatus | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderMood, setReminderMood] = useState<AvatarMood>('waving');
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(readMinimized);
  const [entering, setEntering] = useState(true);
  const [dockMood, setDockMood] = useState<AvatarMood>('idle');
  const [panelMood, setPanelMood] = useState<AvatarMood>('waving');
  const [state, setState] = useState<AssistantState | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  /** Question sent from elsewhere (help page, project greeting); asked once history is loaded. */
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  /** Short "what this page is for" message, shown once per page type per session. */
  const [greet, setGreet] = useState<PageIntro | null>(null);
  const prefs = useAssistantPrefs();
  const location = useLocation();
  const [dragging, setDragging] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const dockRef = useRef<HTMLDivElement>(null);
  const panelAvatarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const moodTimer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);
  const tempId = useRef(-1);
  const sendingRef = useRef(false);

  const dockLook = useLookAt(dockRef);
  const panelLook = useLookAt(panelAvatarRef);
  const reminderAvatarRef = useRef<HTMLDivElement>(null);
  const reminderLook = useLookAt(reminderAvatarRef);

  /** Play a mood for a while, then return to the resting one. */
  const playDock = useCallback((mood: AvatarMood, ms: number) => {
    window.clearTimeout(moodTimer.current);
    setDockMood(mood);
    moodTimer.current = window.setTimeout(() => setDockMood(hovering.current ? 'waving' : 'idle'), ms);
  }, []);

  const playPanel = useCallback((mood: AvatarMood, ms: number, after: AvatarMood = 'idle') => {
    setPanelMood(mood);
    window.setTimeout(() => setPanelMood((m) => (m === mood ? after : m)), ms);
  }, []);

  // Entrance: pop in, wave hello, then idle.
  useEffect(() => {
    const t1 = window.setTimeout(() => setEntering(false), 950);
    const t2 = window.setTimeout(() => playDock('waving', 1900), 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [playDock]);

  useEffect(() => () => window.clearTimeout(moodTimer.current), []);

  // Daily reminder for admins until a Gemini key is configured.
  useEffect(() => {
    if (!isAdmin) return;
    let timer: number | undefined;
    assistantSettingsApi
      .get()
      .then((s) => {
        setSettings(s);
        if (s.can_manage && !s.has_key && !reminderDismissedToday()) {
          timer = window.setTimeout(() => setReminderOpen(true), 2400);
        }
      })
      .catch(() => {});
    return () => window.clearTimeout(timer);
  }, [isAdmin]);

  // Keep in sync when the key is changed from the Settings page.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const s = (e as CustomEvent<AssistantSettingsStatus>).detail;
      setSettings(s);
      setState((st) => (st ? { ...st, mode: s.mode } : st));
      if (s.has_key) setReminderOpen(false);
    };
    window.addEventListener('assistant-settings-changed', onChanged);
    return () => window.removeEventListener('assistant-settings-changed', onChanged);
  }, []);

  const closeReminder = () => {
    dismissReminderToday();
    setReminderOpen(false);
  };

  const onKeySaved = (s: AssistantSettingsStatus) => {
    setSettings(s);
    setState((st) => (st ? { ...st, mode: s.mode } : st));
    if (s.has_key) {
      setReminderMood('celebrate');
      window.setTimeout(() => setReminderOpen(false), 2600);
    }
  };

  const openPanel = () => {
    setOpen(true);
    playPanel('waving', 1800);
    window.setTimeout(() => inputRef.current?.focus(), 250);
    // Load name/mode/history the first time the panel opens.
    if (!state && !loadingHistory) {
      setLoadingHistory(true);
      assistantApi
        .load()
        .then((s) => {
          setState(s);
          setMessages(s.messages);
        })
        .catch(() => toast.error('Không kết nối được trợ lý.'))
        .finally(() => setLoadingHistory(false));
    }
  };

  // Other pages can ask the assistant something: window.dispatchEvent(new CustomEvent('assistant-ask', { detail: '...' }))
  const openPanelRef = useRef(openPanel);
  useEffect(() => {
    openPanelRef.current = openPanel;
  });
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = String((e as CustomEvent<string>).detail ?? '').trim();
      if (!q) return;
      setGreet(null);
      setMinimized(false);
      writeMinimized(false);
      setPendingAsk(q);
      openPanelRef.current();
    };
    window.addEventListener('assistant-ask', onAsk);
    return () => window.removeEventListener('assistant-ask', onAsk);
  }, []);

  // Introduce each page once per browser session (can be turned off in the robot's settings).
  useEffect(() => {
    const intro = introFor(location.pathname);
    // Leaving the page hides its introduction.
    setGreet((g) => (g && intro && g.key === intro.key ? g : null));
    if (!intro || !prefs.pageIntros) return;
    const storageKey = `asst-intro:${intro.key}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {
      /* storage unavailable: introduce anyway */
    }
    const remember = () => {
      try {
        sessionStorage.setItem(storageKey, '1');
      } catch {
        /* ignore */
      }
    };
    let alive = true;
    // Let the page render first, so the message does not cover it while loading.
    const timer = window.setTimeout(() => {
      if (!intro.projectId) {
        if (alive) {
          setGreet(intro);
          remember();
        }
        return;
      }
      projectsApi
        .get(intro.projectId)
        .then((proj) => {
          if (!alive) return;
          setGreet({
            ...intro,
            title: `Dự án: ${proj.name}`,
            text: `Đây là trang dự án **${proj.name}**: tổng quan tiến độ, thành viên và các bảng bên trong.`,
            suggestions: intro.suggestions.map(([label, q]) => [label, q || `Tiến độ dự án ${proj.name}`]),
          });
          remember();
        })
        .catch(() => {});
    }, 900);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [location.pathname, prefs.pageIntros]);

  const askNow = (q: string) => {
    setGreet(null);
    setPendingAsk(q);
    openPanel();
  };

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Opening (or reopening) the chat shows the latest messages, not the first ones.
  useLayoutEffect(() => {
    if (open && !loadingHistory) scrollToEnd(false);
  }, [open, loadingHistory, scrollToEnd]);

  useEffect(() => {
    scrollToEnd(true);
  }, [messages, sending, scrollToEnd]);

  /** Images load after the message is shown; keep the view at the bottom if it was there. */
  const onMediaLoad = useCallback(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 320) scrollToEnd(false);
  }, [scrollToEnd]);

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => releaseFiles(filesRef.current), []);

  const addFiles = useCallback(async (list: File[]) => {
    if (!list.length) return;
    const { added, errors } = await prepareFiles(list, filesRef.current.length);
    errors.slice(0, 2).forEach((e) => toast.error(e));
    if (added.length) setFiles((f) => [...f, ...added]);
    inputRef.current?.focus();
  }, []);

  const removeFile = (key: string) =>
    setFiles((list) => {
      releaseFiles(list.filter((f) => f.key === key));
      return list.filter((f) => f.key !== key);
    });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    // Clicking anywhere outside the chat closes it (toast notifications don't count).
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || panelRef.current?.contains(target) || target.closest('[data-sonner-toaster]')) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  /** Send typed text (or a suggestion) with the attached files; `voice` is a recording sent right away. */
  const send = async (text?: string, voice?: File) => {
    const message = (text ?? input).trim();
    let outgoing: PendingFile[] = text === undefined ? files : [];
    if (voice) {
      const prepared = await prepareFiles([voice], outgoing.length);
      outgoing = [...outgoing, ...prepared.added];
    }
    if ((!message && !outgoing.length) || sending) return;
    if (text === undefined) {
      setInput('');
      setFiles([]);
    }
    const preview: ChatAttachment[] = outgoing.map((f) => ({
      id: f.key, name: f.file.name, mime: f.file.type, size: f.file.size, kind: f.kind, url: f.preview ?? '',
    }));
    const temp: AssistantMessage = { id: tempId.current--, role: 'user', content: message, meta: null, attachments: preview, created_at: '' };
    setMessages((m) => [...m, temp]);
    setSending(true);
    sendingRef.current = true;
    setPanelMood('nod');
    // Nod first, then think, but only if the answer has not arrived yet.
    window.setTimeout(() => sendingRef.current && setPanelMood('thinking'), 900);
    try {
      const res = await assistantApi.chat(message, outgoing.map((f) => f.file));
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), res.user_message, res.reply]);
      releaseFiles(outgoing);
      if (res.usage) setState((st) => (st ? { ...st, usage: res.usage } : st));
      const talkMs = Math.min(4500, 600 + res.reply.content.length * 35);
      playPanel(res.reply.meta?.type === 'task_preview' ? 'waving' : 'talking', talkMs);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      // Give the text and files back so nothing has to be typed or picked again.
      if (text === undefined) {
        setInput(message);
        setFiles(outgoing);
      } else {
        releaseFiles(outgoing);
      }
      setPanelMood('idle');
      const data = e?.response?.data;
      const firstError = data?.errors ? (Object.values(data.errors)[0] as string[])?.[0] : null;
      toast.error(
        e?.response?.status === 429
          ? 'Anh/chị gửi nhanh quá, chờ chút rồi thử lại nhé.'
          : e?.response?.status === 413
            ? 'Tệp quá lớn để tải lên.'
            : firstError || 'Trợ lý chưa trả lời được, vui lòng thử lại.',
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  useEffect(() => {
    if (!pendingAsk || !open || !state || loadingHistory || sending) return;
    const q = pendingAsk;
    setPendingAsk(null);
    void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send is recreated every render
  }, [pendingAsk, open, state, loadingHistory, sending]);

  const clear = async () => {
    if (!window.confirm('Xóa toàn bộ lịch sử trò chuyện với trợ lý?')) return;
    await assistantApi.clear().catch(() => {});
    setMessages([]);
  };

  const minimize = () => {
    setOpen(false);
    setMinimized(true);
    writeMinimized(true);
  };

  const restore = () => {
    setMinimized(false);
    writeMinimized(false);
    setEntering(true);
    window.setTimeout(() => setEntering(false), 950);
  };

  const name = state?.name ?? 'Trợ lý công việc DANAVA';
  // Address the user as "anh" / "chị" from their profile gender.
  const xh = user?.gender === 'Nam' ? 'anh' : user?.gender === 'Nữ' ? 'chị' : 'anh/chị';

  const reminder = reminderOpen && settings && !open && (
    <section className="asst-reminder" role="dialog" aria-label="Cài đặt khóa Gemini cho trợ lý">
      <div className="rounded-[20px] border border-border bg-card shadow-2xl overflow-hidden">
        <header className="flex items-center gap-2.5 pl-3 pr-2 py-2.5 text-white" style={{ background: 'linear-gradient(120deg, #1E2A5E 0%, #2B3F8F 70%, #F47624 160%)' }}>
          <div ref={reminderAvatarRef} className="shrink-0">
            <RobotAvatar mood={reminderMood} look={reminderLook} size={40} />
          </div>
          <div className="flex-1 min-w-0">
            <FitText text={`Em là ${name} 👋`} className="font-bold leading-tight" />
            <div className="text-xs text-white/80 mt-0.5">Em cần khóa Gemini để thông minh hơn</div>
          </div>
          <button type="button" onClick={closeReminder} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="p-4 space-y-3 max-h-[min(70dvh,560px)] overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Hiện em đang chạy <b className="text-foreground">chế độ thử nghiệm</b>. Anh/chị dán khóa API Gemini vào đây để em trò chuyện tự nhiên
            và đọc tin nhắn giao việc chính xác hơn nhé. Khóa này dùng chung cho cả công ty.
          </p>
          <GeminiKeyForm status={settings} onChange={onKeySaved} compact />
        </div>
        <footer className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">Cũng có thể cài trong Cài đặt tài khoản</span>
          <button type="button" onClick={closeReminder} className="text-xs font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap">
            Để mai nhắc lại
          </button>
        </footer>
      </div>
    </section>
  );

  const greeting = greet && !open && !reminderOpen && !minimized && (
    <section className="asst-reminder" role="dialog" aria-label={`${name} giới thiệu trang`}>
      <div className="rounded-[20px] border border-border bg-card shadow-2xl overflow-hidden">
        <header className="flex items-center gap-2.5 pl-3 pr-2 py-2.5 text-white" style={{ background: 'linear-gradient(120deg, #1E2A5E 0%, #2B3F8F 70%, #F47624 160%)' }}>
          <div className="shrink-0"><RobotAvatar mood="waving" look={{ x: 0, y: 0 }} size={36} /></div>
          <div className="flex-1 min-w-0">
            <FitText text={`Em là ${name} 👋`} className="font-bold leading-tight" />
            <div className="text-xs text-white/80 mt-0.5 truncate">{greet.title}</div>
          </div>
          <button type="button" onClick={() => setGreet(null)} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Đóng"><X size={18} /></button>
        </header>
        <div className="p-3.5 space-y-2">
          <div className="text-sm text-foreground leading-relaxed"><MarkdownLite text={greet.text.replaceAll('anh/chị', xh)} /></div>
          {greet.suggestions.map(([label, q]) => (
            <button key={label} type="button" onClick={() => askNow(q)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-left text-sm text-foreground hover:bg-accent hover:border-ring/40 transition-colors">
              {label}
            </button>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" onClick={() => { setGreet(null); openPanel(); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <MessageCircleQuestion size={14} /> Hỏi điều khác
            </button>
            <button type="button" onClick={() => { setGreet(null); savePrefs({ ...prefs, pageIntros: false }); toast.success('Đã tắt giới thiệu trang. Bật lại trong nút bảng màu của trợ lý.'); }}
              className="text-xs text-muted-foreground hover:text-foreground">
              Tắt giới thiệu
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  if (minimized) {
    return (
      <>
        {reminder}
        <button type="button" className="asst-mini-tab" onClick={restore} title="Hiện trợ lý">
          {name}
        </button>
      </>
    );
  }

  return (
    <>
      {reminder}
      {greeting}
      {!open && !reminderOpen && (
        <div
          ref={dockRef}
          className="asst-dock"
          data-enter={entering ? 'true' : undefined}
          role="button"
          tabIndex={0}
          aria-label={`Mở ${name}`}
          onClick={openPanel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPanel();
            }
          }}
          onMouseEnter={() => {
            hovering.current = true;
            playDock('waving', 2200);
          }}
          onMouseLeave={() => {
            hovering.current = false;
            setDockMood('idle');
          }}
        >
          <RobotAvatar mood={dockMood} look={dockLook} size={compact ? 52 : 60} />
        </div>
      )}

      {open && <div className="asst-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <section
          ref={panelRef}
          className="asst-panel"
          role="dialog"
          aria-label={name}
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes('Files')) setDragging(true);
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="asst-panel-inner relative flex flex-col h-full rounded-[20px] overflow-hidden border border-border bg-card shadow-2xl">
            {dragging && (
              <div className="absolute inset-0 z-20 m-2 rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-primary pointer-events-none">
                <Upload size={28} />
                <span className="text-sm font-semibold">Thả ảnh hoặc tệp vào đây</span>
              </div>
            )}
            <header className="flex items-center gap-2.5 pl-3 pr-2 py-2 text-white" style={{ background: 'linear-gradient(120deg, #1E2A5E 0%, #2B3F8F 70%, #F47624 160%)' }}>
              {/* Robot sits inside the header, next to the name */}
              <div ref={panelAvatarRef} className="shrink-0">
                <RobotAvatar mood={sending && panelMood !== 'nod' ? 'thinking' : panelMood} look={panelLook} size={40} />
              </div>
              {/* Row 1: the full name on one line + close. Row 2: status + tools, so the name gets the whole width. */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <FitText text={name} className="flex-1 text-[15px] font-bold leading-tight" />
                  <button type="button" onClick={() => setOpen(false)} className="shrink-0 -mr-0.5 p-1 rounded-lg hover:bg-white/15" title="Đóng" aria-label="Đóng">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="min-w-0 flex-1 text-[11px] text-white/75 flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${sending ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'}`} />
                    {sending ? 'Đang suy nghĩ…' : 'Sẵn sàng'}
                    {state?.mode === 'demo' && <span className="px-1.5 rounded bg-white/20 font-semibold">Thử nghiệm</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomizing((v) => !v)}
                    className={`shrink-0 p-1 rounded-md hover:bg-white/15 ${customizing ? 'bg-white/20' : ''}`}
                    title="Tùy chỉnh màu sắc và biểu cảm"
                    aria-label="Tùy chỉnh trợ lý"
                    aria-pressed={customizing}
                  >
                    <Palette size={14} />
                  </button>
                  <button type="button" onClick={clear} className="shrink-0 p-1 rounded-md hover:bg-white/15" title="Xóa lịch sử" aria-label="Xóa lịch sử">
                    <Trash2 size={14} />
                  </button>
                  <button type="button" onClick={minimize} className="shrink-0 p-1 rounded-md hover:bg-white/15" title="Ẩn trợ lý" aria-label="Ẩn trợ lý">
                    <EyeOff size={14} />
                  </button>
                </div>
              </div>
            </header>

            {customizing && <RobotCustomizer onClose={() => setCustomizing(false)} />}

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-background/60">
              {loadingHistory && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 size={16} className="animate-spin" /> Đang tải…
                </div>
              )}

              {!loadingHistory && messages.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-3.5 py-2.5 text-sm text-foreground max-w-[90%]">
                    Em chào {xh}! Em là <b>{name}</b> 👋{'\n'}
                    <span className="block mt-1 text-muted-foreground">
                      {xh.charAt(0).toUpperCase() + xh.slice(1)} có thể hỏi em về công việc, chấm công, hoặc <b>dán tin nhắn giao việc</b> (mỗi việc một dòng, có @tên) để em tạo công việc vào đúng bảng.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="text-xs px-2.5 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 whitespace-nowrap">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl ${m.attachments?.length && !m.content ? 'p-1.5' : 'px-3.5 py-2.5'} text-sm break-words ${m.role === 'user' ? 'whitespace-pre-wrap' : ''} ${
                      m.role === 'user' ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm bg-card border border-border text-foreground'
                    } ${m.meta?.type === 'task_preview' ? 'w-full max-w-full' : ''}`}
                  >
                    {!!m.attachments?.length && (
                      <div className={m.content ? 'mb-2' : ''}>
                        <MessageAttachments items={m.attachments} mine={m.role === 'user'} onMediaLoad={onMediaLoad} />
                      </div>
                    )}
                    {m.role === 'assistant' ? <MarkdownLite text={m.content} /> : m.content}
                    {m.meta?.type === 'task_preview' && (
                      <TaskPreviewCard
                        messageId={m.id}
                        preview={m.meta.preview}
                        onApplied={(created) => created > 0 && playPanel('celebrate', 2600)}
                      />
                    )}
                    {m.role === 'assistant' && !!m.content.trim() && <CopyMessageButton markdown={m.content} />}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="asst-composer border-t border-border p-2.5 bg-card">
              <ChatComposer
                inputRef={inputRef}
                value={input}
                onChange={setInput}
                files={files}
                onAddFiles={(list) => void addFiles(list)}
                onRemoveFile={removeFile}
                onSend={(voice) => void send(undefined, voice)}
                sending={sending}
              />
              {state?.mode === 'live' && state.usage?.me_remaining != null && (
                <div className={`mt-1.5 text-[11px] text-center ${state.usage.me_remaining <= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  Còn {state.usage.me_remaining}/{state.usage.limits.per_user_daily} lượt hỏi AI hôm nay
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
