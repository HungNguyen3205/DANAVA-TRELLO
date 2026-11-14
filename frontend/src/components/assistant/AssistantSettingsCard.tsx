import { useEffect, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { GeminiKeyForm } from './GeminiKeyForm';
import { AssistantUsagePanel } from './AssistantUsagePanel';
import { AssistantActionLogPanel } from './AssistantActionLogPanel';
import { assistantSettingsApi, type AssistantSettingsStatus } from '../../lib/api/assistant';

/** Settings page card for the company Gemini key (editable by system admins). */
export function AssistantSettingsCard() {
  const [status, setStatus] = useState<AssistantSettingsStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    assistantSettingsApi.get().then(setStatus).catch(() => setFailed(true));
  }, []);

  const onChange = (s: AssistantSettingsStatus) => {
    setStatus(s);
    // Let the floating assistant pick up the new mode without a reload.
    window.dispatchEvent(new CustomEvent('assistant-settings-changed', { detail: s }));
  };

  return (
    <div id="tro-ly-ai" className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden scroll-mt-6">
      <div className="p-5 md:p-6 border-b border-border/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
          <Bot size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Trợ lý AI (Gemini)</h3>
          <p className="text-muted-foreground text-sm">Kết nối trợ lý với Google Gemini để trò chuyện và đọc tin nhắn giao việc thông minh hơn.</p>
        </div>
      </div>
      <div className="p-5 md:p-6">
        {failed ? (
          <div className="text-sm text-destructive">Không tải được cài đặt trợ lý.</div>
        ) : !status ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Đang tải…</div>
        ) : (
          <>
            <GeminiKeyForm status={status} onChange={onChange} />
            <AssistantUsagePanel status={status} onChange={onChange} />
            {status.can_manage && <AssistantActionLogPanel />}
          </>
        )}
      </div>
    </div>
  );
}
