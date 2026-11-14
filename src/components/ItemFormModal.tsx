import React, { useState } from 'react';
import { Bot, Save, X } from 'lucide-react';
import { CUSTOMS_COLUMNS, type CustomsItem, type CustomsItemInput } from '../types';
import { apiFetch } from '../utils/api';

interface ItemFormModalProps {
  item: CustomsItem;
  onClose: () => void;
  onSaved: (updated: CustomsItem) => void;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState<CustomsItemInput>({
    productName: item.productName,
    category: item.category,
    brand: item.brand,
    originCountry: item.originCountry,
    sizeOrMeasure: item.sizeOrMeasure,
    barcode: item.barcode,
    hsCode: item.hsCode,
    price: item.price,
    currency: item.currency,
    packageType: item.packageType,
    declarationNumber: item.declarationNumber,
    declarationDate: item.declarationDate,
    notes: item.notes,
  });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ item: CustomsItem }>(`/api/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      onSaved(res.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!form.productName.trim()) return;
    setSuggesting(true);
    try {
      const res = await apiFetch<{ suggestion: Partial<CustomsItemInput> }>('/api/ai/suggest-fields', {
        method: 'POST',
        body: JSON.stringify({ productName: form.productName }),
      });
      setForm((prev) => ({
        ...prev,
        category: res.suggestion.category || prev.category,
        hsCode: res.suggestion.hsCode || prev.hsCode,
        packageType: res.suggestion.packageType || prev.packageType,
      }));
    } catch {
      // ignore
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            تعديل بيانات الصنف الجمركي
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={suggesting}
              onClick={handleAiSuggest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{suggesting ? 'جاري التحديث...' : 'اقتراح البند التعريفي بالذكاء الاصطناعي'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CUSTOMS_COLUMNS.map((col) => (
              <div key={col.key} className={col.key === 'notes' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-amber-700 dark:text-amber-400 font-mono-nums ml-1">{col.index}.</span>
                  {col.label}
                </label>
                {col.key === 'notes' ? (
                  <textarea
                    rows={2}
                    value={String(form[col.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [col.key]: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-600"
                  />
                ) : (
                  <input
                    type={col.key === 'price' ? 'number' : col.key === 'declarationDate' ? 'date' : 'text'}
                    step={col.key === 'price' ? 'any' : undefined}
                    required={col.key === 'productName'}
                    value={String(form[col.key] ?? '')}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [col.key]: col.key === 'price' ? Number(e.target.value) : e.target.value,
                      })
                    }
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-600 ${
                      col.isNumeric ? 'font-mono-nums' : ''
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
