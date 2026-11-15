import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bot,
  Check,
  CheckSquare,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Sun,
  Table2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { CUSTOMS_COLUMNS, type CustomsItem, type User } from '../types';
import { apiFetch } from '../utils/api';
import {
  exportElementToPng,
  exportElementToSinglePagePdf,
  exportToSinglePageExcel,
} from '../utils/export';
import { getStoredBiometricProfiles } from '../utils/biometrics';
import { getSearchTokens, searchCustomsItems, splitHighlightSegments } from '../utils/search';
import { ExportSheet } from './ExportSheet';

interface SearchWorkspaceProps {
  user: User;
  items: CustomsItem[];
  loadingItems: boolean;
  appIcon: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onOpenImportModal: () => void;
  onEditItem: (item: CustomsItem) => void;
  onItemsDeleted: (ids: string[]) => void;
  onOpenAiTools: (activeItems: CustomsItem[]) => void;
  onOpenBiometricModal: () => void;
  onOpenIconCustomizer: () => void;
  onOpenApkModal: () => void;
  onOpenUsersModal: () => void;
}

const HighlightedText: React.FC<{ text: string; tokens: string[] }> = ({ text, tokens }) => {
  if (!text) return <span className="text-slate-300 dark:text-slate-700">—</span>;
  if (tokens.length === 0) return <>{text}</>;
  const segments = splitHighlightSegments(text, tokens);
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark
            key={i}
            className="bg-amber-200/80 dark:bg-amber-500/30 text-slate-900 dark:text-amber-100 rounded-xs px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

export const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
  user,
  items,
  loadingItems,
  appIcon,
  darkMode,
  onToggleDarkMode,
  onLogout,
  onOpenImportModal,
  onEditItem,
  onItemsDeleted,
  onOpenAiTools,
  onOpenBiometricModal,
  onOpenIconCustomizer,
  onOpenApkModal,
  onOpenUsersModal,
}) => {
  const isOwner = user.role === 'owner';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showManageActions, setShowManageActions] = useState(false);
  const [detailItem, setDetailItem] = useState<CustomsItem | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingType, setExportingType] = useState<'pdf' | 'png' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [dismissedBiometricPrompt, setDismissedBiometricPrompt] = useState(false);
  const [showAllForOwner, setShowAllForOwner] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'name_asc'>('relevance');
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const exportSheetRef = useRef<HTMLDivElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const hasLocalBiometric = useMemo(
    () =>
      getStoredBiometricProfiles().some(
        (p) => p.username.toLowerCase() === user.username.toLowerCase()
      ),
    [user.username, user.biometricEnabled]
  );

  const uniqueCategories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
    [items]
  );
  const uniqueOrigins = useMemo(
    () => Array.from(new Set(items.map((i) => i.originCountry).filter(Boolean))).sort(),
    [items]
  );
  const uniqueCurrencies = useMemo(
    () => Array.from(new Set(items.map((i) => i.currency).filter(Boolean))).sort(),
    [items]
  );

  const searchTokens = useMemo(() => getSearchTokens(searchQuery), [searchQuery]);

  const hasActiveSearch =
    searchQuery.trim().length > 0 ||
    categoryFilter !== 'all' ||
    originFilter !== 'all' ||
    currencyFilter !== 'all' ||
    (isOwner && showAllForOwner);

  const filteredItems = useMemo(() => {
    if (!hasActiveSearch) return [];
    const matched = searchCustomsItems(items, searchQuery).filter((it) => {
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
      if (originFilter !== 'all' && it.originCountry !== originFilter) return false;
      if (currencyFilter !== 'all' && it.currency !== currencyFilter) return false;
      return true;
    });
    if (sortBy === 'price_asc') {
      return [...matched].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price_desc') {
      return [...matched].sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'name_asc') {
      return [...matched].sort((a, b) => a.productName.localeCompare(b.productName, 'ar'));
    }
    return matched;
  }, [hasActiveSearch, items, searchQuery, categoryFilter, originFilter, currencyFilter, sortBy]);

  const priceStats = useMemo(() => {
    if (filteredItems.length === 0) return null;
    const primaryCurrency = filteredItems[0].currency || 'USD';
    const sameCurrencyPrices = filteredItems
      .filter((it) => (it.currency || 'USD') === primaryCurrency)
      .map((it) => it.price);
    const list = sameCurrencyPrices.length > 0 ? sameCurrencyPrices : filteredItems.map((it) => it.price);
    const min = Math.min(...list);
    const max = Math.max(...list);
    const avg = list.reduce((sum, p) => sum + p, 0) / list.length;
    return { min, max, avg, currency: primaryCurrency };
  }, [filteredItems]);

  const handleCopyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      // ignore
    }
  };

  const targetExportItems = useMemo(() => {
    if (selectedIds.size > 0) {
      return filteredItems.filter((it) => selectedIds.has(it.id));
    }
    return filteredItems;
  }, [filteredItems, selectedIds]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((it) => selectedIds.has(it.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteIds || confirmDeleteIds.length === 0) return;
    setDeleting(true);
    setFeedbackError(null);
    try {
      if (confirmDeleteIds.length === 1) {
        await apiFetch(`/api/items/${confirmDeleteIds[0]}`, { method: 'DELETE' });
      } else {
        await apiFetch('/api/items/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: confirmDeleteIds }),
        });
      }
      onItemsDeleted(confirmDeleteIds);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        confirmDeleteIds.forEach((id) => next.delete(id));
        return next;
      });
      if (detailItem && confirmDeleteIds.includes(detailItem.id)) {
        setDetailItem(null);
      }
      setConfirmDeleteIds(null);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'تعذر حذف الأصناف');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (targetExportItems.length === 0) return;
    exportToSinglePageExcel(targetExportItems);
  };

  const waitForNextPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const handleExportPdf = async () => {
    if (targetExportItems.length === 0) return;
    setExportingType('pdf');
    setFeedbackError(null);
    try {
      await waitForNextPaint();
      if (!exportSheetRef.current) throw new Error('تعذر تجهيز ورقة التصدير');
      await exportElementToSinglePagePdf(exportSheetRef.current);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'تعذر تصدير ملف PDF');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPng = async () => {
    if (targetExportItems.length === 0) return;
    setExportingType('png');
    setFeedbackError(null);
    try {
      await waitForNextPaint();
      if (!exportSheetRef.current) throw new Error('تعذر تجهيز ورقة التصدير');
      await exportElementToPng(exportSheetRef.current);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'تعذر تصدير الصورة');
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setOriginFilter('all');
    setCurrencyFilter('all');
    setShowAllForOwner(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="min-h-dvh w-full max-w-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      {/* Top Bar Contract: 3 clean zones (Brand — Nav Links — Primary Action), strictly fitted for mobile & desktop */}
      <header className="no-print sticky top-0 z-30 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
          {/* Zone 1: Single-line Brand Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 lg:flex-initial">
            <img
              src={appIcon}
              alt="أيقونة النظام"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <span className="font-display text-sm sm:text-base lg:text-lg font-bold text-slate-900 dark:text-white truncate min-w-0">
              نظام القيمة الجمركية - وليد الراشد
            </span>
          </div>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAiTools(filteredItems)}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              الذكاء الاصطناعي
            </button>
            <button
              type="button"
              onClick={onOpenBiometricModal}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              البصمة والوجه
            </button>
            <button
              type="button"
              onClick={onOpenIconCustomizer}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              تغيير الأيقونة
            </button>
            <button
              type="button"
              onClick={onOpenApkModal}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              تحميل APK
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={onOpenUsersModal}
                className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                المستخدمون
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action + Always-Visible Logout + Compact Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isOwner ? (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="sm:hidden">إضافة</span>
                <span className="hidden sm:inline">إضافة / استيراد</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAiTools(filteredItems)}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="sm:hidden">ذكي</span>
                <span className="hidden sm:inline">المساعد الذكي</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleDarkMode}
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
              aria-label={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="تسجيل الخروج"
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium text-red-600 dark:text-red-400 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>خروج</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAiTools(filteredItems);
              }}
              className="flex items-center gap-2 p-2.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <Bot className="w-4 h-4 text-amber-600" />
              <span>أدوات الذكاء الاصطناعي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBiometricModal();
              }}
              className="flex items-center gap-2 p-2.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <Fingerprint className="w-4 h-4 text-amber-600" />
              <span>البصمة والوجه</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenIconCustomizer();
              }}
              className="flex items-center gap-2 p-2.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <ImagePlus className="w-4 h-4 text-amber-600" />
              <span>تغيير الأيقونة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenApkModal();
              }}
              className="flex items-center gap-2 p-2.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <Download className="w-4 h-4 text-amber-600" />
              <span>تحميل APK</span>
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenUsersModal();
                }}
                className="flex items-center gap-2 p-2.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <Users className="w-4 h-4 text-amber-600" />
                <span>إدارة المستخدمين</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-2 p-2.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="no-print flex-1 max-w-[1440px] w-full min-w-0 mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Account Context & Quiet Metadata Line (Zero-Pill Rule) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-200">{user.displayName}</span>
              <span aria-hidden="true">·</span>
              <span>{isOwner ? 'صلاحية المالك (إدارة كاملة)' : 'صلاحية البحث والتصدير فقط'}</span>
              {isOwner && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-nums">{items.length} صنف في القاعدة</span>
                </>
              )}
            </div>
            <h1 className="font-display text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              البحث الذكي في قاعدة بيانات القيمة الجمركية
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => onOpenAiTools(filteredItems)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              <Bot className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تحليل النتائج بالذكاء الاصطناعي</span>
            </button>
          </div>
        </div>

        {/* Biometric Quick Enrollment Notice (for devices without enrolled fingerprint/face yet) */}
        {!hasLocalBiometric && !dismissedBiometricPrompt && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70">
            <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Fingerprint className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                لتسجيل الدخول السريع بعد تثبيت التطبيق، يمكنك ربط <strong>البصمة</strong> أو{' '}
                <strong>التعرف على الوجه</strong> بهذا الجهاز الآن.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenBiometricModal}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                تفعيل البصمة / الوجه
              </button>
              <button
                type="button"
                onClick={() => setDismissedBiometricPrompt(true)}
                className="p-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg"
                aria-label="إغلاق التنبيه"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Unordered Multi-Word Search Panel */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب أي كلمات غير مرتبة من اسم المنتج أو أي خانة (مثال: شاشة 65 كوريا، أو مكيف الصين 18000، أو البند 85287200)..."
              className="w-full pr-12 pl-24 py-3.5 text-sm sm:text-base bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            )}
          </div>

          {/* Secondary Structured Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">كل الأصناف</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">كل بلدان المنشأ</option>
                {uniqueOrigins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>

              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">كل العملات</option>
                {uniqueCurrencies.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'relevance' | 'price_asc' | 'price_desc' | 'name_asc')}
                  aria-label="ترتيب النتائج"
                  className="bg-transparent focus:outline-none text-xs"
                >
                  <option value="relevance">الأكثر مطابقة</option>
                  <option value="price_asc">السعر: الأقل أولاً</option>
                  <option value="price_desc">السعر: الأعلى أولاً</option>
                  <option value="name_asc">اسم المنتج (أ - ي)</option>
                </select>
              </div>

              {(searchQuery || categoryFilter !== 'all' || originFilter !== 'all' || currencyFilter !== 'all' || showAllForOwner) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إخفاء النتائج / مسح البحث</span>
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              {hasActiveSearch ? (
                <>
                  نتائج المطابقة:{' '}
                  <strong className="font-mono-nums text-slate-900 dark:text-white">
                    {filteredItems.length}
                  </strong>{' '}
                  صنف
                  {selectedIds.size > 0 && (
                    <>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <strong className="font-mono-nums text-amber-700 dark:text-amber-400">
                        تم تحديد {selectedIds.size}
                      </strong>
                    </>
                  )}
                </>
              ) : (
                <span>قاعدة البيانات مخفية — تظهر النتائج عند البحث فقط</span>
              )}
            </div>
          </div>
        </section>

        {/* Valuation Statistics Strip (shown when matching items exist) */}
        {hasActiveSearch && priceStats && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">إجمالي النتائج</div>
              <div className="font-mono-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {filteredItems.length} <span className="text-xs font-normal text-slate-500">صنف</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">متوسط القيمة ({priceStats.currency})</div>
              <div className="font-mono-nums text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                {priceStats.avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">أدنى سعر ({priceStats.currency})</div>
              <div className="font-mono-nums text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {priceStats.min.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">أعلى سعر ({priceStats.currency})</div>
              <div className="font-mono-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {priceStats.max.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </section>
        )}

        {/* Action & Export Toolbar (shown when search results are visible) */}
        {hasActiveSearch && filteredItems.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 sm:px-4 py-3">
          {/* Left Side: Selection, Mobile View Switch & Owner Edit/Delete Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 disabled:opacity-50 whitespace-nowrap"
            >
              {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-amber-600" /> : <Square className="w-4 h-4" />}
              <span>{allVisibleSelected ? 'إلغاء تحديد الكل' : 'تحديد كل النتائج'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileViewMode(mobileViewMode === 'cards' ? 'table' : 'cards')}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 whitespace-nowrap"
            >
              {mobileViewMode === 'cards' ? <Table2 className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              <span>{mobileViewMode === 'cards' ? 'عرض الجدول' : 'عرض البطاقات'}</span>
            </button>

            {/* Owner-only Edit & Delete visibility toggle (hidden by default in search results!) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowManageActions(!showManageActions)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap ${
                  showManageActions
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showManageActions ? 'إخفاء التعديل والحذف' : 'إظهار التعديل والحذف'}</span>
              </button>
            )}

            {/* Owner Bulk Delete / Single Selected Edit */}
            {isOwner && selectedIds.size > 0 && (
              <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-700">
                {selectedIds.size === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = Array.from(selectedIds)[0];
                      const found = items.find((i) => i.id === id);
                      if (found) onEditItem(found);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-700 text-white rounded-lg whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل المحدد</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds(Array.from(selectedIds))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المحدد ({selectedIds.size})</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Side: Export & Print (Single Page Only) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden xl:inline">
              {selectedIds.size > 0
                ? `تصدير المحدد (${selectedIds.size}) — صفحة واحدة:`
                : `تصدير النتائج (${filteredItems.length}) — صفحة واحدة:`}
            </span>

            <button
              type="button"
              disabled={targetExportItems.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              disabled={targetExportItems.length === 0 || exportingType === 'pdf'}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 hover:bg-red-100 rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{exportingType === 'pdf' ? 'جاري التصدير...' : 'PDF'}</span>
            </button>

            <button
              type="button"
              disabled={targetExportItems.length === 0 || exportingType === 'png'}
              onClick={handleExportPng}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{exportingType === 'png' ? 'جاري الحفظ...' : 'صورة PNG'}</span>
            </button>

            <button
              type="button"
              disabled={targetExportItems.length === 0}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
          </div>
        </section>
        )}

        {feedbackError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {feedbackError}
          </div>
        )}

        {/* High-Density 13-Column Results Table (Database Hidden Until Search) */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {loadingItems ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !hasActiveSearch ? (
            <div className="py-16 px-6 text-center space-y-3">
              <Search className="w-10 h-10 text-amber-600/80 mx-auto" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                قاعدة البيانات مخفية — ابدأ البحث لعرض النتائج
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                اكتب كلمة أو عدة كلمات غير مرتبة من اسم المنتج أو الماركة أو بلد المنشأ أو رقم البيان أو البند التعريفي في خانة البحث أعلاه لتظهر النتائج المطابقة فقط.
              </p>
              {isOwner && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة / استيراد أصناف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllForOwner(true)}
                    className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                  >
                    استعراض القاعدة (للمالك فقط)
                  </button>
                </div>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-3">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                لا توجد أصناف مطابقة لبحثك
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                جرّب كتابة كلمات أقل أو إزالة الفلاتر الحالية، كما يمكنك سؤال المساعد الذكي لاقتراح البند التعريفي الجمركي.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 text-white rounded-lg"
                >
                  مسح عبارة البحث
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
                  >
                    إضافة صنف جديد
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile Responsive Cards View (zero horizontal clipping on phones) */}
              {mobileViewMode === 'cards' && (
                <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredItems.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 space-y-2.5 transition-colors ${
                          checked ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRow(item.id)}
                              aria-label={`تحديد ${item.productName}`}
                              className="mt-1 w-4 h-4 rounded accent-amber-600 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                                <HighlightedText text={item.productName} tokens={searchTokens} />
                              </h4>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                {item.category && <HighlightedText text={item.category} tokens={searchTokens} />}
                                {item.category && item.brand && <span aria-hidden="true">·</span>}
                                {item.brand && <HighlightedText text={item.brand} tokens={searchTokens} />}
                                {(item.category || item.brand) && item.originCountry && <span aria-hidden="true">·</span>}
                                {item.originCountry && <HighlightedText text={item.originCountry} tokens={searchTokens} />}
                              </div>
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            <div className="font-mono-nums text-sm font-bold text-amber-700 dark:text-amber-400">
                              <HighlightedText
                                text={item.price.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                tokens={searchTokens}
                              />{' '}
                              <span className="text-[11px]">{item.currency}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-slate-400">البند الجمركي: </span>
                            <span className="font-mono-nums font-semibold text-slate-800 dark:text-slate-200">
                              <HighlightedText text={item.hsCode} tokens={searchTokens} />
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">الباركود: </span>
                            <span className="font-mono-nums text-slate-700 dark:text-slate-300">
                              <HighlightedText text={item.barcode} tokens={searchTokens} />
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">القياس/الحجم: </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              <HighlightedText text={item.sizeOrMeasure} tokens={searchTokens} />
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">العبوة: </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              <HighlightedText text={item.packageType} tokens={searchTokens} />
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">رقم البيان: </span>
                            <span className="font-mono-nums text-slate-700 dark:text-slate-300">
                              <HighlightedText text={item.declarationNumber} tokens={searchTokens} />
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">تاريخ البيان: </span>
                            <span className="font-mono-nums text-slate-700 dark:text-slate-300">
                              <HighlightedText text={item.declarationDate} tokens={searchTokens} />
                            </span>
                          </div>
                          {item.notes && (
                            <div className="col-span-2 pt-0.5 text-slate-600 dark:text-slate-400">
                              <span className="text-slate-400">ملاحظات: </span>
                              <HighlightedText text={item.notes} tokens={searchTokens} />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض البطاقة الكاملة</span>
                          </button>

                          {isOwner && showManageActions && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onEditItem(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteIds([item.id])}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full 13-Column Table (Desktop default, or toggleable on mobile) */}
              <div className={`${mobileViewMode === 'cards' ? 'hidden md:block' : 'block'} overflow-x-auto max-w-full`}>
                <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="تحديد الكل"
                        className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                      />
                    </th>
                    {CUSTOMS_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="p-3 font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200"
                      >
                        {col.shortLabel}
                      </th>
                    ))}
                    <th className="p-3 font-semibold whitespace-nowrap text-center">تفاصيل</th>
                    {isOwner && showManageActions && (
                      <th className="p-3 font-semibold whitespace-nowrap text-center">تعديل / حذف</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredItems.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          checked
                            ? 'bg-amber-50/60 dark:bg-amber-950/20'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRow(item.id)}
                            aria-label={`تحديد ${item.productName}`}
                            className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white min-w-[180px]">
                          <HighlightedText text={item.productName} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.category} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          <HighlightedText text={item.brand} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.originCountry} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.sizeOrMeasure} tokens={searchTokens} />
                        </td>
                        <td className="p-3 font-mono-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.barcode} tokens={searchTokens} />
                        </td>
                        <td className="p-3 font-mono-nums font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          <HighlightedText text={item.hsCode} tokens={searchTokens} />
                        </td>
                        <td className="p-3 font-mono-nums font-bold text-slate-900 dark:text-amber-300 whitespace-nowrap">
                          <HighlightedText
                            text={item.price.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            tokens={searchTokens}
                          />
                        </td>
                        <td className="p-3 font-mono-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          <HighlightedText text={item.currency} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.packageType} tokens={searchTokens} />
                        </td>
                        <td className="p-3 font-mono-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.declarationNumber} tokens={searchTokens} />
                        </td>
                        <td className="p-3 font-mono-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <HighlightedText text={item.declarationDate} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 min-w-[160px] max-w-[240px] truncate">
                          <HighlightedText text={item.notes} tokens={searchTokens} />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="عرض بطاقة الصنف الكاملة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                        {isOwner && showManageActions && (
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditItem(item)}
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="تعديل الصنف"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteIds([item.id])}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* On-demand Single-Page Export Sheet (mounted only while exporting PNG or PDF) */}
      {exportingType !== null && (
        <div
          className="fixed top-0 left-0 w-0 h-0 overflow-hidden opacity-0 pointer-events-none"
          aria-hidden="true"
        >
          <ExportSheet
            sheetRef={exportSheetRef}
            items={targetExportItems}
            appIcon={appIcon}
            searchQuery={searchQuery}
          />
        </div>
      )}

      {/* Native Browser Print-Only View (Single Page Landscape) */}
      <div className="hidden print-only">
        <ExportSheet
          sheetRef={printSheetRef}
          items={targetExportItems}
          appIcon={appIcon}
          searchQuery={searchQuery}
          forPrint
        />
      </div>

      {/* Item Detail Slide-Over */}
      {detailItem && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-950/60">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                بطاقة تفاصيل الصنف الجمركي
              </h3>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {detailItem.category || 'صنف غير محدد'} · {detailItem.brand || 'بدون ماركة'}
                </div>
                <h4 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {detailItem.productName}
                </h4>
                <div className="mt-2 font-mono-nums text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {detailItem.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-sm">{detailItem.currency}</span>
                </div>
              </div>

              <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {CUSTOMS_COLUMNS.map((col) => {
                  const val = String(detailItem[col.key] ?? '');
                  const canCopy = Boolean(val) && (col.key === 'hsCode' || col.key === 'barcode' || col.key === 'declarationNumber');
                  return (
                    <div key={col.key} className="py-2.5 flex items-center justify-between gap-4">
                      <dt className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        {col.index}. {col.label}
                      </dt>
                      <dd className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-xs font-medium text-slate-900 dark:text-white text-left break-all ${
                            col.isNumeric ? 'font-mono-nums' : ''
                          }`}
                        >
                          {val || '—'}
                        </span>
                        {canCopy && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(col.key, val)}
                            title="نسخ"
                            className="p-1 rounded text-slate-400 hover:text-amber-600 shrink-0"
                          >
                            {copiedField === col.key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            {isOwner && (
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds([detailItem.id])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف الصنف</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = detailItem;
                    setDetailItem(null);
                    onEditItem(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 text-white rounded-lg"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>تعديل البيانات</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner Delete Confirmation Dialog */}
      {confirmDeleteIds && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                تأكيد حذف الأصناف
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              هل أنت متأكد من حذف{' '}
              <strong className="font-mono-nums text-slate-900 dark:text-white">
                {confirmDeleteIds.length}
              </strong>{' '}
              صنف من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                {deleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
