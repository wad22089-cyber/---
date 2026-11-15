import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Bot,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  PenLine,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CUSTOMS_COLUMNS, type CustomsItem, type CustomsItemInput } from '../types';
import { apiFetch } from '../utils/api';

interface ImportModalProps {
  onClose: () => void;
  onItemsAdded: (items: CustomsItem[]) => void;
}

const EMPTY_ITEM: CustomsItemInput = {
  productName: '',
  category: '',
  brand: '',
  originCountry: '',
  sizeOrMeasure: '',
  barcode: '',
  hsCode: '',
  price: 0,
  currency: 'USD',
  packageType: '',
  declarationNumber: '',
  declarationDate: '',
  notes: '',
};

const HEADER_ALIASES: Record<keyof CustomsItemInput, string[]> = {
  productName: ['اسم المنتج', 'المنتج', 'الصنف التجاري', 'product', 'productname', 'name'],
  category: ['الصنف', 'الفئة', 'التصنيف', 'category', 'type'],
  brand: ['الماركة', 'العلامة التجارية', 'العلامة', 'brand', 'trademark'],
  originCountry: ['بلد المنشأ', 'المنشأ', 'البلد', 'origin', 'country'],
  sizeOrMeasure: ['الحجم أو القياس', 'الحجم', 'القياس', 'الوزن', 'size', 'measure', 'weight'],
  barcode: ['الباركود', 'باركود', 'barcode', 'ean', 'upc'],
  hsCode: ['البند التعريفي الجمركي', 'البند التعريفي', 'البند الجمركي', 'البند', 'hs', 'hscode', 'hs code'],
  price: ['السعر', 'القيمة', 'price', 'value', 'amount'],
  currency: ['رمز العملة', 'العملة', 'currency'],
  packageType: ['نوع العبوة', 'العبوة', 'التغليف', 'package', 'packaging'],
  declarationNumber: ['رقم البيان', 'البيان', 'declaration', 'dec no'],
  declarationDate: ['تاريخ مرجع البيان', 'تاريخ البيان', 'التاريخ', 'date', 'declaration date'],
  notes: ['ملاحظات إضافية', 'ملاحظات', 'ملاحظة', 'notes', 'remarks'],
};

function normalizeNumericString(val: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return val
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
    .replace(/[^\d.-]/g, '');
}

function mapExcelRows(rawRows: unknown[][]): CustomsItemInput[] {
  if (rawRows.length === 0) return [];
  const firstRow = rawRows[0].map((c) => String(c ?? '').trim().toLowerCase());
  const headerKeywords = [
    'اسم المنتج',
    'product name',
    'product',
    'الصنف',
    'الماركة',
    'بلد المنشأ',
    'الباركود',
    'البند',
    'السعر',
    'العملة',
    'العبوة',
    'رقم البيان',
  ];
  const headerMatchCount = firstRow.filter((cell) =>
    headerKeywords.some((kw) => cell === kw || cell.includes(kw))
  ).length;
  const looksLikeHeader =
    headerMatchCount >= 2 ||
    firstRow.some((cell) => cell === 'اسم المنتج' || cell === 'product name');

  const dataRows = looksLikeHeader ? rawRows.slice(1) : rawRows;

  // Build column index map if header is detected, fallback to strict 0..12 positional columns
  const colIndexMap: Record<keyof CustomsItemInput, number> = {
    productName: 0,
    category: 1,
    brand: 2,
    originCountry: 3,
    sizeOrMeasure: 4,
    barcode: 5,
    hsCode: 6,
    price: 7,
    currency: 8,
    packageType: 9,
    declarationNumber: 10,
    declarationDate: 11,
    notes: 12,
  };

  if (looksLikeHeader) {
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof CustomsItemInput, string[]]>) {
      const idx = firstRow.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
      if (idx !== -1) {
        colIndexMap[field] = idx;
      }
    }
  }

  return dataRows
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const getVal = (key: keyof CustomsItemInput) => String(row[colIndexMap[key]] ?? '').trim();
      const rawPrice = normalizeNumericString(getVal('price'));
      return {
        productName: getVal('productName'),
        category: getVal('category'),
        brand: getVal('brand'),
        originCountry: getVal('originCountry'),
        sizeOrMeasure: getVal('sizeOrMeasure'),
        barcode: getVal('barcode'),
        hsCode: getVal('hsCode'),
        price: Number(rawPrice) || 0,
        currency: (getVal('currency') || 'USD').toUpperCase(),
        packageType: getVal('packageType'),
        declarationNumber: getVal('declarationNumber'),
        declarationDate: getVal('declarationDate'),
        notes: getVal('notes'),
      };
    })
    .filter((item) => item.productName.length > 0);
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onItemsAdded }) => {
  const [tab, setTab] = useState<'manual' | 'excel' | 'pdf'>('manual');
  const [manualItem, setManualItem] = useState<CustomsItemInput>({ ...EMPTY_ITEM });
  const [previewRows, setPreviewRows] = useState<CustomsItemInput[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!manualItem.productName.trim()) {
      setError('يرجى إدخال اسم المنتج (العمود 1)');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ items: CustomsItem[] }>('/api/items', {
        method: 'POST',
        body: JSON.stringify({ item: manualItem }),
      });
      onItemsAdded(res.items);
      setManualItem({ ...EMPTY_ITEM });
      setSuccessMsg('تم حفظ الصنف بنجاح في قاعدة البيانات.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الصنف');
    } finally {
      setSaving(false);
    }
  };

  const handleAiSuggestManual = async () => {
    if (!manualItem.productName.trim()) {
      setError('اكتب اسم المنتج أولاً ليقترح الذكاء الاصطناعي الحقول.');
      return;
    }
    setSuggesting(true);
    setError(null);
    try {
      const res = await apiFetch<{ suggestion: Partial<CustomsItemInput> }>('/api/ai/suggest-fields', {
        method: 'POST',
        body: JSON.stringify({ productName: manualItem.productName }),
      });
      setManualItem((prev) => ({
        ...prev,
        category: prev.category || res.suggestion.category || '',
        hsCode: prev.hsCode || res.suggestion.hsCode || '',
        packageType: prev.packageType || res.suggestion.packageType || '',
        notes: prev.notes || res.suggestion.notes || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاتصال بالذكاء الاصطناعي');
    } finally {
      setSuggesting(false);
    }
  };

  const formatCellVal = (val: unknown): string => {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().slice(0, 10);
    }
    return String(val ?? '').trim();
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccessMsg(null);
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
      const normalizedRows = rows.map((row) =>
        Array.isArray(row) ? row.map((cell) => formatCellVal(cell)) : []
      );
      const mapped = mapExcelRows(normalizedRows);
      if (mapped.length === 0) {
        setError('لم يتم العثور على صفوف صالحة في ملف Excel. تأكد من ترتيب الأعمدة الـ 13.');
      } else {
        setPreviewRows(mapped);
      }
    } catch {
      setError('تعذر قراءة ملف Excel. تأكد من أن الملف بصيغة xlsx أو xls أو csv.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const headers = CUSTOMS_COLUMNS.map((c) => c.label);
    const sample = [
      'هاتف ذكي 256 جيجا',
      'هواتف واتصالات',
      'Apple',
      'الصين',
      '6.1 بوصة',
      '194253123456',
      '85171300',
      820,
      'USD',
      'علبة أصلية',
      'DEC-2026-5001',
      '2026-11-12',
      'مثال استرشادي مطابق للـ 13 عمود',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!views'] = [{ rightToLeft: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج_القيمة_الجمركية');
    XLSX.writeFile(wb, 'نموذج_استيراد_القيمة_الجمركية_13_عمود.xlsx');
  };

  const handlePdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccessMsg(null);
    if (file.size > 16 * 1024 * 1024) {
      setError('حجم الملف يتجاوز 16 ميجابايت. يرجى تقليل حجم ملف PDF أو رفع صفحات أقل.');
      e.target.value = '';
      return;
    }
    setParsing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.split(',')[1];
      const mimeType = file.type || 'application/pdf';
      const res = await apiFetch<{ items: CustomsItemInput[] }>('/api/ai/parse-pdf', {
        method: 'POST',
        body: JSON.stringify({ base64Data, mimeType }),
      });
      if (!res.items || res.items.length === 0) {
        setError('لم يستطع الذكاء الاصطناعي استخراج أصناف من هذا الملف.');
      } else {
        setPreviewRows(res.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحليل ملف PDF');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const handleSaveBatch = async () => {
    if (previewRows.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: CustomsItem[] }>('/api/items', {
        method: 'POST',
        body: JSON.stringify({ items: previewRows }),
      });
      onItemsAdded(res.items);
      setPreviewRows([]);
      setSuccessMsg(`تم حفظ ${res.items.length} صنف بنجاح في قاعدة البيانات!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الأصناف المستوردة');
    } finally {
      setSaving(false);
    }
  };

  const updatePreviewCell = (idx: number, key: keyof CustomsItemInput, value: string) => {
    setPreviewRows((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [key]: key === 'price' ? Number(value) || 0 : value } : row
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4">
      <div className="w-full max-w-5xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              إدخال واستيراد أصناف القيمة الجمركية (١٣ عموداً قياسياً)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              اختر الإدخال اليدوي، أو رفع ملف Excel، أو استخراج البيانات تلقائياً من ملف PDF بالذكاء الاصطناعي.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Segmented Bar */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTab('manual');
                setPreviewRows([]);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'manual'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <PenLine className="w-4 h-4" />
              <span>١. إدخال يدوي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('excel');
                setPreviewRows([]);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'excel'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>٢. رفع ملف Excel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('pdf');
                setPreviewRows([]);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'pdf'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>٣. رفع ملف PDF (ذكي)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  الحقول مرتبة من العمود ١ إلى العمود ١٣
                </span>
                <button
                  type="button"
                  disabled={suggesting}
                  onClick={handleAiSuggestManual}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>{suggesting ? 'جاري الاقتراح...' : 'إكمال التصنيف بالذكاء الاصطناعي'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CUSTOMS_COLUMNS.map((col) => (
                  <div key={col.key} className={col.key === 'notes' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <span className="text-amber-700 dark:text-amber-400 font-mono-nums ml-1">{col.index}.</span>
                      {col.label}
                      {col.key === 'productName' && <span className="text-red-500 mr-1">*</span>}
                    </label>
                    {col.key === 'notes' ? (
                      <textarea
                        rows={2}
                        value={String(manualItem[col.key] ?? '')}
                        onChange={(e) => setManualItem({ ...manualItem, [col.key]: e.target.value })}
                        placeholder={col.placeholder}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                      />
                    ) : (
                      <input
                        type={col.key === 'price' ? 'number' : col.key === 'declarationDate' ? 'date' : 'text'}
                        step={col.key === 'price' ? 'any' : undefined}
                        required={col.key === 'productName'}
                        value={
                          col.key === 'price'
                            ? manualItem.price === 0
                              ? ''
                              : String(manualItem.price)
                            : String(manualItem[col.key] ?? '')
                        }
                        onChange={(e) =>
                          setManualItem({
                            ...manualItem,
                            [col.key]:
                              col.key === 'price'
                                ? e.target.value === ''
                                  ? 0
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                        placeholder={col.key === 'price' ? '0.00' : col.placeholder}
                        className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 ${
                          col.isNumeric ? 'font-mono-nums' : ''
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>{saving ? 'جاري الحفظ...' : 'إضافة الصنف للقاعدة'}</span>
                </button>
              </div>
            </form>
          )}

          {(tab === 'excel' || tab === 'pdf') && (
            <div className="space-y-4">
              {/* Column Reference Strip */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    ترتيب الأعمدة الـ ١٣ المعتمد في القراءة التلقائية:
                  </span>
                  {tab === 'excel' && (
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-600 rounded-md text-slate-800 dark:text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600" />
                      <span>تحميل قالب Excel جاهز</span>
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {CUSTOMS_COLUMNS.map((c) => `${c.index}. ${c.label}`).join(' · ')}
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-950/40">
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFile}
                  className="hidden"
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handlePdfFile}
                  className="hidden"
                />

                {tab === 'excel' ? (
                  <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                ) : (
                  <FileText className="w-10 h-10 text-amber-600 mx-auto mb-3" />
                )}

                <h4 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                  {tab === 'excel'
                    ? 'اختر ملف Excel (.xlsx / .xls / .csv) للتعرف على الأعمدة الـ ١٣'
                    : 'ارفع ملف PDF أو صورة الفاتورة/البيان لاستخراج الأصناف بالذكاء الاصطناعي'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  {tab === 'excel'
                    ? 'يتم التعرف تلقائياً على الأعمدة من العمود ١ (اسم المنتج) إلى العمود ١٣ (ملاحظات إضافية).'
                    : 'يقوم الذكاء الاصطناعي بقراءة الجداول العربية والإنجليزية وتعبئة الأعمدة الـ ١٣ تلقائياً.'}
                </p>

                <button
                  type="button"
                  disabled={parsing}
                  onClick={() => (tab === 'excel' ? excelInputRef.current?.click() : pdfInputRef.current?.click())}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {parsing
                      ? tab === 'pdf'
                        ? 'جاري التحليل بالذكاء الاصطناعي...'
                        : 'جاري قراءة الملف...'
                      : tab === 'excel'
                        ? 'اختيار ملف Excel'
                        : 'اختيار ملف PDF أو صورة'}
                  </span>
                </button>
              </div>

              {/* Editable Preview Table */}
              {previewRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      معاينة البيانات المستخرجة ({previewRows.length} صنف) — يمكنك التعديل قبل الحفظ:
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewRows([])}
                      className="text-xs text-red-600 hover:underline"
                    >
                      مسح المعاينة
                    </button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2 border-b border-slate-200 dark:border-slate-700">#</th>
                          {CUSTOMS_COLUMNS.map((c) => (
                            <th
                              key={c.key}
                              className="p-2 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap"
                            >
                              {c.index}. {c.shortLabel}
                            </th>
                          ))}
                          <th className="p-2 border-b border-slate-200 dark:border-slate-700">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-1.5 font-mono-nums text-slate-400">{idx + 1}</td>
                            {CUSTOMS_COLUMNS.map((c) => (
                              <td key={c.key} className="p-1">
                                <input
                                  type={c.key === 'price' ? 'number' : 'text'}
                                  value={String(row[c.key] ?? '')}
                                  onChange={(e) => updatePreviewCell(idx, c.key, e.target.value)}
                                  className="w-28 px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-amber-600"
                                />
                              </td>
                            ))}
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => setPreviewRows((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveBatch}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{saving ? 'جاري الحفظ...' : `اعتماد وحفظ (${previewRows.length}) صنف`}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
