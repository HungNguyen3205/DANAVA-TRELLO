import { useState } from 'react';
import { BarChart3, ExternalLink, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { assistantSettingsApi, formatDateTimeVN, type AssistantSettingsStatus } from '../../lib/api/assistant';

const RATE_LIMITS_URL = 'https://ai.google.dev/gemini-api/docs/rate-limits';

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tone = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('vi-VN');

/** Daily AI message usage, and (for admins) the limits per person and for the company. */
export function AssistantUsagePanel({ status, onChange }: { status: AssistantSettingsStatus; onChange: (s: AssistantSettingsStatus) => void }) {
  const [perUser, setPerUser] = useState(String(status.limits.per_user_daily));
  const [company, setCompany] = useState(String(status.limits.company_daily));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const pu = Number(perUser);
    const co = Number(company);
    if (!Number.isInteger(pu) || pu < 0 || !Number.isInteger(co) || co < 0) {
      toast.error('Giới hạn phải là số nguyên từ 0 trở lên (0 = không giới hạn).');
      return;
    }
    setSaving(true);
    try {
      const res = await assistantSettingsApi.save({ limit_per_user_daily: pu, limit_company_daily: co });
      toast.success(res.message || 'Đã lưu giới hạn.');
      onChange(res);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không lưu được giới hạn.');
    } finally {
      setSaving(false);
    }
  };

  const { limits, me_today: me } = status;

  return (
    <div className="space-y-4 pt-5 mt-5 border-t border-border">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <BarChart3 size={16} className="text-primary" /> Lượt nhắn AI hôm nay
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Của anh/chị</span>
          <span className="font-semibold tabular-nums">
            {fmt(me.requests)}{limits.per_user_daily > 0 ? ` / ${fmt(limits.per_user_daily)} lượt` : ' lượt (không giới hạn)'}
          </span>
        </div>
        {limits.per_user_daily > 0 && <Bar value={me.requests} max={limits.per_user_daily} />}
      </div>

      {status.company_today && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Toàn công ty ({status.company_today.users} người dùng)</span>
            <span className="font-semibold tabular-nums">
              {fmt(status.company_today.requests)}{limits.company_daily > 0 ? ` / ${fmt(limits.company_daily)} lượt` : ' lượt'}
            </span>
          </div>
          {limits.company_daily > 0 && <Bar value={status.company_today.requests} max={limits.company_daily} />}
          <div className="text-xs text-muted-foreground">Đã dùng {fmt(status.company_today.tokens)} token hôm nay</div>
        </div>
      )}

      {status.last_days && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">7 ngày gần nhất</div>
          <div className="flex items-end gap-1.5 h-16">
            {status.last_days.map((d) => {
              const max = Math.max(1, ...status.last_days!.map((x) => x.requests));
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.requests} lượt, ${fmt(d.tokens)} token`}>
                  <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(2, (d.requests / max) * 48)}px` }} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {status.can_manage && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3.5">
          <div className="text-sm font-semibold text-foreground">Giới hạn lượt nhắn</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">
              Mỗi người / ngày
              <input type="number" min={0} step={1} inputMode="numeric" value={perUser} onChange={(e) => setPerUser(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Toàn công ty / ngày
              <input type="number" min={0} step={1} inputMode="numeric" value={company} onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Nhập <b>0</b> để không giới hạn. Hết lượt, trợ lý vẫn trả lời bằng dữ liệu có sẵn (không dùng AI). Lượt được tính lại mỗi ngày (giờ Việt Nam).
          </p>
          <p className="text-xs text-muted-foreground">
            Google cũng có giới hạn riêng, tính theo dự án và từng model, và thay đổi khá thường xuyên. Xem{' '}
            <a href={RATE_LIMITS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              giới hạn của Google <ExternalLink size={11} />
            </a>{' '}
            hoặc trong Google AI Studio để đặt con số phù hợp.
          </p>
          {status.limits_updated && (
            <p className="text-xs text-muted-foreground">
              Cập nhật lần cuối{status.limits_updated.by ? ` bởi ${status.limits_updated.by.name}` : ''} lúc {formatDateTimeVN(status.limits_updated.at)}
            </p>
          )}
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60 whitespace-nowrap">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu giới hạn
          </button>
        </div>
      )}

      {status.history && status.history.length > 0 && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold text-foreground">
            Lịch sử thay đổi cài đặt AI ({status.history.length})
          </summary>
          <ol className="px-3.5 pb-3 space-y-2">
            {status.history.map((h, i) => (
              <li key={i} className="text-xs flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <span className="text-muted-foreground tabular-nums whitespace-nowrap">{formatDateTimeVN(h.at)}</span>
                <span className="text-foreground">
                  <b>{h.by ?? 'Không rõ'}</b>: {h.text}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
