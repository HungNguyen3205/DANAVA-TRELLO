import React, { useState, useEffect, useMemo } from 'react';
import { X, Building2, UserCheck, Palette, AlertCircle, Loader2, Search, Check } from 'lucide-react';
import type { Department, User } from '../../types';
import { createDepartment, updateDepartment } from '../../lib/api/departments';
import api from '../../lib/axios';
import { toast } from 'sonner';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department?: Department | null;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  department,
  onSuccess,
}) => {
  const isEdit = !!department;

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [managerId, setManagerId] = useState<number | null>(null);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);

  // System users for manager / employee pickers
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Initial values to check dirtiness
  const initialData = useMemo(() => {
    return {
      name: department?.name || '',
      code: department?.code || '',
      description: department?.description || '',
      color: department?.color || '#6366f1',
      managerId: department?.manager_id || null,
      status: department?.status || 'active',
      selectedEmployees: [],
    };
  }, [department]);

  useEffect(() => {
    if (department) {
      setName(department.name || '');
      setCode(department.code || '');
      setDescription(department.description || '');
      setColor(department.color || '#6366f1');
      setManagerId(department.manager_id || null);
      setStatus(department.status || 'active');
      setSelectedEmployees([]);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setColor('#6366f1');
      setManagerId(null);
      setStatus('active');
      setSelectedEmployees([]);
    }
    setErrors({});
  }, [department, isOpen]);

  // Load active employees list for selection
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function fetchUsers() {
      setLoadingUsers(true);
      try {
        const res = await api.get('/users/search?q=');
        if (isMounted) {
          // Exclude locked accounts
          const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          const activeOnly = list.filter((u: User) => u.account_status !== 'locked');
          setUsersList(activeOnly);
        }
      } catch (err) {
        console.error('Failed to load users for department', err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    }
    fetchUsers();
    return () => { isMounted = false; };
  }, [isOpen]);

  const isDirty = useMemo(() => {
    return (
      name !== initialData.name ||
      code !== initialData.code ||
      description !== initialData.description ||
      color !== initialData.color ||
      managerId !== initialData.managerId ||
      status !== initialData.status ||
      selectedEmployees.length > 0
    );
  }, [name, code, description, color, managerId, status, selectedEmployees, initialData]);

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng modal?')) {
        return;
      }
    }
    onClose();
  };

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) {
      errs.name = 'Tên phòng ban là bắt buộc';
    } else if (name.trim().length > 150) {
      errs.name = 'Tên phòng ban không được quá 150 ký tự';
    }

    if (!code.trim()) {
      errs.code = 'Mã phòng ban là bắt buộc';
    } else if (!/^[A-Za-z0-9_-]+$/.test(code.trim())) {
      errs.code = 'Mã chỉ bao gồm chữ cái, số, gạch dưới hoặc gạch nối';
    } else if (code.trim().length > 50) {
      errs.code = 'Mã không được quá 50 ký tự';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEdit && department) {
        const res = await updateDepartment(department.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          color,
          manager_id: managerId,
          status,
        });
        toast.success(res.message || 'Cập nhật phòng ban thành công');
      } else {
        const res = await createDepartment({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          color,
          manager_id: managerId,
          status,
          employee_ids: selectedEmployees,
        });
        toast.success(res.message || 'Tạo phòng ban thành công');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu phòng ban';
      toast.error(msg);
      if (err.response?.data?.errors) {
        const backendErrs: { [key: string]: string } = {};
        for (const [key, msgs] of Object.entries(err.response.data.errors)) {
          backendErrs[key] = (msgs as string[])[0];
        }
        setErrors(backendErrs);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return usersList;
    const term = searchUser.toLowerCase();
    return usersList.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term))
    );
  }, [usersList, searchUser]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEdit ? 'Chỉnh sửa phòng ban' : 'Tạo phòng ban mới'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit ? `Mã hiện tại: ${department.code}` : 'Thiết lập cơ cấu phòng ban và chỉ định trưởng phòng'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* Tên & Mã */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tên phòng ban <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Phòng Kỹ thuật & Công nghệ"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 border ${
                  errors.name ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                } focus:outline-none focus:ring-2`}
              />
              {errors.name && (
                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mã viết tắt <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: TECH"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase bg-white dark:bg-slate-800 border ${
                  errors.code ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                } focus:outline-none focus:ring-2`}
              />
              {errors.code && (
                <p className="text-xs text-rose-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.code}
                </p>
              )}
            </div>
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Mô tả nhiệm vụ & chức năng
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả chức năng, phạm vi phụ trách của phòng ban..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Màu nhận diện */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-slate-400" /> Màu nhận diện phòng ban
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center text-white ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-offset-slate-900 scale-110 shadow-sm' : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 stroke-[3]" />}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="text-xs font-mono text-slate-500">{color}</span>
              </div>
            </div>
          </div>

          {/* Trưởng phòng & Trạng thái */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Trưởng phòng */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-slate-400" /> Trưởng phòng ban
              </label>
              <select
                value={managerId || ''}
                onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Chưa chỉ định trưởng phòng --</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (@{u.username}) {u.position ? `- ${u.position}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Chỉ những nhân viên đang hoạt động mới được chọn làm trưởng phòng.
              </p>
            </div>

            {/* Trạng thái hoạt động */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Trạng thái hoạt động
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Đang hoạt động
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('inactive')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    status === 'inactive'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                      : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Ngừng hoạt động
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Phòng ban ngừng hoạt động sẽ không thể nhận thêm nhân viên.
              </p>
            </div>
          </div>

          {/* Chọn nhân viên ban đầu (chỉ khi tạo mới) */}
          {!isEdit && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Gán nhân viên ban đầu (tùy chọn)
                </label>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  Đã chọn {selectedEmployees.length} nhân viên
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm nhân viên để gán vào phòng..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 custom-scrollbar">
                {loadingUsers ? (
                  <div className="p-4 text-center text-xs text-slate-400">Đang tải nhân viên...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy nhân viên phù hợp</div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedEmployees.includes(Number(u.id));
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          const uid = Number(u.id);
                          setSelectedEmployees((prev) =>
                            isSelected ? prev.filter((id) => id !== uid) : [...prev, uid]
                          );
                        }}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300">
                            {u.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{u.name}</span>
                            <span className="text-slate-400 ml-1.5 font-mono">@{u.username}</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/20"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isEdit ? 'Lưu thay đổi' : 'Tạo phòng ban'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
