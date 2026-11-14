import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Fingerprint, ScanFace, Shield, Trash2, X } from 'lucide-react';
import type { User } from '../types';
import { apiFetch } from '../utils/api';
import {
  enrollWebAuthnCredential,
  generateRandomSecret,
  getStoredBiometricProfiles,
  removeStoredBiometricProfile,
  saveStoredBiometricProfile,
} from '../utils/biometrics';

interface BiometricSetupModalProps {
  user: User;
  onClose: () => void;
  onUpdated: (user: User) => void;
}

export const BiometricSetupModal: React.FC<BiometricSetupModalProps> = ({ user, onClose, onUpdated }) => {
  const [selectedType, setSelectedType] = useState<'fingerprint' | 'face' | 'both'>('both');
  const [cameraActive, setCameraActive] = useState(false);
  const [faceSnapshot, setFaceSnapshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isEnrolledLocally = getStoredBiometricProfiles().some(
    (p) => p.username.toLowerCase() === user.username.toLowerCase()
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setError('تعذر الوصول للكاميرا. يمكنك إكمال التفعيل عبر بصمة الجهاز النظامية.');
    }
  };

  const captureFace = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 240, 240);
      setFaceSnapshot(canvas.toDataURL('image/jpeg', 0.8));
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const biometricSecret = generateRandomSecret();
      const { credId } = await enrollWebAuthnCredential(user.id, user.username, user.displayName);

      const res = await apiFetch<{ user: User }>('/api/auth/biometric/register', {
        method: 'POST',
        body: JSON.stringify({
          biometricType: selectedType,
          webauthnCredId: credId,
          biometricSecret,
        }),
      });

      saveStoredBiometricProfile({
        username: user.username,
        displayName: user.displayName,
        biometricType: selectedType,
        biometricSecret,
        webauthnCredId: credId,
        faceSnapshot,
        enrolledAt: new Date().toISOString(),
      });

      onUpdated(res.user);
      setStatusMsg('تم تفعيل الدخول بالبصمة والتعرف على الوجه بنجاح على هذا الجهاز!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل البصمة');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    removeStoredBiometricProfile(user.username);
    setStatusMsg('تمت إزالة البصمة المحفوظة من هذا الجهاز.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-600" />
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              إعداد الدخول بالبصمة والتعرف على الوجه
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
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            قم بربط بصمة الإصبع أو التعرف على الوجه بحسابك (<strong className="text-slate-900 dark:text-white">{user.username}</strong>) لتسجيل الدخول بلمسة واحدة بعد تثبيت التطبيق على الهاتف أو الكمبيوتر.
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'fingerprint', label: 'البصمة فقط', icon: Fingerprint },
              { id: 'face', label: 'الوجه فقط', icon: ScanFace },
              { id: 'both', label: 'البصمة والوجه', icon: Shield },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = selectedType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedType(opt.id as 'fingerprint' | 'face' | 'both')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-colors ${
                    active
                      ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {(selectedType === 'face' || selectedType === 'both') && (
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">التقاط صورة الوجه (اختياري)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    يُحفظ محلياً على جهازك فقط للتحقق المرئي.
                  </p>
                </div>
                {!cameraActive && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{faceSnapshot ? 'إعادة الالتقاط' : 'فتح الكاميرا'}</span>
                  </button>
                )}
              </div>

              {cameraActive && (
                <div className="mt-3 flex flex-col items-center gap-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-40 h-40 rounded-full object-cover border-2 border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={captureFace}
                    className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                  >
                    التقاط وحفظ الوجه
                  </button>
                </div>
              )}

              {faceSnapshot && !cameraActive && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={faceSnapshot} alt="صورة الوجه المسجلة" className="w-12 h-12 rounded-full object-cover border border-emerald-500" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    تم حفظ بصمة الوجه بنجاح
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {statusMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          {isEnrolledLocally ? (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إلغاء التفعيل من الجهاز</span>
            </button>
          ) : (
            <span />
          )}

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
              disabled={loading}
              onClick={handleEnroll}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{loading ? 'جاري التفعيل...' : 'تفعيل وحفظ البصمة'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
