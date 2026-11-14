import React, { useState } from 'react';
import { BarChart3, Bot, SearchCode, Send, X } from 'lucide-react';
import type { CustomsItem } from '../types';
import { apiFetch } from '../utils/api';

interface AiToolsDrawerProps {
  items: CustomsItem[];
  onClose: () => void;
}

export const AiToolsDrawer: React.FC<AiToolsDrawerProps> = ({ items, onClose }) => {
  const [mode, setMode] = useState<'analyze' | 'hs_lookup' | 'chat'>('analyze');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAssistant = async (overrideMode?: 'analyze' | 'hs_lookup' | 'chat', overrideQuery?: string) => {
    const activeMode = overrideMode || mode;
    const activeQuery = overrideQuery ?? query;
    if (activeMode !== 'analyze' && !activeQuery.trim()) {
      setError('يرجى إدخال وصف المنتج أو سؤالك أولاً');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ answer: string }>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({
          mode: activeMode,
          query: activeQuery,
          items,
        }),
      });
      setAnswer(res.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاتصال بالمساعد الذكي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                أدوات الذكاء الاصطناعي الجمركية
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تحليل الأسعار · اقتراح البند الجمركي (HS) · استشارات التقييم
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('analyze');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md whitespace-nowrap ${
                mode === 'analyze'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>تحليل النتائج</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('hs_lookup');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md whitespace-nowrap ${
                mode === 'hs_lookup'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <SearchCode className="w-3.5 h-3.5" />
              <span>البند الجمركي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('chat');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md whitespace-nowrap ${
                mode === 'chat'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>مستشار القيمة</span>
            </button>
          </div>

          {mode === 'analyze' ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                سيقوم الذكاء الاصطناعي بتحليل الأصناف الظاهرة حالياً في نتائج البحث (<strong className="font-mono-nums">{items.length}</strong> صنف) وحساب نطاقات الأسعار ومقارنة بلدان المنشأ والبنود.
              </p>
              <button
                type="button"
                disabled={loading || items.length === 0}
                onClick={() => runAssistant('analyze', '')}
                className="w-full py-2.5 px-4 bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60"
              >
                {loading ? 'جاري التحليل...' : 'بدء تحليل نتائج البحث الحالية'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {mode === 'hs_lookup'
                  ? 'اكتب اسم المنتج أو مواصفاته لاقتراح البند التعريفي الجمركي (HS Code):'
                  : 'اسأل المستشار الجمركي عن القيمة أو أي صنف من النتائج:'}
              </label>
              <textarea
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === 'hs_lookup'
                    ? 'مثال: شاشة كمبيوتر LED قياس 27 بوصة ماركة LG'
                    : 'مثال: ما متوسط سعر شاشات التلفزيون في النتائج الحالية؟'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-600"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => runAssistant()}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-900 dark:bg-amber-600 hover:bg-slate-800 dark:hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'جاري المعالجة...' : 'إرسال للذكاء الاصطناعي'}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {answer && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {answer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
