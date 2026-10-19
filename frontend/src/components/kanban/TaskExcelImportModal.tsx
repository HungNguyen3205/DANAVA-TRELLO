import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, 
  X, RefreshCw, FileText, Users, ArrowRight, ShieldCheck, ChevronRight,
  Info, AlertCircle, ArrowLeft, ExternalLink, CornerDownRight
} from 'lucide-react';
import { 
  downloadImportTemplate, previewTaskImport, confirmTaskImport, downloadImportErrors,
  type ImportPreviewResponse, type PreviewRow 
} from '../../lib/api/taskExcelImport';
import { toast } from 'sonner';

interface TaskExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardCode?: string;
  onImportSuccess?: () => void;
}

export const TaskExcelImportModal: React.FC<TaskExcelImportModalProps> = ({
  isOpen,
  onClose,
  boardId,
  boardCode,
  onImportSuccess,
}) => {
  const targetId = boardCode || boardId;

  // Step state: 1 = upload, 2 = preview & confirm
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Loading states
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloadingErrors, setDownloadingErrors] = useState(false);

  // Preview data
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle template download
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      await downloadImportTemplate(targetId);
      toast.success('Đã tải xuống file mẫu DANAVA_WORK_TASK_IMPORT_TEMPLATE.xlsx');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tải file mẫu. Vui lòng thử lại.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Chỉ chấp nhận tệp định dạng Excel .xlsx');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dung lượng tệp vượt quá 10MB.');
      return;
    }
    setSelectedFile(file);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Submit file for validation
  const handleUploadAndPreview = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn tệp .xlsx trước khi kiểm tra.');
      return;
    }

    try {
      setValidating(true);
      const res = await previewTaskImport(targetId, selectedFile);
      setPreviewData(res);
      setStep(2);
      if (res.is_valid) {
        toast.success(`Kiểm tra hoàn tất: ${res.valid_rows_count} dòng hợp lệ.`);
      } else {
        toast.warning(`Phát hiện ${res.invalid_rows_count} dòng lỗi cần chỉnh sửa.`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Lỗi khi kiểm tra tệp Excel.';
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  };

  // Confirm and persist import
  const handleConfirmImport = async () => {
    if (!previewData || !previewData.preview_token) return;

    try {
      setConfirming(true);
      const res = await confirmTaskImport(targetId, previewData.preview_token);
      toast.success(res.message);
      if (onImportSuccess) {
        onImportSuccess();
      }
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo dữ liệu công việc.');
    } finally {
      setConfirming(false);
    }
  };

  // Download error report
  const handleDownloadErrors = async () => {
    if (!previewData?.preview_token) return;
    try {
      setDownloadingErrors(true);
      await downloadImportErrors(targetId, previewData.preview_token);
      toast.success('Đã tải xuống file báo cáo lỗi chi tiết.');
    } catch (err: any) {
      toast.error('Không thể tải báo cáo lỗi.');
    } finally {
      setDownloadingErrors(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    onClose();
  };

  // Filter preview rows
  const filteredRows = (previewData?.rows || []).filter((r: PreviewRow) => {
    if (activeFilter === 'valid') return r.is_valid;
    if (activeFilter === 'invalid') return !r.is_valid;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Nhập Công Việc Từ Excel
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {step === 1 ? 'Bước 1: Chọn tệp & Tải mẫu' : 'Bước 2: Xem trước & Xác nhận'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tuân thủ nguyên tắc an toàn nguyên tử: Kiểm tra tính hợp lệ trước khi ghi dữ liệu.
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: UPLOAD & DOWNLOAD TEMPLATE */}
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Banner: Template Download */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    File mẫu Excel chuẩn đã sẵn sàng với dữ liệu bảng này
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    File mẫu bao gồm 6 sheet: <strong>HUONG_DAN</strong>, <strong>TASKS</strong>, <strong>THANH_VIEN</strong> (thành viên hiện có), <strong>COT_KANBAN</strong>, <strong>NHAN</strong> và <strong>VI_DU</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all shrink-0 disabled:opacity-50 active:scale-95"
                >
                  {downloadingTemplate ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Tải file mẫu Excel
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/5 scale-[0.99]'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-900/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedFile ? selectedFile.name : 'Nhấp để chọn tệp hoặc kéo thả tệp .xlsx vào đây'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Chỉ hỗ trợ định dạng Microsoft Excel (.xlsx) • Dung lượng tối đa 10MB • Tối đa 2.000 dòng
                    </p>
                  </div>

                  {selectedFile && (
                    <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" />
                      Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>

              {/* Safety Rules Highlight Box */}
              <div className="rounded-2xl p-5 bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Quy tắc an toàn & kiểm soát dữ liệu
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span><strong>Không thêm người ngoài:</strong> Chỉ được gán username thành viên đã tham gia Board này.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span><strong>Task cha / Task con:</strong> Hỗ trợ task con trỏ tới external_key của task cha. Không tạo Task cháu.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span><strong>Tỷ lệ đóng góp:</strong> Tổng tỷ lệ phần trăm giữa các assignee phải bằng 100% (để trống tự chia đều).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span><strong>Nguyên tắc nguyên tử:</strong> Một dòng bị lỗi thì toàn bộ file sẽ bị từ chối cho đến khi được sửa.</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: PREVIEW & CONFIRM */}
          {step === 2 && previewData && (
            <div className="space-y-6">
              
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng số dòng</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {previewData.total_rows} dòng
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-500/20">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Dòng hợp lệ</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {previewData.valid_rows_count} dòng
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  previewData.invalid_rows_count > 0 
                    ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-500/30' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    previewData.invalid_rows_count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                  }`}>
                    Dòng bị lỗi
                  </span>
                  <div className={`text-2xl font-black mt-1 ${
                    previewData.invalid_rows_count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {previewData.invalid_rows_count} dòng
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              {previewData.is_valid ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        Tất cả các dòng đều hợp lệ!
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Dữ liệu đã được kiểm tra an toàn. Hãy bấm nút "Xác nhận Import" bên dưới để hoàn tất đưa dữ liệu vào bảng.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">
                        Phát hiện {previewData.invalid_rows_count} dòng dữ liệu không hợp lệ
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Theo quy định an toàn nguyên tử, toàn bộ tệp sẽ không được import nếu còn dòng lỗi. Bạn có thể tải file báo cáo lỗi để chỉnh sửa.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    disabled={downloadingErrors}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all shrink-0 active:scale-95"
                  >
                    {downloadingErrors ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Tải file báo cáo lỗi (.xlsx)
                  </button>
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Tất cả ({previewData.total_rows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'valid'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Hợp lệ ({previewData.valid_rows_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('invalid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'invalid'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Bị lỗi ({previewData.invalid_rows_count})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => { setStep(1); }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Chọn file khác
                </button>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold sticky top-0 z-10">
                        <th className="py-2.5 px-3 w-16 text-center">Dòng</th>
                        <th className="py-2.5 px-3 w-28">Trạng thái</th>
                        <th className="py-2.5 px-3">Mã (Key)</th>
                        <th className="py-2.5 px-3">Cấu trúc</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Tiêu đề công việc</th>
                        <th className="py-2.5 px-3">Cột</th>
                        <th className="py-2.5 px-3">Độ phức tạp</th>
                        <th className="py-2.5 px-3">Người phụ trách</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Chi tiết lỗi / Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredRows.map((r: PreviewRow) => (
                        <tr 
                          key={r.row_index} 
                          className={r.is_valid ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40' : 'bg-rose-50/40 dark:bg-rose-950/20'}
                        >
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">
                            {r.row_index}
                          </td>
                          <td className="py-3 px-3">
                            {r.is_valid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Hợp lệ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" />
                                Lỗi ({r.errors.length})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {r.data.external_key || '-'}
                          </td>
                          <td className="py-3 px-3">
                            {r.data.parent_external_key ? (
                              <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                                <CornerDownRight className="w-3 h-3 text-slate-400" />
                                {r.data.parent_external_key}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-semibold text-[11px]">Task cha</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                            {r.data.title}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {r.data.column_title || '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                              {r.data.complexity || 'M'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {r.data.assignees && r.data.assignees.length > 0 ? (
                              <div className="space-y-0.5">
                                {r.data.assignees.map((a: any) => (
                                  <div key={a.id} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2">
                                    <span>@{a.username}</span>
                                    <span className="font-mono text-indigo-500 font-bold">{a.contribution_percent}%</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {r.errors && r.errors.length > 0 ? (
                              <ul className="list-disc list-inside space-y-1 text-rose-600 dark:text-rose-400 font-normal">
                                {r.errors.map((err, errIdx) => (
                                  <li key={errIdx}>{err}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-slate-400 italic">Sẵn sàng import</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Quay lại chọn file
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all"
            >
              Hủy
            </button>

            {step === 1 ? (
              <button
                type="button"
                onClick={handleUploadAndPreview}
                disabled={!selectedFile || validating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang kiểm tra dữ liệu...
                  </>
                ) : (
                  <>
                    Kiểm tra dữ liệu (Upload & Preview)
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!previewData?.is_valid || confirming}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang tạo dữ liệu công việc...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Xác nhận Import ({previewData?.valid_rows_count} công việc)
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
