import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { CustomsItem } from '../types';

export function exportToSinglePageExcel(items: CustomsItem[], filenamePrefix = 'نتائج_القيمة_الجمركية') {
  const headers = [
    'اسم المنتج',
    'الصنف',
    'الماركة',
    'بلد المنشأ',
    'الحجم أو القياس',
    'الباركود',
    'البند التعريفي الجمركي',
    'السعر',
    'رمز العملة',
    'نوع العبوة',
    'رقم البيان',
    'تاريخ مرجع البيان',
    'ملاحظات إضافية',
  ];

  const rows = items.map((it) => [
    it.productName,
    it.category,
    it.brand,
    it.originCountry,
    it.sizeOrMeasure,
    it.barcode,
    it.hsCode,
    it.price,
    it.currency,
    it.packageType,
    it.declarationNumber,
    it.declarationDate,
    it.notes,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set RTL sheet view and optimal column widths
  ws['!views'] = [{ rightToLeft: true }];
  ws['!cols'] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 15 },
    { wch: 11 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 26 },
  ];

  // Configure Excel print setup to fit strictly onto Page 1 (1x1 page)
  (ws as Record<string, unknown>)['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToWidth: 1,
    fitToHeight: 1,
    fitToPage: true,
  };
  ws['!margins'] = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 };

  const wb = XLSX.utils.book_new();
  wb.Workbook = {
    Views: [{ RTL: true }],
  };
  XLSX.utils.book_append_sheet(wb, ws, 'نتائج البحث - الصفحة الأولى');

  // Ensure sheetPr fitToPage is active
  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  (ws['!sheetPr'] as Record<string, unknown>).pageSetUpPr = { fitToPage: true };

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}_${dateTag}.xlsx`);
}

let cachedFontCss: string | null = null;

async function getSafeFontEmbedCSS(): Promise<string> {
  if (cachedFontCss !== null) return cachedFontCss;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      'https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) {
      cachedFontCss = '';
      return '';
    }
    cachedFontCss = await res.text();
    return cachedFontCss;
  } catch {
    cachedFontCss = '';
    return '';
  }
}

export async function exportElementToPng(element: HTMLElement, filenamePrefix = 'تقرير_القيمة_الجمركية') {
  const fontEmbedCSS = await getSafeFontEmbedCSS();
  const rowCount = element.querySelectorAll('tbody tr').length;
  const dataUrl = await toPng(element, {
    quality: 0.96,
    pixelRatio: rowCount > 40 ? 1.5 : 2,
    backgroundColor: '#ffffff',
    skipFonts: !fontEmbedCSS,
    fontEmbedCSS,
  });
  const link = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  link.download = `${filenamePrefix}_${dateTag}.png`;
  link.href = dataUrl;
  link.click();
}

export async function exportElementToSinglePagePdf(element: HTMLElement, filenamePrefix = 'تقرير_القيمة_الجمركية') {
  const fontEmbedCSS = await getSafeFontEmbedCSS();
  const rowCount = element.querySelectorAll('tbody tr').length;
  const dataUrl = await toPng(element, {
    quality: 0.95,
    pixelRatio: rowCount > 40 ? 1.5 : 2,
    backgroundColor: '#ffffff',
    skipFonts: !fontEmbedCSS,
    fontEmbedCSS,
  });

  // Load image to measure exact dimensions and scale onto Page 1 ONLY (A4 Landscape)
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;

  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const x = (pageWidth - drawW) / 2;
  const y = margin;

  pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
  const dateTag = new Date().toISOString().slice(0, 10);
  pdf.save(`${filenamePrefix}_${dateTag}.pdf`);
}
