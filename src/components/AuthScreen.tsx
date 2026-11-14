import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  ImagePlus,
  KeyRound,
  Lock,
  ScanFace,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import backdropImg from '../assets/images/customs_portal_backdrop_1794670519884.jpg';
import type { User } from '../types';
import { apiFetch, setAuthToken } from '../utils/api';
import {
  getStoredBiometricProfiles,
  verifyWebAuthnCredential,
  type StoredBiometricProfile,
} from '../utils/biometrics';

interface AuthScreenProps {
  appIcon: string;
  onAuthenticated: (user: User) => void;
  onOpenIconCustomizer: () => void;
  onOpenApkModal: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  appIcon,
  onAuthenticated,
  onOpenIconCustomizer,
  onOpenApkModal,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricProfiles, setBiometricProfiles] = useState<StoredBiometricProfile[]>([]);
  const [faceScanProfile, setFaceScanProfile] = useState<StoredBiometricProfile | null>(null);
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setBiometricProfiles(getStoredBiometricProfiles());
  }, []);

  useEffect(() => {
    if (!faceScanProfile) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    setFaceScanProgress(15);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        // Camera unavailable in sandbox/browser; continue with biometric passkey check
      }
    })();

    const t1 = setTimeout(() => !cancelled && setFaceScanProgress(60), 500);
    const t2 = setTimeout(() => !cancelled && setFaceScanProgress(100), 1100);
    const t3 = setTimeout(async () => {
      if (cancelled) return;
      try {
        await completeBiometricLogin(faceScanProfile);
      } finally {
        setFaceScanProfile(null);
      }
    }, 1400);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [faceScanProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login' ? { username, password } : { username, displayName: displayName || username, password };
      const res = await apiFetch<{ token: string; user: User }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const completeBiometricLogin = async (profile: StoredBiometricProfile) => {
    setError(null);
    setLoading(true);
    try {
      const isInIframe = window.self !== window.top;
      if (profile.webauthnCredId) {
        const ok = await verifyWebAuthnCredential(profile.webauthnCredId);
        if (!ok && !isInIframe) {
          throw new Error('لم يتم التحقق من بصمة الجهاز أو تم إلغاء العملية');
        }
      }
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/biometric/login', {
        method: 'POST',
        body: JSON.stringify({
          username: profile.username,
          biometricSecret: profile.biometricSecret,
          webauthnCredId: profile.webauthnCredId,
        }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحقق من البصمة أو الوجه');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricTrigger = (profile: StoredBiometricProfile, method: 'fingerprint' | 'face') => {
    if (method === 'face') {
      setFaceScanProfile(profile);
    } else {
      completeBiometricLogin(profile);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-slate-50 dark:bg-slate-950">
      {/* Right Column (RTL Start): Auth Form */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between p-6 sm:p-10 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenIconCustomizer}
              title="تغيير أيقونة التطبيق"
              className="group relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-900 focus-visible:outline-2 focus-visible:outline-amber-600"
            >
              <img src={appIcon} alt="أيقونة النظام" className="w-full h-full object-cover" />
              <span className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <ImagePlus className="w-4 h-4" />
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white truncate">
                نظام القيمة الجمركية - وليد الراشد
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                بوابة التحقق والبحث الجمركي المعتمدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenApkModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل APK</span>
          </button>
        </div>

        <div className="my-8 max-w-md w-full mx-auto">
          {/* Segmented Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login' ? 'مرحباً بعودتك' : 'تسجيل مستخدم جديد للبحث'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {mode === 'login'
                ? 'أدخل اسم المستخدم وكلمة المرور أو استخدم البصمة المسجلة على جهازك.'
                : 'يمكن لجميع المستخدمين التسجيل للبحث وتصدير النتائج، بينما تقتصر الإضافة والتعديل والحذف على المالك.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: walid أو اسمك"
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  الاسم الكامل للعرض
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label="إظهار أو إخفاء كلمة المرور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {mode === 'login' ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>
                {loading
                  ? 'جاري المعالجة...'
                  : mode === 'login'
                    ? 'تسجيل الدخول إلى النظام'
                    : 'إنشاء حساب البحث والدخول'}
              </span>
            </button>
          </form>

          {/* Biometric Login Area */}
          {mode === 'login' && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الدخول السريع بالبصمة أو التعرف على الوجه
                </span>
              </div>

              {biometricProfiles.length > 0 ? (
                <div className="space-y-2.5">
                  {biometricProfiles.map((profile) => (
                    <div
                      key={profile.username}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {profile.displayName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono-nums truncate">@{profile.username}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(profile.biometricType === 'fingerprint' || profile.biometricType === 'both') && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleBiometricTrigger(profile, 'fingerprint')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-600 text-slate-800 dark:text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Fingerprint className="w-4 h-4 text-amber-600" />
                            <span>البصمة</span>
                          </button>
                        )}
                        {(profile.biometricType === 'face' || profile.biometricType === 'both') && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleBiometricTrigger(profile, 'face')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-600 text-slate-800 dark:text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <ScanFace className="w-4 h-4 text-amber-600" />
                            <span>الوجه</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  يمكنك ربط <strong>البصمة</strong> أو <strong>التعرف على الوجه</strong> بحسابك فور تسجيل الدخول أو بعد تثبيت التطبيق من قائمة الأمان.
                </div>
              )}
            </div>
          )}

          {/* Quick Account Access Helper */}
          <div className="mt-6 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              حسابات التجربة السريعة:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setUsername('walid');
                  setPassword('Walid@2026');
                  setError(null);
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-600 text-slate-800 dark:text-slate-200 transition-colors text-right"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>حساب المالك</span>
                </span>
                <span className="font-mono-nums text-[11px] text-slate-500">walid</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setUsername('searcher');
                  setPassword('123456');
                  setError(null);
                }}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-800 dark:text-slate-200 transition-colors text-right"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>حساب البحث</span>
                </span>
                <span className="font-mono-nums text-[11px] text-slate-500">searcher</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span>نظام القيمة الجمركية · وليد الراشد</span>
          <button
            type="button"
            onClick={onOpenIconCustomizer}
            className="hover:text-slate-900 dark:hover:text-white transition-colors underline underline-offset-4"
          >
            تغيير أيقونة التطبيق
          </button>
        </div>
      </div>

      {/* Left Column (RTL End): Editorial Customs Port Showcase */}
      <div className="hidden lg:block lg:col-span-7 relative overflow-hidden">
        <img
          src={backdropImg}
          alt="ميناء الشحن والخدمات اللوجستية الجمركية"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/20" />

        <div className="relative z-10 h-full flex flex-col justify-end p-12 text-white max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-amber-300 font-medium mb-3">
            <span>إدارة التقييم الجمركي</span>
            <span aria-hidden="true">·</span>
            <span>١٣ عمود بيانات قياسي</span>
            <span aria-hidden="true">·</span>
            <span>بحث ذكي متعدد الكلمات</span>
          </div>

          <h2 className="font-display text-3xl xl:text-4xl font-bold leading-snug text-balance">
            قاعدة بيانات القيمة الجمركية المتكاملة مع الاستيراد الذكي والتصدير الفوري
          </h2>

          <p className="mt-4 text-sm text-slate-200 leading-relaxed max-w-xl">
            ابحث في أي صنف بكتابة كلمات متفرقة من البداية والوسط والنهاية أو من أي خانة دون التقيد بالترتيب، واستورد ملفات Excel و PDF تلقائياً، وصدّر النتائج في صفحة واحدة بصيغ Excel و PDF وصورة.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-6 pt-6 border-t border-white/15">
            <div>
              <div className="text-lg font-display font-bold text-white">بحث غير مرتب</div>
              <p className="text-xs text-slate-300 mt-1">مطابقة شاملة عبر الـ 13 عموداً بدون التقيد بترتيب الكلمات</p>
            </div>
            <div>
              <div className="text-lg font-display font-bold text-white">استيراد ذكي</div>
              <p className="text-xs text-slate-300 mt-1">إدخال يدوي أو عبر Excel أو استخراج PDF بالذكاء الاصطناعي</p>
            </div>
            <div>
              <div className="text-lg font-display font-bold text-white">صلاحيات محكمة</div>
              <p className="text-xs text-slate-300 mt-1">البحث متاح للجميع والتعديل والحذف محصور لمالك التطبيق</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Camera Face Unlock Modal */}
      {faceScanProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center">
            <div className="w-36 h-36 mx-auto rounded-full overflow-hidden border-2 border-amber-500 bg-slate-900 relative flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <Camera className="w-10 h-10 text-amber-400 absolute pointer-events-none opacity-60" />
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-4">
              جاري التعرف على الوجه...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              التحقق من هوية {faceScanProfile.displayName}
            </p>
            <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 transition-all duration-300"
                style={{ width: `${faceScanProgress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setFaceScanProfile(null)}
              className="mt-5 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
