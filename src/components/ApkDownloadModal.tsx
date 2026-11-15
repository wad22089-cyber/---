import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Globe,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { downloadAndroidApkProjectZip } from '../utils/apkBuilder';

interface ApkDownloadModalProps {
  appIcon: string;
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ appIcon, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const suggestedPublicUrl = useMemo(() => {
    if (!currentOrigin) return '';
    if (currentOrigin.includes('ais-dev-')) {
      return currentOrigin.replace('ais-dev-', 'ais-pre-');
    }
    return currentOrigin;
  }, [currentOrigin]);

  const [targetUrl, setTargetUrl] = useState<string>(suggestedPublicUrl);

  const cleanTargetUrl = (targetUrl || suggestedPublicUrl).trim().replace(/\/+$/, '');
  const pwabuilderHref = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(cleanTargetUrl)}`;

  const handleDownloadApkKit = async () => {
    setDownloadingZip(true);
    try {
      await downloadAndroidApkProjectZip(cleanTargetUrl, appIcon);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(cleanTargetUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4">
      <div className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              تحميل التطبيق بصيغة APK وتثبيته
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden">
          {/* App Preview */}
          <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <img
              src={appIcon}
              alt="أيقونة التطبيق"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                نظام القيمة الجمركية - وليد الراشد
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                متوافق بالكامل مع تحويل التطبيق إلى حزمة Android <code className="font-mono">.apk</code> عبر PWABuilder أو GitHub Actions مع أيقونته الرسمية المعتمدة.
              </p>
            </div>
          </div>

          {/* Method 1: PWABuilder Direct APK Generator */}
          <div className="p-3.5 sm:p-4 rounded-xl border-2 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/15 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                ١. استخراج ملف APK جاهز مباشرة (PWABuilder)
              </h5>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                بدون برامج
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>رابط التطبيق لبناء ملف APK:</span>
                </label>
                {currentOrigin && targetUrl !== currentOrigin && (
                  <button
                    type="button"
                    onClick={() => setTargetUrl(currentOrigin)}
                    className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    استخدام رابط المعاينة الحالي
                  </button>
                )}
              </div>
              <input
                type="url"
                dir="ltr"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {currentOrigin.includes('ais-dev-') && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  تم اختيار رابط المشاركة العام تلقائياً لضمان عمل ملف الـ APK على جميع هواتف الأندرويد (تأكد من مشاركة التطبيق عبر زر Share في AI Studio أولاً).
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <a
                href={pwabuilderHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors text-center"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>توليد وتحميل ملف APK عبر PWABuilder</span>
              </a>

              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                {copiedUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span>{copiedUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>
            </div>

            <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside pt-1 leading-relaxed">
              <li>اضغط زر <strong>توليد وتحميل ملف APK عبر PWABuilder</strong> أعلاه.</li>
              <li>بعد فحص الرابط اضغط <strong>Package For Stores</strong> ثم اختر <strong>Android</strong> ثم <strong>Generate Package</strong>.</li>
              <li>قم بتنزيل الملف المضغوط وفك الضغط لتحصل على ملف <strong><code className="font-mono">.apk</code></strong> الموقّع وجاهز التثبيت فوراً.</li>
            </ol>
          </div>

          {/* Method 2: Instant Install on Device */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                ٢. التثبيت المباشر على هاتفك الآن (كتطبيق مستقل فوري)
              </h5>
              {isInstalled && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مثبّت بالفعل</span>
                </span>
              )}
            </div>

            {isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>تثبيت التطبيق الآن على الجهاز</span>
              </button>
            ) : isIOS ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
                على أجهزة <strong>iPhone / iPad</strong>: اضغط على زر <strong>المشاركة (Share)</strong> في متصفح Safari ثم اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </div>
            ) : (
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
                افتح الرابط في متصفح Chrome على هاتفك واضغط من قائمة المتصفح على <strong>&quot;تثبيت التطبيق&quot; (Install App)</strong> ليظهر بأيقونته المعتمدة كأحد تطبيقات الهاتف.
              </div>
            )}
          </div>

          {/* Method 3: Capacitor Source Bundle + GitHub Actions */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h5 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              ٣. تحميل حزمة مشروع Android APK المصدري (.zip)
            </h5>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              تحتوي الحزمة على مشروع Capacitor جاهز مع الأيقونة الرسمية وملف بناء تلقائي لـ GitHub Actions لإنتاج <code className="font-mono">app-debug.apk</code> بدون تثبيت Android Studio على جهازك.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                disabled={downloadingZip}
                onClick={handleDownloadApkKit}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <FileArchive className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{downloadingZip ? 'جاري تجهيز حزمة بناء APK...' : 'تحميل حزمة بناء Android APK (.zip)'}</span>
              </button>
              <a
                href={`/api/download/apk-kit?url=${encodeURIComponent(cleanTargetUrl)}`}
                download="Walid-Customs-Android-APK-Kit.zip"
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>رابط تنزيل مباشر</span>
              </a>
            </div>
          </div>

          {/* Educational Section: Enable Install from Unknown Sources */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h5 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                تفعيل «التثبيت من مصادر غير معروفة» (Install from unknown sources)
              </h5>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              عند تثبيت ملف <code className="font-mono">.apk</code> لأول مرة على هاتف أندرويد من خارج متجر Google Play، اتبع الخطوات التالية:
            </p>
            <ol className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                عند الضغط على ملف <code className="font-mono">.apk</code> ستظهر رسالة تنبيه، اضغط على <strong>«الإعدادات» (Settings)</strong>.
              </li>
              <li>
                فعّل خيار <strong>«السماح من هذا المصدر» (Allow from this source)</strong> لمتصفح Chrome أو تطبيق مدير الملفات (Files).
              </li>
              <li>
                إذا لم تظهر النافذة تلقائياً: افتح <strong>الإعدادات ← التطبيقات ← وصول خاص ← تثبيت تطبيقات غير معروفة</strong> (أو <strong>الأمان ← مصادر غير معروفة</strong> في الإصدارات الأقدم) ثم فعّل الإذن للمتصفح أو مدير الملفات.
              </li>
              <li>
                ارجع خطوة للخلف واضغط <strong>«تثبيت» (Install)</strong> لإتمام تثبيت التطبيق بنجاح (ويمكنك إغلاق الإذن بعد انتهاء التثبيت).
              </li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
