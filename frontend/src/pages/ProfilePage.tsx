import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, User, Phone, Shield, Loader2, Calendar, MapPin, Mail, ChevronDown, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';
import { toast } from 'sonner';
import { DatePicker } from '../components/ui/DatePicker';

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    dob: user?.dob || '',
    address: user?.address || '',
    join_date: user?.join_date || '',
    contact_email: user?.contact_email || ''
  });
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [genderMenuOpen, setGenderMenuOpen] = useState(false);
  const genderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        gender: user.gender || '',
        dob: user.dob || '',
        address: user.address || '',
        join_date: user.join_date || '',
        contact_email: user.contact_email || ''
      });
      setAvatarPreview(user.avatar || null);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (genderMenuRef.current && !genderMenuRef.current.contains(event.target as Node)) {
        setGenderMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setGenderMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGenderSelect = (val: string) => {
    setFormData(prev => ({ ...prev, gender: val }));
    setGenderMenuOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Định dạng file không hợp lệ. Vui lòng chọn ảnh.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const isChanged = 
    formData.name !== (user?.name || '') ||
    formData.phone !== (user?.phone || '') ||
    formData.gender !== (user?.gender || '') ||
    formData.dob !== (user?.dob || '') ||
    formData.address !== (user?.address || '') ||
    formData.join_date !== (user?.join_date || '') ||
    formData.contact_email !== (user?.contact_email || '') ||
    selectedFile !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      const data = new FormData();
      if (formData.name) data.append('name', formData.name);
      if (formData.phone) data.append('phone', formData.phone);
      if (formData.gender) data.append('gender', formData.gender);
      if (formData.dob) data.append('dob', formData.dob);
      if (formData.address) data.append('address', formData.address);
      if (formData.join_date) data.append('join_date', formData.join_date);
      if (formData.contact_email) data.append('contact_email', formData.contact_email);
      
      if (selectedFile) {
        data.append('avatar', selectedFile);
      }

      // Use native fetch to bypass any Axios interceptor / boundary issues entirely
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${apiUrl}/me`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch (e) {
          throw new Error('Lỗi máy chủ hoặc mất kết nối mạng.');
        }

        if (errorData.errors) {
          const firstError = Object.values(errorData.errors)[0] as string[];
          throw new Error(firstError[0]);
        }
        throw new Error(errorData.message || 'Có lỗi xảy ra khi lưu hồ sơ');
      }
      
      const responseData = await res.json();
      updateUser(responseData);
      setSelectedFile(null);
      toast.success('Cập nhật hồ sơ thành công');
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Có lỗi xảy ra khi lưu hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'system_admin') return 'Quản trị hệ thống';
    if (role === 'manager') return 'Quản lý';
    return 'Nhân viên';
  };

  const genderOptions = [
    { value: '', label: 'Chưa cập nhật' },
    { value: 'Nam', label: 'Nam' },
    { value: 'Nữ', label: 'Nữ' },
    { value: 'Khác', label: 'Khác' },
    { value: 'Không muốn cung cấp', label: 'Không muốn cung cấp' },
  ];

  const selectedGenderLabel = genderOptions.find(opt => opt.value === formData.gender)?.label || 'Chưa cập nhật';

  return (
    <div className="flex-1 overflow-y-auto bg-background/50 custom-scrollbar p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Profile Card Header */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 flex items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none"></div>
          
          {/* Avatar Upload */}
          <div className="relative group shrink-0 z-10">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-background shadow-sm overflow-hidden bg-gradient-to-br from-purple-600 to-primary flex items-center justify-center text-3xl font-bold text-white relative">
              {avatarPreview ? (
                <img src={avatarPreview.startsWith('data:') || avatarPreview.startsWith('http') ? avatarPreview : `http://localhost:8000${avatarPreview}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{formData.name.charAt(0).toUpperCase() || 'U'}</span>
              )}
              
              <div 
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="text-white mb-1" size={20} />
                <span className="text-white text-[10px] font-medium">Thay đổi</span>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileSelect}
            />
          </div>

          <div className="z-10 flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">{user?.name}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Shield size={12} />
                {getRoleLabel(user?.system_role || '')}
              </span>
            </div>
          </div>
        </div>

        {/* Personal Info Form */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 border-b border-border/50">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <User size={20} className="text-primary" /> Thông tin cá nhân
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Cập nhật thông tin cơ bản để mọi người dễ dàng liên lạc.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Họ và tên</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-2.5 bg-accent/50 border border-transparent rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm font-medium placeholder:font-normal"
                    placeholder="Chưa cập nhật"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Số điện thoại</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-2.5 bg-accent/50 border border-transparent rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm font-medium placeholder:font-normal"
                    placeholder="Chưa cập nhật"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Ngày sinh</label>
                <DatePicker 
                  value={formData.dob}
                  onChange={(val) => setFormData(prev => ({ ...prev, dob: val }))}
                  placeholder="Chưa cập nhật (dd/mm/yyyy)"
                />
              </div>

              <div className="space-y-2" ref={genderMenuRef}>
                <label className="block text-sm font-semibold text-foreground">Giới tính</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGenderMenuOpen(!genderMenuOpen)}
                    className="w-full pl-5 pr-11 py-2.5 bg-accent/50 border border-transparent rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm font-medium text-left flex items-center justify-between"
                  >
                    <span className={formData.gender ? 'text-foreground' : 'text-muted-foreground font-normal'}>
                      {selectedGenderLabel}
                    </span>
                    <ChevronDown size={18} className={`text-muted-foreground absolute right-4 transition-transform ${genderMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {genderMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      {genderOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleGenderSelect(opt.value)}
                          className="w-full px-4 py-2 text-sm text-left flex items-center justify-between hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary outline-none"
                        >
                          {opt.label}
                          {formData.gender === opt.value && <Check size={16} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Gmail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-2.5 bg-accent/50 border border-transparent rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm font-medium placeholder:font-normal"
                    placeholder="Chưa cập nhật"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Ngày vào làm</label>
                <DatePicker 
                  value={formData.join_date}
                  onChange={(val) => setFormData(prev => ({ ...prev, join_date: val }))}
                  placeholder="Chưa cập nhật (dd/mm/yyyy)"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-semibold text-foreground">Địa chỉ nhà</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-2.5 bg-accent/50 border border-transparent rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm font-medium placeholder:font-normal"
                    placeholder="Chưa cập nhật"
                  />
                </div>
              </div>
              
            </div>

            <div className="flex justify-end pt-4 border-t border-border/50">
              <button
                type="submit"
                disabled={!isChanged || loading}
                className="flex items-center justify-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto shadow-sm"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
