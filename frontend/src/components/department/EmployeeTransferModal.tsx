import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Building2, AlertTriangle, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import { getDepartmentOptions, transferEmployeeDepartment, bulkTransferEmployees } from '../../lib/api/departments';
import type { DepartmentOption } from '../../lib/api/departments';
import { toast } from 'sonner';

interface EmployeeTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: User[];
  currentDepartmentId?: number | null;
  onSuccess: () => void;
}

export const EmployeeTransferModal: React.FC<EmployeeTransferModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentDepartmentId,
  onSuccess,
}) => {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [targetDeptId, setTargetDeptId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadOptions() {
      setLoading(true);
      try {
        const data = await getDepartmentOptions();
        if (isMounted) {
          setDepartments(data);
          // Set initial target to first different department if any
          const otherDepts = data.filter((d) => d.id !== currentDepartmentId);
          if (otherDepts.length > 0) {
            setTargetDeptId(String(otherDepts[0].id));
          } else {
            setTargetDeptId('unassigned');
          }
        }
      } catch (err) {
        console.error('Failed to load department options', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadOptions();
    return () => { isMounted = false; };
  }, [isOpen, currentDepartmentId]);

  if (!isOpen || employees.length === 0) return null;

  const handleTransfer = async () => {
    const newDeptId = targetDeptId === 'unassigned' ? null : Number(targetDeptId);

    if (newDeptId && currentDepartmentId && newDeptId === currentDepartmentId) {
      toast.error('Phòng ban đích phải khác phòng ban hiện tại');
      return;
    }

    setIsSubmitting(true);
    try {
      if (employees.length === 1) {
        const res = await transferEmployeeDepartment(employees[0].id, newDeptId);
        toast.success(res.message || 'Điều chuyển nhân viên thành công');
      } else {
        const userIds = employees.map((e) => e.id);
        const res = await bulkTransferEmployees(userIds, newDeptId);
        toast.success(res.message || `Đã điều chuyển ${employees.length} nhân viên`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi điều chuyển nhân viên');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {employees.length === 1 ? 'Điều chuyển nhân viên' : `Điều chuyển ${employees.length} nhân viên`}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Affected employees summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nhân viên được điều chuyển:
            </label>
            <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 custom-scrollbar bg-slate-50 dark:bg-slate-800/40">
              {employees.map((emp) => (
                <div key={emp.id} className="text-xs flex items-center justify-between py-0.5 px-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{emp.name}</span>
                  <span className="text-slate-400 font-mono text-[11px]">@{emp.username}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Target department dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-row items-center gap-1.5 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> Chọn phòng ban đích:
            </label>
            {loading ? (
              <div className="text-xs text-slate-400 animate-pulse py-2">Đang tải danh sách phòng ban...</div>
            ) : (
              <select
                value={targetDeptId}
                onChange={(e) => setTargetDeptId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="unassigned">-- Chưa phân phòng (Gỡ khỏi phòng ban) --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} disabled={currentDepartmentId === d.id}>
                    {d.name} ({d.code}) {currentDepartmentId === d.id ? '(Hiện tại)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Nhân viên sẽ nhận được thông báo về việc điều chuyển. Quyền truy cập vào các Bảng công việc hiện có của nhân viên không bị ảnh hưởng.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            onClick={handleTransfer}
            disabled={isSubmitting || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-md shadow-indigo-500/20"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Xác nhận điều chuyển</span>
          </button>
        </div>
      </div>
    </div>
  );
};
