import React, { useState, useEffect } from 'react';
import { 
  FileText, CheckCircle2, Clock, AlertTriangle, Printer, Lock, Unlock, 
  Send, Edit3, Save, X, Star, DollarSign, TrendingUp, Users, ShieldAlert, 
  Paperclip, Plus, Trash2, Award, Check
} from 'lucide-react';
import { useBoardRoute } from '../components/layout/BoardRouteContext';
import { 
  getBoardReview, saveBoardReview, publishBoardReview, lockBoardReview, 
  unlockBoardReview, type BoardReviewResponse, type BoardReviewData 
} from '../lib/api/boardReview';
import { getAvatarUrl } from '../lib/avatar';
import { toast } from 'sonner';

export const BoardReviewView = () => {
  const { boardId, boardCode } = useBoardRoute();
  const [data, setData] = useState<BoardReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form draft state
  const [draft, setDraft] = useState<Partial<BoardReviewData>>({
    goals: '',
    summary: '',
    achievements: '',
    unfinished_work: '',
    issues: '',
    lessons_learned: '',
    revenue: '',
    cost: '',
    profit: '',
    overall_rating: 5,
    member_reviews: [],
    attachments: [],
  });

  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);

  const fetchReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBoardReview(boardCode || boardId);
      setData(res);
      if (res.review) {
        setDraft({
          goals: res.review.goals || '',
          summary: res.review.summary || '',
          achievements: res.review.achievements || '',
          unfinished_work: res.review.unfinished_work || '',
          issues: res.review.issues || '',
          lessons_learned: res.review.lessons_learned || '',
          revenue: res.review.revenue ?? '',
          cost: res.review.cost ?? '',
          profit: res.review.profit ?? '',
          overall_rating: res.review.overall_rating ?? 5,
          member_reviews: res.review.member_reviews || [],
          attachments: res.review.attachments || [],
        });
      } else {
        // Prepare initial empty draft
        setDraft(prev => ({
          ...prev,
          member_reviews: res.stats.members_stats.map(m => ({
            user_id: m.user_id,
            note: '',
            rating: 5,
          })),
        }));
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || 'Không thể tải bản tổng kết dự án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReview();
  }, [boardId, boardCode]);

  const handleSave = async (targetStatus?: 'draft' | 'published') => {
    setSaving(true);
    try {
      const payload: Partial<BoardReviewData> = {
        ...draft,
        revenue: draft.revenue === '' ? undefined : Number(draft.revenue),
        cost: draft.cost === '' ? undefined : Number(draft.cost),
        profit: draft.profit === '' ? undefined : Number(draft.profit),
      };

      if (targetStatus) {
        payload.status = targetStatus;
      }

      const res = await saveBoardReview(boardCode || boardId, payload);
      toast.success(res.message || 'Đã lưu bản tổng kết dự án thành công');
      setIsEditing(false);
      await fetchReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Lỗi khi lưu bản tổng kết');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Bạn có chắc chắn muốn công bố bản tổng kết này cho toàn bộ thành viên trong bảng không?')) return;
    try {
      const res = await publishBoardReview(boardCode || boardId);
      toast.success(res.message);
      setIsEditing(false);
      await fetchReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Lỗi khi công bố');
    }
  };

  const handleLock = async () => {
    if (!confirm('Khóa bản tổng kết sẽ ngăn chặn mọi chỉnh sửa tiếp theo cho đến khi mở khóa. Bạn có muốn tiếp tục?')) return;
    try {
      const res = await lockBoardReview(boardCode || boardId);
      toast.success(res.message);
      setIsEditing(false);
      await fetchReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Lỗi khi khóa');
    }
  };

  const handleUnlock = async () => {
    try {
      const res = await unlockBoardReview(boardCode || boardId);
      toast.success(res.message);
      await fetchReview();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Lỗi khi mở khóa');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) {
      toast.error('Vui lòng nhập tên tài liệu và liên kết hợp lệ.');
      return;
    }
    const current = draft.attachments || [];
    setDraft({
      ...draft,
      attachments: [
        ...current,
        { name: newAttachmentName.trim(), url: newAttachmentUrl.trim() }
      ]
    });
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setIsAddingAttachment(false);
  };

  const handleRemoveAttachment = (index: number) => {
    const current = [...(draft.attachments || [])];
    current.splice(index, 1);
    setDraft({ ...draft, attachments: current });
  };

  const updateMemberReview = (userId: number, field: 'note' | 'rating', value: any) => {
    const list = [...(draft.member_reviews || [])];
    const idx = list.findIndex(item => item.user_id === userId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], [field]: value };
    } else {
      list.push({ user_id: userId, note: field === 'note' ? value : '', rating: field === 'rating' ? value : 5 });
    }
    setDraft({ ...draft, member_reviews: list });
  };

  const getMemberReview = (userId: number) => {
    return draft.member_reviews?.find(item => item.user_id === userId) || { note: '', rating: 5 };
  };

  const formatCurrency = (val?: number | string | null) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Đang tải bản tổng kết dự án...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-600 flex items-center justify-center mb-4 border border-red-500/20">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Không thể xem bản tổng kết</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          {error || 'Bản tổng kết chưa được công bố hoặc bạn không có quyền xem.'}
        </p>
      </div>
    );
  }

  const { board, review, stats } = data;
  const isLocked = review?.status === 'locked';
  const isPublished = review?.status === 'published';
  const isDraft = !review || review.status === 'draft';
  const canManage = board.is_admin;

  return (
    <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-10 print:p-0 print:bg-white print:text-black">
      <div className="max-w-5xl mx-auto space-y-8 print:space-y-6">

        {/* Action Header (Hidden in Print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/80 print:hidden">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
                <FileText className="text-primary shrink-0" size={28} />
                Tổng kết dự án
              </h1>
              {isLocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Lock size={12} /> Đã khóa
                </span>
              ) : isPublished ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={12} /> Đã công bố
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Clock size={12} /> Bản nháp
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Bảng: <span className="font-semibold text-foreground">{board.name}</span>
              {review?.published_at && (
                <> • Công bố ngày {new Date(review.published_at).toLocaleDateString('vi-VN')}</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Print / Export PDF */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-card border border-border hover:bg-muted text-foreground transition-all shadow-xs cursor-pointer"
              title="In bản tổng kết hoặc xuất PDF"
            >
              <Printer size={16} /> In / Xuất PDF
            </button>

            {/* Admin Management Actions */}
            {canManage && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer"
                    >
                      <X size={16} /> Hủy
                    </button>
                    <button
                      onClick={() => handleSave('draft')}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu bản tổng kết'}
                    </button>
                  </>
                ) : (
                  <>
                    {!isLocked && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-card border border-border hover:bg-muted text-foreground transition-all shadow-xs cursor-pointer"
                      >
                        <Edit3 size={16} /> Chỉnh sửa
                      </button>
                    )}

                    {isDraft && (
                      <button
                        onClick={handlePublish}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                      >
                        <Send size={16} /> Công bố
                      </button>
                    )}

                    {isPublished && !isLocked && (
                      <button
                        onClick={handleLock}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-xs cursor-pointer"
                        title="Khóa báo cáo sau khi hoàn thiện"
                      >
                        <Lock size={16} /> Khóa
                      </button>
                    )}

                    {isLocked && (
                      <button
                        onClick={handleUnlock}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-xs cursor-pointer"
                        title="Mở khóa để tiếp tục chỉnh sửa"
                      >
                        <Unlock size={16} /> Mở khóa
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Formal Report Header for Print */}
        <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wider">BÁO CÁO TỔNG KẾT DỰ ÁN</h1>
          <h2 className="text-lg font-semibold mt-1">{board.name}</h2>
          <p className="text-xs text-gray-500 mt-1">
            Ngày xuất báo cáo: {new Date().toLocaleDateString('vi-VN')} {review?.publisher?.name ? `• Người công bố: ${review.publisher.name}` : ''}
          </p>
        </div>

        {/* 1. Automated Project Metrics (KPI Cards) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Award className="text-primary" size={20} />
              Số liệu công việc tổng quan
            </h2>
            <span className="text-xs text-muted-foreground font-medium">Tự động tổng hợp từ bảng Kanban</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Tổng công việc
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{stats.total_tasks}</div>
              <span className="text-xs text-muted-foreground mt-1 block">Toàn bộ thẻ nhiệm vụ</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                Đã hoàn thành
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {stats.completed_tasks}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">Tỉ lệ đạt {stats.completion_rate}%</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                Chưa hoàn thành
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {stats.incomplete_tasks}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">Đang dở dang / chờ duyệt</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block mb-1">
                Quá hạn
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                {stats.overdue_tasks}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">Trễ deadline cam kết</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 p-4 rounded-xl bg-card border border-border/80">
            <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-2">
              <span>Tiến độ hoàn thành dự án</span>
              <span className="text-primary font-bold">{stats.completion_rate}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, stats.completion_rate))}%` }}
              />
            </div>
          </div>
        </section>

        {/* 2. Financial Overview & Overall Rating */}
        <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="text-primary" size={20} />
              Hiệu quả tài chính & Đánh giá chung
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Doanh thu
              </label>
              {isEditing ? (
                <input
                  type="number"
                  placeholder="0"
                  value={draft.revenue}
                  onChange={e => {
                    const rev = e.target.value;
                    const c = draft.cost || 0;
                    setDraft({
                      ...draft,
                      revenue: rev,
                      profit: rev !== '' ? Number(rev) - Number(c) : draft.profit
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-semibold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <div className="text-xl font-bold text-foreground">
                  {formatCurrency(draft.revenue)}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Chi phí
              </label>
              {isEditing ? (
                <input
                  type="number"
                  placeholder="0"
                  value={draft.cost}
                  onChange={e => {
                    const c = e.target.value;
                    const rev = draft.revenue || 0;
                    setDraft({
                      ...draft,
                      cost: c,
                      profit: c !== '' ? Number(rev) - Number(c) : draft.profit
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground font-semibold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <div className="text-xl font-bold text-foreground">
                  {formatCurrency(draft.cost)}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Lợi nhuận ròng
              </label>
              {isEditing ? (
                <input
                  type="number"
                  placeholder="Tự động tính"
                  value={draft.profit}
                  onChange={e => setDraft({ ...draft, profit: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-emerald-600 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <div className={`text-xl font-bold ${Number(draft.profit) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCurrency(draft.profit)}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Đánh giá chung
              </label>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    disabled={!isEditing}
                    onClick={() => setDraft({ ...draft, overall_rating: star })}
                    className={`transition-transform ${isEditing ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}`}
                  >
                    <Star
                      size={20}
                      className={`${(draft.overall_rating || 0) >= star ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                    />
                  </button>
                ))}
                <span className="text-sm font-bold text-foreground ml-2">
                  {draft.overall_rating || 5}/5 sao
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Narrative Report Sections */}
        <section className="space-y-6">
          <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary" /> Mục tiêu dự án
            </h3>
            {isEditing ? (
              <textarea
                rows={3}
                placeholder="Nêu rõ các mục tiêu trọng tâm đã đề ra cho dự án..."
                value={draft.goals}
                onChange={e => setDraft({ ...draft, goals: e.target.value })}
                className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {draft.goals || <span className="text-muted-foreground italic">Chưa ghi nhận mục tiêu dự án.</span>}
              </p>
            )}
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <Award size={16} className="text-emerald-500" /> Kết quả đạt được
            </h3>
            {isEditing ? (
              <textarea
                rows={3}
                placeholder="Những cột mốc và thành tựu nổi bật nhất của dự án..."
                value={draft.achievements}
                onChange={e => setDraft({ ...draft, achievements: e.target.value })}
                className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {draft.achievements || <span className="text-muted-foreground italic">Chưa ghi nhận kết quả đạt được.</span>}
              </p>
            )}
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Tóm tắt & Đánh giá tổng quan
            </h3>
            {isEditing ? (
              <textarea
                rows={3}
                placeholder="Tóm tắt quá trình vận hành, mức độ hài lòng và kết quả chung..."
                value={draft.summary}
                onChange={e => setDraft({ ...draft, summary: e.target.value })}
                className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {draft.summary || <span className="text-muted-foreground italic">Chưa có tóm tắt tổng quan.</span>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Clock size={16} className="text-amber-500" /> Công việc chưa hoàn thành & Lý do
              </h3>
              {isEditing ? (
                <textarea
                  rows={4}
                  placeholder="Các hạng mục chưa hoàn thành, nguyên nhân và hướng chuyển tiếp..."
                  value={draft.unfinished_work}
                  onChange={e => setDraft({ ...draft, unfinished_work: e.target.value })}
                  className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {draft.unfinished_work || <span className="text-muted-foreground italic">Không có công việc tồn đọng.</span>}
                </p>
              )}
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500" /> Vấn đề phát sinh & Bài học
              </h3>
              {isEditing ? (
                <textarea
                  rows={4}
                  placeholder="Những rủi ro, sự cố phát sinh và bài học kinh nghiệm rút ra cho các dự án sau..."
                  value={draft.lessons_learned}
                  onChange={e => setDraft({ ...draft, lessons_learned: e.target.value })}
                  className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {draft.lessons_learned || <span className="text-muted-foreground italic">Chưa có bài học kinh nghiệm ghi nhận.</span>}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 4. Member Contributions Breakdown */}
        <section className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 sm:p-6 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="text-primary" size={20} />
                Đóng góp từng thành viên
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ghi nhận số lượng hoàn thành và đánh giá chuyên môn — <span className="text-amber-600 dark:text-amber-400 font-medium">Không dùng làm căn cứ chấm công</span>.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                <tr>
                  <th className="px-5 py-3.5">Thành viên</th>
                  <th className="px-4 py-3.5 text-center">Giao việc</th>
                  <th className="px-4 py-3.5 text-center">Đã xong</th>
                  <th className="px-4 py-3.5 text-center">Quá hạn</th>
                  <th className="px-4 py-3.5 text-center">Tỉ lệ</th>
                  <th className="px-5 py-3.5 min-w-[260px]">Nhận xét & Đóng góp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {stats.members_stats.map(m => {
                  const currentRev = getMemberReview(m.user_id);

                  return (
                    <tr key={m.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                            {m.avatar ? (
                              <img src={getAvatarUrl(m.avatar)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              m.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{m.name}</div>
                            <div className="text-xs text-muted-foreground">@{m.username} • {m.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-foreground">
                        {m.total_tasks}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {m.completed_tasks}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-rose-600 dark:text-rose-400">
                        {m.overdue_tasks}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                          {m.completion_rate}%
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Nhận xét đóng góp của thành viên..."
                              value={currentRev.note || ''}
                              onChange={e => updateMemberReview(m.user_id, 'note', e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:border-primary outline-none"
                            />
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => updateMemberReview(m.user_id, 'rating', s)}
                                  className="cursor-pointer"
                                >
                                  <Star
                                    size={14}
                                    className={`${(currentRev.rating || 5) >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-foreground italic mb-1">
                              {currentRev.note ? `"${currentRev.note}"` : <span className="text-muted-foreground">Chưa có nhận xét riêng.</span>}
                            </p>
                            {currentRev.rating && (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star
                                    key={s}
                                    size={12}
                                    className={`${(currentRev.rating || 5) >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Project Attachments */}
        <section className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Paperclip className="text-primary" size={20} />
              Tài liệu & Hồ sơ dự án
            </h2>
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsAddingAttachment(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Thêm tài liệu
              </button>
            )}
          </div>

          {isAddingAttachment && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Tên tài liệu (VD: Biên bản nghiệm thu dự án)"
                  value={newAttachmentName}
                  onChange={e => setNewAttachmentName(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground outline-none focus:border-primary"
                />
                <input
                  type="url"
                  placeholder="Đường dẫn liên kết (URL)"
                  value={newAttachmentUrl}
                  onChange={e => setNewAttachmentUrl(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAttachment(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90"
                >
                  Lưu tài liệu
                </button>
              </div>
            </div>
          )}

          {draft.attachments && draft.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {draft.attachments.map((att, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60 hover:bg-muted/40 transition-colors">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-xs font-semibold text-primary hover:underline truncate"
                  >
                    <Paperclip size={14} className="shrink-0" />
                    <span className="truncate">{att.name}</span>
                  </a>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Xóa tài liệu"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Chưa có tài liệu đính kèm nào.</p>
          )}
        </section>

        {/* 6. Formal Signatures Block for Print Mode */}
        <div className="hidden print:grid grid-cols-2 pt-12 mt-12 border-t border-black text-center text-xs">
          <div>
            <p className="font-bold uppercase mb-16">NGƯỜI LẬP BÁO CÁO</p>
            <p className="font-semibold">{review?.creator?.name || 'Chủ nhiệm dự án'}</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-16">CHỦ SỞ HỮU DỰ ÁN / QUẢN TRỊ</p>
            <p className="font-semibold">{review?.publisher?.name || 'Ban Quản trị Bảng'}</p>
          </div>
        </div>

      </div>
    </div>
  );
};
