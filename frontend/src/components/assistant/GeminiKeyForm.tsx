import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Trash2, ChevronDown, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { assistantSettingsApi, formatDateTimeVN, type AssistantSettingsStatus, type ConfirmReplaceInfo, type GeminiModelOption } from '../../lib/api/assistant';

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

interface GeminiKeyFormProps {
  status: AssistantSettingsStatus;
  onChange: (status: AssistantSettingsStatus) => void;
  /** Tighter layout for the assistant pop-up. */
  compact?: boolean;
}

export function GeminiKeyGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border bg-muted/30">
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none px-3.5 py-2.5 text-sm font-semibold text-foreground">
        <span>Hướng dẫn lấy khóa API Gemini (miễn phí, khoảng 2 phút)</span>
        <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="px-3.5 pb-3.5 space-y-2 text-sm text-muted-foreground list-decimal list-inside marker:font-bold marker:text-primary">
        <li>
          Mở trang{' '}
          <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">
            Google AI Studio <ExternalLink size={12} />
          </a>
          .
        </li>
        <li>Đăng nhập bằng tài khoản Google (nên dùng tài khoản của công ty).</li>
        <li>
          Bấm <b className="text-foreground">Create API key</b> (Tạo khóa API). Nếu được hỏi chọn dự án, chọn dự án có sẵn hoặc để Google tạo mới.
        </li>
        <li>
          Bấm nút <b className="text-foreground">sao chép</b> bên cạnh khóa vừa tạo. Khóa thường bắt đầu bằng <code className="px-1 rounded bg-muted text-foreground">AIza</code>.
          Hệ thống cũng nhận khóa <b className="text-foreground">Vertex AI</b> của Google Cloud (bắt đầu bằng <code className="px-1 rounded bg-muted text-foreground">AQ.</code>).
        </li>
        <li>
          Dán vào ô bên dưới rồi bấm <b className="text-foreground">Kiểm tra &amp; lưu</b>. Hệ thống sẽ thử kết nối trước khi lưu.
        </li>
      </ol>
      <div className="mx-3.5 mb-3.5 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          Khóa giống như mật khẩu: không gửi cho người khác. Khóa được mã hóa khi lưu và nhân viên khác không xem được. Gói miễn phí có giới hạn số lượt mỗi phút/ngày.
        </span>
      </div>
    </details>
  );
}

export function GeminiKeyForm({ status, onChange, compact = false }: GeminiKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(status.model);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  if (!status.can_manage) {
    return (
      <div className="text-sm text-muted-foreground">
        {status.has_key
          ? 'Trợ lý đã được kết nối Gemini bởi quản trị viên.'
          : 'Trợ lý đang chạy chế độ thử nghiệm. Quản trị viên hệ thống sẽ cài đặt khóa Gemini.'}
      </div>
    );
  }

  const save = async () => {
    const key = apiKey.trim();
    const modelChanged = model.trim() && model.trim() !== status.model;
    if (!key && !modelChanged) {
      setError('Vui lòng dán khóa API vào ô trên.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { ...(key ? { api_key: key } : {}), ...(modelChanged ? { model: model.trim() } : {}) };
    try {
      let res;
      try {
        res = await assistantSettingsApi.save(payload);
      } catch (e: any) {
        // A working key exists: ask before replacing it (another admin may have set it).
        const info = e?.response?.status === 409 ? (e.response.data as ConfirmReplaceInfo) : null;
        if (info?.code !== 'confirm_replace') throw e;
        const who = info.current.updated_by ? ` do ${info.current.updated_by} cài` : '';
        const when = info.current.updated_at ? ` lúc ${formatDateTimeVN(info.current.updated_at)}` : '';
        const source = info.current.source === 'env' ? ' (cấu hình trong file .env)' : '';
        const ok = window.confirm(
          `Khóa hiện tại ${info.current.key_hint}${who}${when}${source} đang hoạt động cho cả công ty.

Thay bằng khóa mới? Khóa mới sẽ được kiểm tra trước khi thay.`,
        );
        if (!ok) return;
        res = await assistantSettingsApi.save({ ...payload, confirm_replace: true });
      }
      toast.success(res.message || 'Đã lưu khóa Gemini.');
      setApiKey('');
      onChange(res);
    } catch (e: any) {
      const errs = e?.response?.data?.errors;
      setError(errs?.api_key?.[0] || errs?.model?.[0] || e?.response?.data?.message || 'Không lưu được khóa, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const by = status.key_updated?.by ? ` (do ${status.key_updated.by.name} cài)` : '';
    if (!window.confirm(`Xóa khóa Gemini ${status.key_hint ?? ''}${by}? Cả công ty sẽ quay về chế độ thử nghiệm.`)) return;
    setRemoving(true);
    try {
      const res = await assistantSettingsApi.removeKey();
      toast.success(res.message || 'Đã xóa khóa.');
      onChange(res);
    } catch {
      toast.error('Không xóa được khóa.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
          status.has_key ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
        }`}
      >
        {status.has_key ? <CheckCircle2 size={16} className="shrink-0" /> : <KeyRound size={16} className="shrink-0" />}
        <span className="min-w-0">
          {status.has_key ? (
            <>
              Đã kết nối {status.endpoint === 'vertex' ? 'Vertex AI' : 'Gemini'} · khóa <b className="font-mono">{status.key_hint}</b> · model <b>{status.model}</b>
              {status.source === 'env' && <span className="opacity-75"> (cấu hình trong file .env)</span>}
              {status.key_updated && (
                <span className="block text-xs opacity-80 mt-0.5">
                  Cập nhật lần cuối{status.key_updated.by ? ` bởi ${status.key_updated.by.name}` : ''} lúc {formatDateTimeVN(status.key_updated.at)}
                </span>
              )}
            </>
          ) : (
            'Chưa có khóa Gemini: trợ lý đang chạy chế độ thử nghiệm.'
          )}
        </span>
      </div>

      <GeminiKeyGuide defaultOpen={!status.has_key && !compact} />

      <div>
        <label htmlFor="gemini-key" className="block text-sm font-semibold text-foreground mb-1.5">
          {status.has_key ? 'Thay khóa API mới' : 'Khóa API Gemini'}
        </label>
        <div className="relative">
          <input
            id="gemini-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Dán khóa (AIza… hoặc AQ.…)"
            autoComplete="off"
            spellCheck={false}
            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-border bg-background font-mono text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
            aria-label={showKey ? 'Ẩn khóa' : 'Hiện khóa'}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {!compact && <ModelPicker value={model} onChange={setModel} hasKey={status.has_key} />}

      {error && <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2 break-words">{linkify(error)}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {saving ? 'Đang kiểm tra khóa…' : 'Kiểm tra & lưu'}
        </button>
        {status.has_key && status.source === 'app' && (
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 whitespace-nowrap"
          >
            <Trash2 size={15} /> Xóa khóa
          </button>
        )}
      </div>
    </div>
  );
}

/** Render https links in an error message as clickable links (text stays plain, no HTML). */
function linkify(text: string) {
  return text.split(/(https:\/\/[^\s]+)/g).map((part, i) =>
    part.startsWith('https://') ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
        mở trang bật API
      </a>
    ) : (
      part
    ),
  );
}

const CUSTOM = '__custom__';

/** Model dropdown: the models the saved key can use (asked from Google), or a built-in list. */
function ModelPicker({ value, onChange, hasKey }: { value: string; onChange: (v: string) => void; hasKey: boolean }) {
  const [models, setModels] = useState<GeminiModelOption[]>([]);
  const [source, setSource] = useState<'google' | 'builtin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    assistantSettingsApi
      .models()
      .then((r) => {
        if (cancelled) return;
        setModels(r.models);
        setSource(r.source);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hasKey]);

  const known = models.some((m) => m.id === value);
  const [custom, setCustom] = useState(false);
  const showCustom = custom || (!loading && !known && value !== '');
  const selected = models.find((m) => m.id === value);

  return (
    <div className="text-sm">
      <label htmlFor="gemini-model" className="block text-sm font-semibold text-foreground mb-1.5">Model AI</label>
      <select
        id="gemini-model"
        value={showCustom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        disabled={loading}
        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm disabled:opacity-60"
      >
        {loading && <option>Đang tải danh sách model…</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
        ))}
        <option value={CUSTOM}>Khác (tự nhập tên model)…</option>
      </select>
      {showCustom && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="vd: gemini-2.5-flash"
          className="mt-2 w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-mono"
          aria-label="Tên model"
        />
      )}
      {selected?.description && <p className="text-xs text-muted-foreground mt-1">{selected.description}</p>}
      <p className="text-xs text-muted-foreground mt-1">
        {source === 'google'
          ? 'Danh sách lấy trực tiếp từ Google: đây là các model khóa của anh/chị dùng được.'
          : 'Danh sách model phổ biến. Lưu khóa xong, danh sách sẽ lấy trực tiếp từ Google theo khóa của anh/chị.'}
      </p>
    </div>
  );
}
