import React, { useState, useEffect } from 'react';
import {
  Send, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Power,
  ExternalLink, Copy, Check, ChevronDown, ChevronUp, ShieldCheck, HelpCircle
} from 'lucide-react';
import {
  getDepartmentTelegram, updateDepartmentTelegram, verifyDepartmentTelegram,
  testDepartmentTelegram, disconnectDepartmentTelegram, type TelegramIntegrationStatus
} from '../../lib/api/telegram';
import { toast } from 'sonner';

interface DepartmentTelegramCardProps {
  departmentId: number | string;
  departmentName: string;
}

export const DepartmentTelegramCard: React.FC<DepartmentTelegramCardProps> = ({
  departmentId,
  departmentName,
}) => {
  const [data, setData] = useState<TelegramIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatIdInput, setChatIdInput] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [eventSettings, setEventSettings] = useState<Record<string, boolean>>({
    employee_added: true,
    employee_transferred: true,
    task_assigned: true,
    task_completed: true,
    task_overdue: true,
    daily_summary: false,
    weekly_performance_summary: true,
  });

  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copiedBot, setCopiedBot] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await getDepartmentTelegram(departmentId);
      setData(res);
      setChatIdInput(res.chat_id || '');
      setEnabled(res.enabled);
      if (res.event_settings) {
        setEventSettings(prev => ({ ...prev, ...res.event_settings }));
      }
    } catch (err: any) {
      toast.error('Không thể tải cấu hình Telegram phòng ban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [departmentId]);

  const handleVerify = async () => {
    const clean = chatIdInput.trim();
    if (!clean) {
      toast.error('Vui lòng nhập Chat ID trước khi kiểm tra');
      return;
    }

    try {
      setVerifying(true);
      const res = await verifyDepartmentTelegram(departmentId, clean);
      toast.success(res.message);
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xác thực Chat ID với Telegram');
    } finally {
      setVerifying(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await testDepartmentTelegram(departmentId);
      toast.success(res.message);
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi gửi tin nhắn thử');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await updateDepartmentTelegram(departmentId, {
        chat_id: chatIdInput.trim() || null,
        enabled,
        event_settings: eventSettings,
      });
      toast.success(res.message);
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn ngắt kết nối Telegram khỏi phòng ban "${departmentName}"?`)) {
      return;
    }

    try {
      setDisconnecting(true);
      const res = await disconnectDepartmentTelegram(departmentId);
      toast.success(res.message);
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi ngắt kết nối');
    } finally {
      setDisconnecting(false);
    }
  };

  const toggleEvent = (key: string) => {
    setEventSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyBotUsername = () => {
    const botUser = data?.bot_username || 'trolyNotificationAI_bot';
    navigator.clipboard.writeText(`@${botUser}`);
    setCopiedBot(true);
    toast.success(`Đã sao chép @${botUser}`);
    setTimeout(() => setCopiedBot(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-center min-h-[160px]">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const status = data?.status || 'disconnected';
  const botUsername = data?.bot_username || 'trolyNotificationAI_bot';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-50/60 to-indigo-50/40 dark:from-sky-950/20 dark:to-indigo-950/10">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Telegram của phòng ban
              </h3>
              {/* Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                status === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : status === 'pending'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : status === 'error'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {status === 'connected' && <CheckCircle2 className="w-3 h-3" />}
                {status === 'pending' && <RefreshCw className="w-3 h-3 animate-spin" />}
                {status === 'error' && <AlertCircle className="w-3 h-3" />}
                {status === 'connected' ? 'Đã kết nối' : status === 'pending' ? 'Chờ kiểm tra' : status === 'error' ? 'Lỗi kết nối' : 'Chưa kết nối'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tự động gửi thông báo nhân sự và báo cáo công việc vào nhóm Telegram của phòng ban.
            </p>
          </div>
        </div>

        {/* Enable Switch */}
        <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
          <label htmlFor="dept-telegram-switch" className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
            Bật thông báo
          </label>
          <input
            id="dept-telegram-switch"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        {/* Chat ID Input & Action Buttons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-8 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Chat ID nhóm Telegram của phòng ban:</span>
              {data?.chat_title && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Nhóm: <strong>{data.chat_title}</strong>
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
                placeholder="-100xxxxxxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Thêm Bot <span className="font-semibold text-sky-600 dark:text-sky-400">@{botUsername}</span> vào nhóm Telegram, nhập Chat ID của nhóm và nhấn <strong>Kiểm tra kết nối</strong>.
            </p>
          </div>

          <div className="lg:col-span-4 flex items-center gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying || !chatIdInput.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-sky-500' : ''}`} />
              <span>{verifying ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>

            <button
              onClick={handleTest}
              disabled={testing || status !== 'connected' || !data?.bot_configured}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-all disabled:opacity-50 shadow-xs"
              title={status !== 'connected' ? 'Cần xác thực kết nối thành công trước khi gửi thử' : 'Gửi tin nhắn mẫu vào nhóm Telegram'}
            >
              <Send className={`w-3.5 h-3.5 ${testing ? 'animate-pulse' : ''}`} />
              <span>{testing ? 'Đang gửi...' : 'Gửi tin thử'}</span>
            </button>
          </div>
        </div>

        {/* Last Error Banner if any */}
        {data?.last_error_message && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 dark:text-rose-400">
              <strong>Lỗi kết nối gần nhất:</strong> {data.last_error_message}
            </div>
          </div>
        )}

        {/* Event selection area */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Chọn sự kiện muốn nhận thông báo
            </h4>
            <span className="text-[11px] text-slate-400">
              Chỉ sự kiện được tích chọn mới gửi vào nhóm
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={eventSettings.employee_added}
                onChange={() => toggleEvent('employee_added')}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Có nhân viên mới vào phòng</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={eventSettings.employee_transferred}
                onChange={() => toggleEvent('employee_transferred')}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Nhân viên được điều chuyển</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={eventSettings.task_assigned}
                onChange={() => toggleEvent('task_assigned')}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Có task mới được giao</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={eventSettings.task_completed}
                onChange={() => toggleEvent('task_completed')}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Task được hoàn thành</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={eventSettings.task_overdue}
                onChange={() => toggleEvent('task_overdue')}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Task quá hạn hoàn thành</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={eventSettings.weekly_performance_summary}
                onChange={() => toggleEvent('weekly_performance_summary')}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium text-slate-700 dark:text-slate-200">Báo cáo hiệu suất hàng tuần</span>
            </label>
          </div>
        </div>

        {/* Collapsible Step-by-Step Instructions */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <HelpCircle className="w-4 h-4" />
              <span>Hướng dẫn cách lấy Chat ID nhóm Telegram</span>
            </div>
            {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showInstructions && (
            <div className="p-4 bg-white dark:bg-slate-900 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800">
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  Tạo hoặc mở nhóm Telegram của phòng ban bạn muốn nhận thông báo.
                </li>
                <li>
                  Thêm Bot <strong className="text-sky-600 dark:text-sky-400">@{botUsername}</strong> vào nhóm với quyền gửi tin nhắn.
                </li>
                <li>
                  Gửi tin nhắn <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600">/chatid</code> vào trong nhóm (hoặc thêm bot <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">@userinfobot</code> để xem ID nhóm).
                </li>
                <li>
                  Nhóm Telegram (Supergroup) sẽ có Chat ID bắt đầu bằng <strong>-100</strong> (VD: <code className="font-mono text-slate-800 dark:text-slate-200 font-bold">-1004340949074</code>).
                </li>
                <li>
                  Dán Chat ID vào ô trên, bấm <strong>Kiểm tra kết nối</strong> rồi bấm <strong>Gửi tin thử</strong> để xác nhận.
                </li>
              </ol>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={copyBotUsername}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {copiedBot ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Sao chép tên Bot</span>
                </button>

                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                >
                  <span>Mở Bot trên Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            {status !== 'disconnected' && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Ngắt kết nối Telegram</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/20"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Lưu cấu hình</span>
          </button>
        </div>
      </div>
    </div>
  );
};
