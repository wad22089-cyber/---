import React, { useRef, useState } from 'react';
import { Check, ImagePlus, RotateCcw, Upload, X } from 'lucide-react';
import type { User } from '../types';
import { apiFetch } from '../utils/api';
import {
  applyAppIconToDocument,
  getDefaultAppIcon,
  processUploadedIconFile,
  saveLocalIcon,
} from '../utils/iconManager';

interface IconCustomizerModalProps {
  currentIcon: string;
  user: User | null;
  onIconChanged: (newIcon: string) => void;
  onClose: () => void;
}

export const IconCustomizerModal: React.FC<IconCustomizerModalProps> = ({
  currentIcon,
  user,
  onIconChanged,
  onClose,
}) => {
  const [previewIcon, setPreviewIcon] = useState(currentIcon);
  const [saveGlobally, setSaveGlobally] = useState(user?.role === 'owner');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const processed = await processUploadedIconFile(file);
      setPreviewIcon(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة الصورة');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      saveLocalIcon(previewIcon);
      await applyAppIconToDocument(previewIcon);

      if (saveGlobally && user?.role === 'owner') {
        await apiFetch('/api/settings/icon', {
          method: 'PUT',
          body: JSON.stringify({ iconDataUrl: previewIcon }),
        });
      }

      onIconChanged(previewIcon);
      setMessage('تم تحديث أيقونة التطبيق وحفظها بنجاح!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الأيقونة');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const def = getDefaultAppIcon();
    setPreviewIcon(def);
    saveLocalIcon(null);
    await applyAppIconToDocument(def);
    if (user?.role === 'owner') {
      try {
        await apiFetch('/api/settings/icon', {
          method: 'PUT',
          body: JSON.stringify({ iconDataUrl: '' }),
        });
      } catch {
        // ignore
      }
    }
    onIconChanged(def);
    setMessage('تمت استعادة الأيقونة الافتراضية للنظام.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-amber-600" />
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              تغيير صورة أيقونة التطبيق
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Phone Launcher Preview */}
          <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md border border-slate-300 dark:border-slate-700 bg-slate-900">
                <img src={previewIcon} alt="معاينة الأيقونة" className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">القيمة الجمركية</span>
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                تظهر هذه الأيقونة في شاشة الدخول، وشريط العنوان، وعند تثبيت التطبيق أو تحميل حزمة الـ APK على الهاتف، ويمكن تغييرها في أي وقت بعد التحميل.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-600 rounded-lg text-slate-800 dark:text-slate-100 transition-colors"
              >
                <Upload className="w-4 h-4 text-amber-600" />
                <span>اختر صورة من جهازك</span>
              </button>
            </div>
          </div>

          {user?.role === 'owner' && (
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={saveGlobally}
                onChange={(e) => setSaveGlobally(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-600"
              />
              <span>اعتماد هذه الأيقونة كأيقونة رسمية لجميع مستخدمي النظام (بصلاحية المالك)</span>
            </label>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              <Check className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضية</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg"
            >
              إغلاق
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
            >
              {saving ? 'جاري الحفظ...' : 'تطبيق وحفظ الأيقونة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
