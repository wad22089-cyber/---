import React from 'react';
import type { CustomsItem } from '../types';

interface ExportSheetProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  items: CustomsItem[];
  appIcon: string;
  searchQuery: string;
  forPrint?: boolean;
}

export const ExportSheet: React.FC<ExportSheetProps> = ({
  sheetRef,
  items,
  appIcon,
  searchQuery,
  forPrint = false,
}) => {
  const today = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      ref={sheetRef}
      dir="rtl"
      className={`bg-white text-slate-900 ${forPrint ? 'w-full p-2' : 'w-[1400px] p-6'}`}
      style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
    >
      {/* Clean Single-Page Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <img
            src={appIcon}
            alt="شعار النظام"
            className="w-11 h-11 rounded-xl object-cover border border-slate-200"
          />
          <div>
            <h1
              className={`${forPrint ? 'text-base' : 'text-xl'} font-bold text-slate-900`}
              style={{ fontFamily: "'Cairo', sans-serif" }}
            >
              نظام القيمة الجمركية - وليد الراشد
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5">
              تقرير نتائج البحث · الصفحة الأولى الشاملة
              {searchQuery.trim() ? ` · عبارة البحث: "${searchQuery}"` : ''}
            </p>
          </div>
        </div>

        <div className="text-left text-[11px] text-slate-600 space-y-0.5">
          <div>تاريخ التصدير: {today}</div>
          <div className="font-semibold text-slate-900">عدد الأصناف: {items.length}</div>
        </div>
      </div>

      {/* 13-Column Compact Single-Page Table */}
      <table
        className={`w-full border-collapse text-right ${forPrint ? 'text-[9px]' : 'text-[11px]'}`}
      >
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="p-1.5 border border-slate-700">#</th>
            <th className="p-1.5 border border-slate-700">١. اسم المنتج</th>
            <th className="p-1.5 border border-slate-700">٢. الصنف</th>
            <th className="p-1.5 border border-slate-700">٣. الماركة</th>
            <th className="p-1.5 border border-slate-700">٤. المنشأ</th>
            <th className="p-1.5 border border-slate-700">٥. الحجم/القياس</th>
            <th className="p-1.5 border border-slate-700">٦. الباركود</th>
            <th className="p-1.5 border border-slate-700">٧. البند الجمركي</th>
            <th className="p-1.5 border border-slate-700">٨. السعر</th>
            <th className="p-1.5 border border-slate-700">٩. العملة</th>
            <th className="p-1.5 border border-slate-700">١٠. العبوة</th>
            <th className="p-1.5 border border-slate-700">١١. رقم البيان</th>
            <th className="p-1.5 border border-slate-700">١٢. تاريخ البيان</th>
            <th className="p-1.5 border border-slate-700">١٣. ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="p-1.5 border border-slate-200 tabular-nums text-slate-500">{idx + 1}</td>
              <td className="p-1.5 border border-slate-200 font-semibold text-slate-900">{item.productName}</td>
              <td className="p-1.5 border border-slate-200">{item.category}</td>
              <td className="p-1.5 border border-slate-200">{item.brand}</td>
              <td className="p-1.5 border border-slate-200">{item.originCountry}</td>
              <td className="p-1.5 border border-slate-200">{item.sizeOrMeasure}</td>
              <td className="p-1.5 border border-slate-200 font-mono tabular-nums">{item.barcode}</td>
              <td className="p-1.5 border border-slate-200 font-mono tabular-nums font-semibold">{item.hsCode}</td>
              <td className="p-1.5 border border-slate-200 font-mono tabular-nums font-bold text-slate-900">
                {item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="p-1.5 border border-slate-200 font-mono">{item.currency}</td>
              <td className="p-1.5 border border-slate-200">{item.packageType}</td>
              <td className="p-1.5 border border-slate-200 font-mono tabular-nums">{item.declarationNumber}</td>
              <td className="p-1.5 border border-slate-200 font-mono tabular-nums">{item.declarationDate}</td>
              <td className="p-1.5 border border-slate-200">{item.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
        <span>نظام القيمة الجمركية - وليد الراشد · مستخرج إلكتروني معتمد</span>
        <span>صفحة ١ من ١</span>
      </div>
    </div>
  );
};
