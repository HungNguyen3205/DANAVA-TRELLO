import React, { useState } from 'react';
import { 
  X, Trash2, Check, AlignLeft, CheckSquare, 
  MessageSquare, UserPlus, Tag, Paperclip, 
  CalendarDays, CreditCard, Clock, Send, Eye
} from 'lucide-react';
import type { Task, Board } from '../../types';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'sonner';

interface TaskDetailModalProps {
  task: Task;
  board: Board;
  onClose: () => void;
}

export function TaskDetailModal({ task, board, onClose }: TaskDetailModalProps) {
  const currentUser = useAuthStore(state => state.user);
  const [draft, setDraft] = useState<Task>(structuredClone(task));
  const [isEditingDesc, setIsEditingDesc] = useState(!task.description);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);
  const [isLabelsVisible, setIsLabelsVisible] = useState(false);
  const [isMembersVisible, setIsMembersVisible] = useState(false);
  const [isDatesVisible, setIsDatesVisible] = useState(false);
  
  // Label states
  const [labelSearch, setLabelSearch] = useState("");
  const [editingLabel, setEditingLabel] = useState<any>(null);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [labelDraftName, setLabelDraftName] = useState("");
  const [labelDraftColor, setLabelDraftColor] = useState("");

  const update = (value: Partial<Task>) => {
    setDraft(d => ({ ...d, ...value }));
  };

  const save = async (immediateUpdate?: Partial<Task>) => {
    setBusy(true);
    const payload = immediateUpdate ? { ...draft, ...immediateUpdate } : draft;
    try {
      await api.put(`/tasks/${task.id}`, {
        title: payload.title,
        description: payload.description,
        column_id: payload.columnId,
        priority: payload.priority,
        assignee_id: payload.assigneeId,
        due_date: payload.dueDate
      });
      // Do not close the modal here, so user can continue editing.
      // BoardView will refresh the board when the modal is finally closed.
      toast.success('Đã lưu thay đổi');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Có lỗi xảy ra khi lưu');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success('Đã xóa công việc');
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể xóa công việc');
    } finally {
      setBusy(false);
    }
  };
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { content: newComment });
      update({ comments: [res.data, ...draft.comments] });
      setNewComment("");
      toast.success('Đã gửi bình luận');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể gửi bình luận');
    } finally {
      setBusy(false);
    }
  };

  const currentColumn = board.columns.find(c => c.id === draft.columnId);
  const assignedUser = board.users?.find(u => u.id === draft.assigneeId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200 overflow-y-auto py-6 px-3 md:py-10 md:px-4" onClick={onClose}>
      <div 
        className="w-full max-w-5xl bg-card rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-border flex flex-col relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <header className="px-6 lg:px-8 pt-8 pb-5 flex items-start justify-between bg-card shrink-0 border-b border-border/50">
          <div className="flex gap-4 items-start w-full pr-14">
            <CreditCard className="text-muted-foreground mt-1.5 shrink-0" size={24} />
            <div className="w-full">
              <div className="flex items-center text-[13px] text-muted-foreground font-medium mb-1.5 gap-2">
                <span>Workspace</span>
                <span className="text-border text-xs">/</span>
                <span>{board.title}</span>
                <span className="text-border text-xs">/</span>
                <span className="text-foreground underline decoration-muted-foreground/30 underline-offset-4">{currentColumn?.title}</span>
              </div>
              <input 
                className="w-full text-[22px] font-bold text-foreground bg-transparent border border-transparent hover:border-border focus:bg-input focus:border-primary focus:ring-1 focus:ring-primary/50 px-3 py-1.5 -ml-3 rounded-md transition-colors leading-tight"
                value={draft.title} 
                onChange={e => update({ title: e.target.value })}
                onBlur={() => save()}
              />
            </div>
          </div>
          <button 
            onClick={onClose} 
            title="Đóng"
            className="absolute right-5 top-5 flex items-center justify-center w-10 h-10 text-muted-foreground hover:bg-accent hover:text-foreground rounded-full transition-colors z-10"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex flex-col md:flex-row bg-card">
          {/* Main Content Area (Left) */}
          <div className="flex-1 p-6 lg:p-8 border-r border-border min-h-[500px]">
            
            {/* Metadata row (if labels/members exist) */}
            {(draft.labels.length > 0 || draft.assigneeId) && (
              <div className="flex flex-wrap gap-8 mb-8 ml-10">
                {draft.assigneeId && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Thành viên</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm overflow-hidden">
                        {assignedUser?.avatar ? (
                          <img src={assignedUser.avatar.startsWith('http') ? assignedUser.avatar : `http://localhost:8000${assignedUser.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          assignedUser?.initials || draft.assigneeId.charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {draft.labels.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nhãn</h3>
                    <div className="flex flex-wrap gap-2">
                      {draft.labels.map(l => (
                        <span 
                          key={l.id} 
                          className="px-3 py-1 text-white text-sm font-semibold rounded shadow-sm"
                          style={{ backgroundColor: l.color }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="flex gap-4 items-start mb-10">
              <AlignLeft className="text-muted-foreground shrink-0 mt-1" size={24} />
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-foreground">Mô tả</h3>
                  {!isEditingDesc && (
                    <button 
                      onClick={() => setIsEditingDesc(true)}
                      className="px-3 py-1.5 bg-accent/50 hover:bg-accent text-sm font-medium rounded-md transition-colors"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                </div>
                
                {isEditingDesc ? (
                  <div className="space-y-3">
                    <textarea 
                      rows={5}
                      placeholder="Thêm mô tả chi tiết hơn..."
                      className="w-full p-3 rounded-lg bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm resize-y"
                      value={draft.description} 
                      onChange={e => update({ description: e.target.value })}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsEditingDesc(false); save(); }}
                        className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors"
                      >
                        Lưu
                      </button>
                      <button 
                        onClick={() => setIsEditingDesc(false)}
                        className="px-4 py-1.5 hover:bg-accent text-muted-foreground text-sm font-medium rounded-md transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditingDesc(true)}
                    className="p-4 bg-accent/30 hover:bg-accent/50 border border-transparent rounded-lg text-sm cursor-pointer min-h-[60px] transition-colors"
                  >
                    {draft.description ? (
                      <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                        {draft.description}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Thêm mô tả chi tiết hơn...</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Checklists */}
            {draft.checklists?.map((checklist) => (
              <div key={checklist.id} className="flex gap-4 items-start mb-10 group/checklist">
                <CheckSquare className="text-muted-foreground shrink-0 mt-1" size={24} />
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-foreground">{checklist.title}</h3>
                    <button 
                      onClick={async () => {
                        try {
                          await api.delete(`/checklists/${checklist.id}`);
                          update({ checklists: draft.checklists.filter(c => c.id !== checklist.id) });
                          toast.success('Đã xóa danh sách');
                        } catch(e) {
                          toast.error('Lỗi khi xóa');
                        }
                      }}
                      className="px-3 py-1.5 bg-accent/50 hover:bg-accent text-sm font-medium rounded-md transition-colors opacity-0 group-hover/checklist:opacity-100"
                    >
                      Xóa
                    </button>
                  </div>
                  
                  {/* Progress Bar */}
                  {checklist.items.length > 0 && (
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold text-muted-foreground w-8">
                        {Math.round((checklist.items.filter(i => i.done).length / checklist.items.length) * 100)}%
                      </span>
                      <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${(checklist.items.filter(i => i.done).length / checklist.items.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-2 mb-3">
                    {checklist.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 group/item">
                        <input 
                          type="checkbox" 
                          className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                          checked={item.done}
                          onChange={async (e) => {
                            const isDone = e.target.checked;
                            // Optimistic update
                            const updatedChecklists = draft.checklists.map(c => 
                              c.id === checklist.id 
                                ? { ...c, items: c.items.map(i => i.id === item.id ? { ...i, done: isDone } : i) }
                                : c
                            );
                            update({ checklists: updatedChecklists });
                            try {
                              await api.put(`/checklist-items/${item.id}`, { is_completed: isDone });
                            } catch (err) {
                              toast.error('Không thể cập nhật mục này');
                              // Revert
                              update({ checklists: draft.checklists });
                            }
                          }}
                        />
                        <div className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.text}
                        </div>
                        <button 
                          onClick={async () => {
                            try {
                              await api.delete(`/checklist-items/${item.id}`);
                              const updatedChecklists = draft.checklists.map(c => 
                                c.id === checklist.id 
                                  ? { ...c, items: c.items.filter(i => i.id !== item.id) }
                                  : c
                              );
                              update({ checklists: updatedChecklists });
                            } catch(e) {
                              toast.error('Lỗi khi xóa mục');
                            }
                          }}
                          className="text-muted-foreground hover:text-red-400 opacity-0 group-hover/item:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('newItem') as HTMLInputElement;
                    const val = input.value.trim();
                    if (!val) return;
                    input.value = '';
                    
                    try {
                      const res = await api.post(`/checklists/${checklist.id}/items`, { content: val });
                      const newItem = { id: String(res.data.id), text: res.data.content, done: !!res.data.is_completed };
                      const updatedChecklists = draft.checklists.map(c => 
                        c.id === checklist.id ? { ...c, items: [...c.items, newItem] } : c
                      );
                      update({ checklists: updatedChecklists });
                    } catch (err) {
                      toast.error('Không thể thêm mục mới');
                    }
                  }}>
                    <input 
                      name="newItem"
                      type="text" 
                      placeholder="Thêm một mục..."
                      className="w-full bg-accent/30 border border-transparent hover:border-border/50 focus:border-primary/50 focus:bg-background rounded-md px-3 py-2 text-sm transition-colors outline-none"
                    />
                  </form>
                </div>
              </div>
            ))}

            {isChecklistVisible && (
              <div className="flex gap-4 items-start mb-10">
                <CheckSquare className="text-muted-foreground shrink-0 mt-1" size={24} />
                <div className="w-full">
                  <h3 className="text-lg font-bold text-foreground mb-3">Thêm danh sách công việc</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('newChecklist') as HTMLInputElement;
                    const val = input.value.trim();
                    if (!val) {
                      setIsChecklistVisible(false);
                      return;
                    }
                    try {
                      const res = await api.post(`/tasks/${task.id}/checklists`, { title: val });
                      const newChecklist = { id: String(res.data.id), title: res.data.title, items: [] };
                      update({ checklists: [...(draft.checklists || []), newChecklist] });
                      setIsChecklistVisible(false);
                    } catch (err) {
                      toast.error('Không thể tạo danh sách mới');
                    }
                  }}>
                    <input 
                      name="newChecklist"
                      type="text" 
                      placeholder="Nhập tên danh sách... (VD: Việc cần làm)"
                      autoFocus
                      className="w-full bg-background border border-input focus:border-primary/50 focus:ring-2 focus:ring-primary/50 rounded-md px-3 py-2 text-sm transition-colors outline-none mb-2"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors">
                        Thêm
                      </button>
                      <button type="button" onClick={() => setIsChecklistVisible(false)} className="px-3 py-1.5 hover:bg-accent text-muted-foreground text-sm font-medium rounded-md transition-colors">
                        Hủy
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Attachments */}
            {draft.attachments && draft.attachments.length > 0 && (
              <div className="flex gap-4 items-start mb-10">
                <Paperclip className="text-muted-foreground shrink-0 mt-1" size={24} />
                <div className="w-full">
                  <h3 className="text-lg font-bold text-foreground mb-3">Đính kèm</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {draft.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 p-3 bg-accent/30 hover:bg-accent/50 rounded-lg group/att transition-colors">
                        <div className="w-10 h-10 shrink-0 bg-accent rounded flex items-center justify-center text-muted-foreground font-bold text-xs uppercase">
                          {att.fileName.split('.').pop()?.substring(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{att.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(att.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <a href={`http://localhost:8000/storage/${att.filePath}`} target="_blank" rel="noreferrer" className="p-2 hover:bg-accent rounded text-muted-foreground transition-colors">
                          Mở
                        </a>
                        <button 
                          onClick={async () => {
                            try {
                              await api.delete(`/attachments/${att.id}`);
                              update({ attachments: draft.attachments.filter(a => a.id !== att.id) });
                            } catch(e) {}
                          }}
                          className="p-2 hover:bg-accent rounded text-red-400 opacity-0 group-hover/att:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity / Comments */}
            <div className="flex gap-4 items-start">
              <MessageSquare className="text-muted-foreground shrink-0 mt-1" size={24} />
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">Hoạt động</h3>
                </div>
                
                <div className="flex gap-3 mb-8">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                    {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 relative">
                    <textarea 
                      rows={1}
                      placeholder="Viết bình luận..."
                      className="w-full p-3 pr-10 rounded-lg bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm resize-none shadow-sm min-h-[44px]"
                      value={newComment} 
                      onChange={e => setNewComment(e.target.value)}
                    />
                    <button 
                      className="absolute right-2 bottom-2 p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
                      onClick={handleAddComment}
                      disabled={busy || !newComment.trim()}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {draft.comments.length > 0 ? (
                    draft.comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground text-xs font-bold shrink-0">
                          U
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-bold text-sm text-foreground">{c.user?.name || 'Người dùng'}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.created_at ? new Date(c.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                            </span>
                          </div>
                          <div className="bg-card border border-border/50 p-3 rounded-lg rounded-tl-none text-sm shadow-sm">
                            {c.content}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <button className="hover:underline">Chỉnh sửa</button>
                            <button className="hover:underline">Xóa</button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg bg-card/20">
                      Chưa có bình luận nào
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Sidebar Area (Right) */}
          <aside className="w-full md:w-[32%] lg:w-[30%] p-6 lg:p-8 bg-muted/20 shrink-0 flex flex-col gap-8 border-l border-border/50">
            
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Trạng thái</h4>
              <select 
                className="w-full p-2.5 rounded-xl bg-card border border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary text-[13px] text-foreground font-semibold shadow-sm transition-all outline-none cursor-pointer" 
                value={draft.columnId} 
                onChange={e => { 
                  update({ columnId: e.target.value }); 
                  save({ columnId: e.target.value }); 
                }}
              >
                {board.columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Thêm vào thẻ</h4>
              <div className="space-y-2">
                <SidebarButton icon={<UserPlus size={16} />} label="Thành viên" onClick={() => setIsMembersVisible(!isMembersVisible)} />
                <SidebarButton icon={<Tag size={16} />} label="Nhãn" onClick={() => setIsLabelsVisible(!isLabelsVisible)} />
                <SidebarButton icon={<CheckSquare size={16} />} label="Việc cần làm" onClick={() => setIsChecklistVisible(true)} />
                <SidebarButton icon={<CalendarDays size={16} />} label="Ngày" onClick={() => setIsDatesVisible(!isDatesVisible)} />
                <label className="w-full">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await api.post(`/tasks/${task.id}/attachments`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        const newAtt = {
                          id: String(res.data.id),
                          fileName: res.data.file_name,
                          filePath: res.data.file_path,
                          mimeType: res.data.mime_type,
                          size: res.data.size,
                          userId: String(res.data.user_id),
                          createdAt: res.data.created_at
                        };
                        update({ attachments: [newAtt, ...(draft.attachments || [])] });
                        toast.success('Đã tải tệp lên');
                      } catch(err) {
                        toast.error('Lỗi khi tải tệp lên');
                      }
                    }}
                  />
                  <div className="w-full flex items-center gap-3 px-3 py-2 bg-card hover:bg-accent text-foreground/90 rounded-xl font-semibold text-[13px] transition-all text-left border border-border/80 shadow-sm hover:shadow hover:-translate-y-px cursor-pointer">
                    <span className="text-muted-foreground"><Paperclip size={16} /></span>
                    <span>Đính kèm</span>
                  </div>
                </label>
              </div>

              {isDatesVisible && (
                <div className="mt-2 p-3 bg-card border border-border/50 rounded shadow-lg animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex justify-between items-center">
                    Ngày
                    <button onClick={() => setIsDatesVisible(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Ngày bắt đầu</label>
                      <input
                        type="date"
                        value={draft.startDate?.split(' ')[0] || ''}
                        onChange={(e) => update({ startDate: e.target.value })}
                        className="w-full bg-background border border-input rounded py-1.5 px-2 text-sm text-foreground focus:border-primary/50 outline-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Hạn hoàn thành</label>
                      <input
                        type="date"
                        value={draft.dueDate?.split(' ')[0] || ''}
                        onChange={(e) => update({ dueDate: e.target.value })}
                        className="w-full bg-background border border-input rounded py-1.5 px-2 text-sm text-foreground focus:border-primary/50 outline-none cursor-pointer"
                      />
                    </div>
                    <button 
                      onClick={() => { setIsDatesVisible(false); save(); }}
                      className="w-full mt-2 bg-primary text-white text-xs font-semibold py-2 rounded hover:bg-orange-600 transition-colors"
                    >
                      Lưu Ngày
                    </button>
                  </div>
                </div>
              )}

              {isMembersVisible && (
                <div className="mt-2 p-3 bg-card border border-border/50 rounded shadow-lg animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold text-foreground mb-2 flex justify-between items-center">
                    Thành viên
                    <button onClick={() => setIsMembersVisible(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {board?.users?.map(user => {
                      const isAssignee = draft.assigneeId === user.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            const newAssignee = isAssignee ? '' : user.id;
                            update({ assigneeId: newAssignee });
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-[13px] font-medium text-foreground hover:bg-accent flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                              {user.avatar ? (
                                <img src={user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                user.initials
                              )}
                            </span>
                            <span className="truncate">{user.name}</span>
                          </div>
                          {isAssignee && <Check size={14} className="text-primary shrink-0" />}
                        </button>
                      );
                    })}
                    {(!board?.users || board.users.length === 0) && (
                      <p className="text-xs text-muted-foreground">Không có thành viên nào.</p>
                    )}
                  </div>
                </div>
              )}

              {isLabelsVisible && (
                <div className="mt-2 p-3 bg-card border border-border/50 rounded shadow-lg animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex justify-between items-center">
                    Nhãn
                    <button onClick={() => {
                      setIsLabelsVisible(false);
                      setIsCreatingLabel(false);
                      setEditingLabel(null);
                    }} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </h4>

                  {isCreatingLabel || editingLabel ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          {editingLabel ? 'Chỉnh sửa nhãn' : 'Tạo nhãn mới'}
                        </label>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Tên nhãn..."
                          value={labelDraftName}
                          onChange={e => setLabelDraftName(e.target.value)}
                          className="w-full bg-background border border-input rounded py-1.5 px-2 text-sm text-foreground focus:border-primary/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Màu sắc</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#64748b'].map(color => (
                            <button
                              key={color}
                              onClick={() => setLabelDraftColor(color)}
                              className={`w-7 h-7 rounded flex items-center justify-center transition-transform hover:scale-110 ${labelDraftColor === color ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''}`}
                              style={{ backgroundColor: color }}
                            >
                              {labelDraftColor === color && <Check size={14} className="text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={async () => {
                            if (!labelDraftName.trim() || !labelDraftColor) return;
                            setBusy(true);
                            try {
                              if (editingLabel) {
                                const res = await api.put(`/labels/${editingLabel.id}`, { name: labelDraftName, color: labelDraftColor });
                                // Update board labels locally (not fully persistent across refresh unless boardStore is updated, but good enough for this view)
                                const updatedLabels = board.labels?.map(l => l.id === editingLabel.id ? res.data : l) || [];
                                board.labels = updatedLabels;
                                // Update draft tasks
                                update({ labels: draft.labels.map(l => l.id === editingLabel.id ? res.data : l) });
                                setEditingLabel(null);
                                toast.success('Đã cập nhật nhãn');
                              } else {
                                const res = await api.post(`/boards/${board.id}/labels`, { name: labelDraftName, color: labelDraftColor });
                                board.labels = [...(board.labels || []), res.data];
                                setIsCreatingLabel(false);
                                toast.success('Đã tạo nhãn');
                              }
                            } catch (e: any) {
                              toast.error(e.response?.data?.message || 'Có lỗi xảy ra');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          className="flex-1 bg-primary text-white text-xs font-semibold py-2 rounded hover:bg-orange-600 transition-colors"
                        >
                          Lưu
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingLabel(false);
                            setEditingLabel(null);
                          }}
                          className="px-3 py-2 bg-accent hover:bg-border text-foreground text-xs font-semibold rounded transition-colors"
                        >
                          Hủy
                        </button>
                      </div>
                      {editingLabel && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Bạn có chắc chắn muốn xóa nhãn "${editingLabel.name}"? Nhãn sẽ bị gỡ khỏi tất cả nhiệm vụ đang dùng.`)) return;
                            setBusy(true);
                            try {
                              await api.delete(`/labels/${editingLabel.id}`);
                              board.labels = board.labels?.filter(l => l.id !== editingLabel.id);
                              update({ labels: draft.labels.filter(l => l.id !== editingLabel.id) });
                              setEditingLabel(null);
                              toast.success('Đã xóa nhãn');
                            } catch (e: any) {
                              toast.error('Lỗi khi xóa nhãn');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          className="w-full mt-2 bg-red-500/10 text-red-500 text-xs font-semibold py-2 rounded hover:bg-red-500 hover:text-white transition-colors"
                        >
                          Xóa nhãn
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        placeholder="Tìm nhãn..." 
                        className="w-full mb-3 bg-background border border-input rounded py-1.5 px-2 text-sm text-foreground focus:border-primary/50 outline-none"
                        value={labelSearch}
                        onChange={e => setLabelSearch(e.target.value)}
                      />
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {board?.labels?.filter(l => l.name.toLowerCase().includes(labelSearch.toLowerCase())).map(label => {
                          const isSelected = draft.labels.some(l => String(l.id) === String(label.id));
                          return (
                            <div key={label.id} className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  const newLabels = isSelected 
                                    ? draft.labels.filter(l => String(l.id) !== String(label.id)) 
                                    : [...draft.labels, label];
                                  update({ labels: newLabels });
                                  try {
                                    await api.post(`/tasks/${task.id}/labels`, { label_ids: newLabels.map(l => l.id) });
                                  } catch(e) {
                                    update({ labels: draft.labels }); // revert
                                    toast.error('Lỗi khi gắn nhãn');
                                  }
                                }}
                                className="flex-1 text-left px-2 py-1.5 rounded text-[13px] font-semibold text-white flex items-center justify-between transition-opacity hover:opacity-80"
                                style={{ backgroundColor: label.color }}
                              >
                                <span className="truncate pr-2">{label.name}</span>
                                {isSelected && <CheckSquare size={14} className="shrink-0 text-white" />}
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingLabel(label);
                                  setLabelDraftName(label.name);
                                  setLabelDraftColor(label.color);
                                }}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                        {(!board?.labels || board.labels.length === 0) && (
                          <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground mb-2">Bảng này chưa có nhãn nào.</p>
                            <button
                              onClick={() => {
                                setIsCreatingLabel(true);
                                setLabelDraftName("");
                                setLabelDraftColor("#3b82f6");
                              }}
                              className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded hover:bg-primary/20 transition-colors"
                            >
                              Tạo nhãn đầu tiên
                            </button>
                          </div>
                        )}
                      </div>
                      {board?.labels && board.labels.length > 0 && (
                        <button
                          onClick={() => {
                            setIsCreatingLabel(true);
                            setLabelDraftName("");
                            setLabelDraftColor("#3b82f6");
                          }}
                          className="w-full mt-3 py-1.5 bg-accent text-foreground text-xs font-semibold rounded hover:bg-border transition-colors"
                        >
                          Tạo nhãn mới
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chi tiết</h4>
              
              <div className="space-y-4">
                <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
                  Mức ưu tiên
                  <select 
                    className="w-full p-2.5 rounded bg-accent border border-border/50 focus:ring-2 focus:ring-primary/50 text-sm font-semibold transition-colors" 
                    value={draft.priority} 
                    onChange={e => { 
                      const val = e.target.value as Task['priority'];
                      update({ priority: val }); 
                      save({ priority: val }); 
                    }}
                  >
                    {["Thấp", "Bình thường", "Cao", "Khẩn cấp"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium text-foreground/80">
                  Hạn hoàn thành
                  <input 
                    id="dueDateInput"
                    type="date" 
                    className="w-full p-2.5 rounded bg-accent border border-border/50 focus:ring-2 focus:ring-primary/50 text-sm font-semibold transition-colors" 
                    value={draft.dueDate} 
                    onChange={e => { 
                      update({ dueDate: e.target.value }); 
                      save({ dueDate: e.target.value }); 
                    }} 
                  />
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Hành động</h4>
              <div className="space-y-2">
                <button 
                  onClick={() => setConfirmDelete(true)} 
                  disabled={busy} 
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-medium text-[13px] transition-all text-left border border-red-500/20 group"
                >
                  <Trash2 size={16} className="text-red-400 group-hover:text-white transition-colors" /> Xóa công việc
                </button>
              </div>
            </div>

          </aside>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/70 backdrop-blur-[2px] animate-in fade-in duration-200 p-4">
          <div className="w-full max-w-sm bg-popover rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-border">
            <h3 className="text-lg font-bold mb-2 text-foreground">Xóa công việc?</h3>
            <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">Công việc này sẽ bị xóa vĩnh viễn khỏi bảng và không thể khôi phục.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 hover:bg-accent text-foreground font-medium rounded-lg text-sm transition-colors border border-transparent hover:border-border">Hủy</button>
              <button onClick={remove} disabled={busy} className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg text-sm hover:bg-red-600 transition-colors shadow-sm">Xóa vĩnh viễn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 bg-card hover:bg-accent text-foreground/90 rounded-xl font-semibold text-[13px] transition-all text-left border border-border/80 shadow-sm hover:shadow hover:-translate-y-px"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
