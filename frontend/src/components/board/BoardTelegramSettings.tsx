import React, { useState, useEffect } from 'react';
import {
  Send, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Power,
  ExternalLink, Copy, Check, ChevronDown, ChevronUp, ShieldCheck,
  Building2, Layers, CheckSquare, Square, Info
} from 'lucide-react';
import {
  getBoardTelegram, updateBoardTelegram, verifyBoardTelegram,
  testBoardTelegram, disconnectBoardTelegram, type BoardTelegramStatus
} from '../../lib/api/telegram';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';

interface BoardTelegramSettingsProps {
  boardId: number | string;
  boardName: string;
}

const IMPORTANT_EVENTS = [
  'member_added',
  'task_assigned',
  'task_moved',
  'task_completed',
  'task_overdue',
];

const ALL_EVENT_KEYS = [
  { key: 'member_added', label: 'Thành viên được thêm vào Board', desc: 'Thông báo khi có nhân sự mới tham gia Board', important: true },
  { key: 'member_removed', label: 'Thành viên bị gỡ khỏi Board', desc: 'Thông báo khi có nhân sự rời Board', important: false },
  { key: 'task_created', label: 'Task mới được tạo', desc: 'Khi có công việc mới xuất hiện trên bảng', important: false },
  { key: 'task_assigned', label: 'Task được giao thành viên', desc: 'Khi công việc được phân công người chịu trách nhiệm', important: true },
  { key: 'assignee_changed', label: 'Thay đổi người phụ trách', desc: 'Khi điều chuyển người thực hiện task', important: false },
  { key: 'task_moved', label: 'Task được chuyển cột', desc: 'Cập nhật tiến độ khi di chuyển sang cột mới (ví dụ: Chờ duyệt, Hoàn thành)', important: true },
  { key: 'task_completed', label: 'Task hoàn thành', desc: 'Khi công việc được đánh dấu hoàn thành', important: true },
  { key: 'task_reopened', label: 'Task được mở lại', desc: 'Khi công việc đã xong bị mở lại để làm tiếp', important: false },
  { key: 'task_due_soon', label: 'Task sắp đến hạn', desc: 'Nhắc nhở công việc cận kề deadline (trước 24h)', important: false },
  { key: 'task_overdue', label: 'Task quá hạn', desc: 'Cảnh báo khi công việc đã trễ hạn kế hoạch', important: true },
  { key: 'comment_created', label: 'Có bình luận mới', desc: 'Khi có thảo luận hoặc ý kiến mới trong task', important: false },
  { key: 'subtask_created', label: 'Có task con mới', desc: 'Khi tạo mục công việc phụ trong task', important: false },
  { key: 'subtask_completed', label: 'Task con hoàn thành', desc: 'Khi checklist task con hoàn tất', important: false },
  { key: 'daily_summary', label: 'Tổng kết công việc cuối ngày', desc: 'Bản tin tổng hợp số lượng task mới, hoàn thành, trễ hạn lúc 18:00', important: false },
];

export const BoardTelegramSettings: React.FC<BoardTelegramSettingsProps> = ({
  boardId,
  boardName,
}) => {
  const { user } = useAuthStore();
  const isSystemAdmin = user?.system_role === 'system_admin' || user?.system_role === 'admin';

  const [data, setData] = useState<BoardTelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryMode, setDeliveryMode] = useState<'inherit_department' | 'board_only' | 'department_only' | 'both' | 'disabled'>('inherit_department');
  const [allowDeptNotification, setAllowDeptNotification] = useState(true);
  const [chatIdInput, setChatIdInput] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [eventSettings, setEventSettings] = useState<Record<string, boolean>>({
    member_added: true,
    task_created: false,
    task_assigned: true,
    task_moved: true,
    task_completed: true,
    task_overdue: true,
    daily_summary: false,
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
      const res = await getBoardTelegram(boardId);
      setData(res);
      setDeliveryMode(res.delivery_mode || 'inherit_department');
      setAllowDeptNotification(res.allow_department_notification ?? true);
      setChatIdInput(res.chat_id || '');
      setEnabled(res.enabled ?? false);
      if (res.event_settings) {
        setEventSettings(res.event_settings);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error('Bạn không có quyền xem cấu hình Telegram của Board này.');
      } else {
        toast.error(err.response?.data?.message || 'Không thể tải thông tin Telegram của Board.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (boardId) {
      fetchStatus();
    }
  }, [boardId]);

  const canManage = data?.can_manage ?? false;

  const handleCopyBotUsername = () => {
    navigator.clipboard.writeText('trolyNotificationAI_bot');
    setCopiedBot(true);
    toast.success('Đã sao chép tên bot: @trolyNotificationAI_bot');
    setTimeout(() => setCopiedBot(false), 2000);
  };

  const handleToggleEvent = (key: string) => {
    if (!canManage) return;
    setEventSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectImportant = () => {
    if (!canManage) return;
    const updated: Record<string, boolean> = {};
    ALL_EVENT_KEYS.forEach(e => {
      updated[e.key] = IMPORTANT_EVENTS.includes(e.key);
    });
    setEventSettings(updated);
    toast.info('Đã chọn các sự kiện quan trọng.');
  };

  const handleSelectAll = () => {
    if (!canManage) return;
    const updated: Record<string, boolean> = {};
    ALL_EVENT_KEYS.forEach(e => {
      updated[e.key] = true;
    });
    setEventSettings(updated);
    toast.info('Đã bật tất cả sự kiện.');
  };

  const handleDeselectAll = () => {
    if (!canManage) return;
    const updated: Record<string, boolean> = {};
    ALL_EVENT_KEYS.forEach(e => {
      updated[e.key] = false;
    });
    setEventSettings(updated);
    toast.info('Đã bỏ chọn tất cả sự kiện.');
  };

  const handleVerify = async () => {
    const trimmed = chatIdInput.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập Chat ID nhóm Telegram trước khi kiểm tra.');
      return;
    }

    try {
      setVerifying(true);
      const res = await verifyBoardTelegram(boardId, trimmed);
      toast.success(res.message || 'Xác minh nhóm Telegram thành công!');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Kiểm tra kết nối thất bại.');
    } finally {
      setVerifying(false);
    }
  };

  const handleTestMessage = async () => {
    try {
      setTesting(true);
      const res = await testBoardTelegram(boardId);
      toast.success(res.message || 'Tin nhắn thử đã được gửi thành công!');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gửi tin nhắn thử.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (deliveryMode === 'board_only' && !chatIdInput.trim() && !data?.chat_id_masked) {
      toast.error('Chế độ "Chỉ gửi nhóm Board" yêu cầu phải nhập Chat ID nhóm Board.');
      return;
    }

    try {
      setSaving(true);
      const res = await updateBoardTelegram(boardId, {
        delivery_mode: deliveryMode,
        enabled,
        chat_id: chatIdInput.trim() || undefined,
        event_settings: eventSettings,
        allow_department_notification: allowDeptNotification,
      });
      toast.success(res.message || 'Đã lưu cấu hình Telegram của Board thành công.');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu cấu hình Telegram.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Bạn có chắc muốn ngắt kết nối Telegram riêng của Board này? Cấu hình Chat ID của Board sẽ bị xóa.')) {
      return;
    }

    try {
      setDisconnecting(true);
      const res = await disconnectBoardTelegram(boardId);
      toast.success(res.message || 'Đã ngắt kết nối Telegram của Board.');
      setChatIdInput('');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi ngắt kết nối.');
    } finally {
      setDisconnecting(false);
    }
  };

  const needsBoardChatInput = deliveryMode === 'board_only' || deliveryMode === 'both';
  const hasDepartment = !!data?.department_telegram;
  const isInheriting = deliveryMode === 'inherit_department' || deliveryMode === 'department_only' || deliveryMode === 'both';

  const getStatusBadge = () => {
    if (!data) return null;
    if (deliveryMode === 'disabled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Đã tắt
        </span>
      );
    }
    switch (data.status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Đã kết nối
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
            <AlertCircle className="w-3.5 h-3.5" />
            Lỗi kết nối
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Đang kiểm tra
          </span>
        );
      case 'disabled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Đã tắt
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Chưa kết nối
          </span>
        );
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-xs">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-muted-foreground">Đang tải cấu hình Telegram của Board...</p>
      </div>
    );
  }

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/20 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">Tích hợp Telegram Board</h2>
              {getStatusBadge()}
              {!canManage && (
                <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Chỉ xem
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cấu hình thông báo tự động về tiến độ và công việc của Board {boardName} vào nhóm Telegram.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Hướng dẫn lấy Chat ID</span>
          {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Instructions Accordion */}
      {showInstructions && (
        <div className="bg-sky-50/50 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/40 p-5 text-xs text-slate-700 dark:text-slate-300 animate-in slide-in-from-top duration-200">
          <h4 className="font-bold text-sky-900 dark:text-sky-300 flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Các bước kết nối nhóm Telegram với Board
          </h4>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-1">
            <li>Tạo hoặc mở một nhóm Telegram (Group hoặc Supergroup).</li>
            <li>
              Thêm Bot <span className="font-mono font-bold text-sky-700 dark:text-sky-300">@trolyNotificationAI_bot</span> vào nhóm Telegram.
            </li>
            <li>Cấp quyền quản trị (Admin) hoặc cho phép Bot được gửi tin nhắn trong nhóm.</li>
            <li>
              Gõ lệnh <span className="font-mono font-bold text-slate-800 dark:text-slate-200">/chatid</span> hoặc <span className="font-mono font-bold text-slate-800 dark:text-slate-200">/start</span> trong nhóm để Bot trả lời Chat ID.
            </li>
            <li>Sao chép Chat ID (ví dụ: <span className="font-mono font-bold">-1004340949074</span>) và dán vào ô bên dưới.</li>
            <li>Nhấn <span className="font-bold">Kiểm tra kết nối</span>, sau đó nhấn <span className="font-bold">Gửi tin thử</span> và <span className="font-bold">Lưu cài đặt</span>.</li>
          </ol>
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-sky-200/50 dark:border-sky-800/40">
            <span className="text-[11px] text-slate-500">Tên Bot hệ thống:</span>
            <span className="font-mono font-bold text-sky-800 dark:text-sky-200">@trolyNotificationAI_bot</span>
            <button
              type="button"
              onClick={handleCopyBotUsername}
              className="p-1 rounded text-sky-600 hover:text-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
              title="Sao chép tên Bot"
            >
              {copiedBot ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href="https://t.me/trolyNotificationAI_bot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:underline ml-2"
            >
              <span>Mở Bot trên Telegram</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Toggle Enabled Switch */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
          <div>
            <span className="text-sm font-bold text-foreground block">Kích hoạt thông báo Telegram cho Board</span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Tự động gửi thông báo cập nhật công việc theo chế độ được thiết lập bên dưới.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!canManage}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
          </label>
        </div>

        {/* Delivery Mode Selection */}
        <div>
          <label className="block text-sm font-bold text-foreground mb-2">
            Chế độ gửi thông báo (Delivery Mode)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. inherit_department */}
            <div
              onClick={() => canManage && setDeliveryMode('inherit_department')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                deliveryMode === 'inherit_department'
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 ring-2 ring-sky-500/20'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              } ${!canManage ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delivery_mode"
                  checked={deliveryMode === 'inherit_department'}
                  onChange={() => setDeliveryMode('inherit_department')}
                  disabled={!canManage}
                  className="mt-1 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    Kế thừa Telegram của phòng ban
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Gửi thông báo vào nhóm Telegram chung của phòng ban mà Board trực thuộc.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. board_only */}
            <div
              onClick={() => canManage && setDeliveryMode('board_only')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                deliveryMode === 'board_only'
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 ring-2 ring-sky-500/20'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              } ${!canManage ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delivery_mode"
                  checked={deliveryMode === 'board_only'}
                  onChange={() => setDeliveryMode('board_only')}
                  disabled={!canManage}
                  className="mt-1 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    Chỉ gửi nhóm Telegram của Board
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Chỉ gửi vào nhóm riêng của Board này. Bắt buộc nhập Chat ID riêng của Board.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. department_only */}
            <div
              onClick={() => canManage && setDeliveryMode('department_only')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                deliveryMode === 'department_only'
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 ring-2 ring-sky-500/20'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              } ${!canManage ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delivery_mode"
                  checked={deliveryMode === 'department_only'}
                  onChange={() => setDeliveryMode('department_only')}
                  disabled={!canManage}
                  className="mt-1 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    Chỉ gửi nhóm Telegram của phòng ban
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Chỉ chuyển tiếp vào nhóm phòng ban, không gửi vào nhóm Board dù có Chat ID riêng.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. both */}
            <div
              onClick={() => canManage && setDeliveryMode('both')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                deliveryMode === 'both'
                  ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 ring-2 ring-sky-500/20'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              } ${!canManage ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delivery_mode"
                  checked={deliveryMode === 'both'}
                  onChange={() => setDeliveryMode('both')}
                  disabled={!canManage}
                  className="mt-1 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Gửi cả hai nhóm (Board & Phòng ban)
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Gửi đồng thời vào cả nhóm riêng của Board và nhóm của phòng ban (tự động khử trùng).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inherited Department Information Banner */}
        {isInheriting && (
          <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              Thông tin Telegram kế thừa từ phòng ban
            </h4>
            {hasDepartment ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-muted-foreground">Phòng ban liên kết: </span>
                    <span className="font-bold text-foreground">{data.department_telegram?.department_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nhóm Telegram phòng ban: </span>
                    <span className="font-semibold text-foreground">
                      {data.department_telegram?.chat_title || '(Chưa đặt tên)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trạng thái Telegram phòng ban: </span>
                    <span className={`font-bold ${data.department_telegram?.is_enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {data.department_telegram?.is_enabled ? 'Đang bật' : 'Chưa bật'}
                    </span>
                  </div>
                </div>

                {isSystemAdmin && data.department_telegram?.department_id && (
                  <a
                    href={`/admin/departments/${data.department_telegram.department_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 transition-colors shrink-0"
                  >
                    <span>Xem cấu hình phòng ban</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200/60 dark:border-amber-800/60">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Board này chưa được gắn phòng ban nào nên không thể kế thừa Telegram. Vui lòng chọn chế độ "Chỉ gửi nhóm Telegram của Board" hoặc gán phòng ban cho Board.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Privacy Option: Allow Department Notification */}
        <div className="flex items-start gap-3 p-3.5 bg-muted/20 rounded-xl border border-border">
          <input
            id="allowDeptNotificationCheckbox"
            type="checkbox"
            checked={allowDeptNotification}
            onChange={(e) => canManage && setAllowDeptNotification(e.target.checked)}
            disabled={!canManage}
            className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
          />
          <label htmlFor="allowDeptNotificationCheckbox" className="text-xs cursor-pointer">
            <span className="font-bold text-foreground block">
              Cho phép gửi thông báo sang nhóm Telegram của phòng ban
            </span>
            <span className="text-muted-foreground block mt-0.5">
              Nếu tắt tùy chọn này, các thông tin công việc của Board sẽ không bao giờ bị chuyển tiếp sang nhóm phòng ban để bảo vệ sự riêng tư.
            </span>
          </label>
        </div>

        {/* Board Chat ID Input Section (Visible when board_only or both) */}
        {needsBoardChatInput && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div>
              <label className="block text-sm font-bold text-foreground mb-1">
                Chat ID nhóm Telegram riêng của Board <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  disabled={!canManage}
                  placeholder={data?.chat_id_masked || '-1004340949074'}
                  className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-foreground font-mono text-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all disabled:opacity-60"
                />

                {canManage && (
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={verifying || !chatIdInput.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
                  >
                    {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Kiểm tra kết nối</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Chat ID của nhóm Telegram (thường bắt đầu bằng dấu <span className="font-mono font-bold">-100</span> đối với Supergroup).
              </p>
            </div>

            {/* Verified Details */}
            {data?.chat_title && (
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">Tên nhóm Board đã kết nối: </span>
                  <span className="font-bold text-emerald-950 dark:text-emerald-200">{data.chat_title}</span>
                  {data.chat_id_masked && (
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 ml-2">
                      ({data.chat_id_masked})
                    </span>
                  )}
                </div>
                {data.verified_at && (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Xác minh: {new Date(data.verified_at).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
            )}

            {/* Last Error if any */}
            {data?.last_error_message && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Lỗi kết nối gần nhất:</span>
                  <span>{data.last_error_message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Event Selection Section */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">Sự kiện gửi thông báo về Telegram</h3>
              <p className="text-xs text-muted-foreground">Chọn các hành động trên Board sẽ tự động kích hoạt thông báo Telegram.</p>
            </div>

            {canManage && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectImportant}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 transition-colors"
                >
                  Sự kiện quan trọng
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {ALL_EVENT_KEYS.map((item) => {
              const isChecked = !!eventSettings[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggleEvent(item.key)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'border-sky-300 dark:border-sky-800 bg-sky-50/20 dark:bg-sky-950/10'
                      : 'border-border bg-card hover:bg-muted/30 opacity-70'
                  } ${!canManage ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className="mt-0.5 text-sky-600 dark:text-sky-400 shrink-0">
                    {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{item.label}</span>
                      {item.important && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Quan trọng
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {data?.status === 'connected' && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors w-full sm:w-auto"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{disconnecting ? 'Đang ngắt...' : 'Ngắt kết nối Board'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleTestMessage}
                disabled={testing || (!data?.chat_title && !data?.chat_id_masked && deliveryMode === 'board_only')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 transition-colors w-full sm:w-auto disabled:opacity-50"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{testing ? 'Đang gửi...' : 'Gửi tin thử Telegram'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition-all w-full sm:w-auto disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{saving ? 'Đang lưu...' : 'Lưu cài đặt Telegram'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
