import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, CheckCircle2, Clock, FileText, AlertCircle, 
  Edit3, Plus, Save, X, RefreshCw, Users, Award 
} from 'lucide-react';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import { 
  getPerformancePolicy, acknowledgePerformancePolicy, updatePerformancePolicy,
  type PolicyResponse, type PerformancePolicy
} from '../lib/api/performance';
import { toast } from 'sonner';

export const PerformancePolicyView: React.FC = () => {
  const { boardId, boardCode } = useBoardRoute();

  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [submittingAck, setSubmittingAck] = useState(false);

  // Edit / Release new version modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getPerformancePolicy(boardCode || boardId);
        if (isMounted) {
          setPolicyData(data);
          setEditTitle(data.policy.title);
          setEditVersion(data.policy.version);
          setEditContent(data.policy.content);
        }
      } catch (err: any) {
        toast.error('Không thể tải nội quy đánh giá hiệu suất');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [boardId, boardCode]);

  // Handle acknowledge
  const handleAcknowledge = async () => {
    if (!agreeChecked) {
      toast.error('Vui lòng chọn xác nhận đã đọc và hiểu rõ nội quy.');
      return;
    }

    try {
      setSubmittingAck(true);
      const res = await acknowledgePerformancePolicy(boardCode || boardId);
      toast.success(res.message);
      setPolicyData(prev => prev ? {
        ...prev,
        is_acknowledged: true,
        acknowledged_at: res.acknowledged_at,
        total_acknowledged: prev.total_acknowledged + 1,
      } : null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xác nhận nội quy');
    } finally {
      setSubmittingAck(false);
    }
  };

  // Handle update policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle || !editVersion || !editContent) {
      toast.error('Vui lòng điền đầy đủ tiêu đề, phiên bản và nội dung.');
      return;
    }

    try {
      setSavingPolicy(true);
      const res = await updatePerformancePolicy(boardCode || boardId, {
        title: editTitle,
        version: editVersion,
        content: editContent,
      });
      toast.success(res.message);
      setShowEditModal(false);
      // Reload policy
      const refreshed = await getPerformancePolicy(boardCode || boardId);
      setPolicyData(refreshed);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật nội quy');
    } finally {
      setSavingPolicy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          Đang tải nội quy đánh giá hiệu suất...
        </div>
      </div>
    );
  }

  const policy = policyData?.policy;
  const isAcked = policyData?.is_acknowledged ?? false;
  const ackedAt = policyData?.acknowledged_at;
  const canManage = policyData?.can_manage ?? false;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-6">
      {/* Policy Header Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Phiên Bản {policy?.version}
            </span>
            {isAcked ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã Xác Nhận
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Chờ Xác Nhận
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {policy?.title}
          </h1>
          <p className="text-xs text-slate-400 flex items-center gap-4">
            <span>Cập nhật lần cuối: {new Date(policy?.updated_at || '').toLocaleDateString('vi-VN')}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              {policyData?.total_acknowledged} / {policyData?.total_members} thành viên đã xác nhận
            </span>
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-md hover:opacity-90 transition-all shrink-0 active:scale-95"
          >
            <Edit3 className="w-4 h-4" />
            Ban hành phiên bản mới
          </button>
        )}
      </div>

      {/* Main Policy Document */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-wrap font-sans text-sm md:text-base">
          {policy?.content}
        </div>
      </div>

      {/* Member Acknowledgment Card */}
      <div className={`rounded-2xl p-6 md:p-8 border shadow-sm transition-all ${
        isAcked 
          ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
          : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/60'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isAcked ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Bạn đã xác nhận nội quy đánh giá hiệu suất
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Xác nhận trách nhiệm và quyền lợi đánh giá hiệu suất
                </>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAcked ? (
                <span>
                  Đã ghi nhận chữ ký điện tử vào lúc{' '}
                  <strong className="text-emerald-700 dark:text-emerald-300">
                    {new Date(ackedAt || '').toLocaleString('vi-VN')}
                  </strong>{' '}
                  cho phiên bản <strong>{policy?.version}</strong>.
                </span>
              ) : (
                <span>
                  Tất cả thành viên trong bảng cần đọc và xác nhận đồng thuận nội quy trước khi kỳ đánh giá diễn ra.
                </span>
              )}
            </p>
          </div>

          {!isAcked && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                Tôi đã đọc, hiểu rõ và đồng thuận
              </label>

              <button
                onClick={handleAcknowledge}
                disabled={!agreeChecked || submittingAck}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {submittingAck ? 'Đang xác nhận...' : 'Xác nhận đã đọc nội quy'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EDIT / NEW VERSION MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Ban Hành / Chỉnh Sửa Nội Quy Hiệu Suất
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Tiêu đề nội quy
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Phiên bản
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="v1.1, v2.0..."
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nội dung điều khoản (Hỗ trợ Markdown)
                </label>
                <textarea
                  rows={14}
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {savingPolicy ? 'Đang lưu...' : 'Ban hành phiên bản này'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
