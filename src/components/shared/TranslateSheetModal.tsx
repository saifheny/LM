import React, { useMemo, useState } from 'react';
import { Languages, Search, X } from 'lucide-react';
import { Lang } from '../../types';

export const TRANSLATE_SHEET_LANGUAGES = [
  { code: 'ar', native: 'العربية', ar: 'العربية' },
  { code: 'en', native: 'English', ar: 'الإنجليزية' },
  { code: 'fr', native: 'Français', ar: 'الفرنسية' },
  { code: 'es', native: 'Español', ar: 'الإسبانية' },
  { code: 'de', native: 'Deutsch', ar: 'الألمانية' },
  { code: 'tr', native: 'Türkçe', ar: 'التركية' },
  { code: 'it', native: 'Italiano', ar: 'الإيطالية' },
  { code: 'pt', native: 'Português', ar: 'البرتغالية' },
  { code: 'ru', native: 'Русский', ar: 'الروسية' },
  { code: 'zh-CN', native: '中文', ar: 'الصينية' },
  { code: 'ja', native: '日本語', ar: 'اليابانية' },
  { code: 'ko', native: '한국어', ar: 'الكورية' },
  { code: 'hi', native: 'हिन्दी', ar: 'الهندية' },
  { code: 'ur', native: 'اردو', ar: 'الأوردو' },
  { code: 'fa', native: 'فارسی', ar: 'الفارسية' },
  { code: 'id', native: 'Bahasa Indonesia', ar: 'الإندونيسية' },
] as const;

export function TranslateSheetModal({
  open,
  lang = 'ar',
  onClose,
  onSelectLanguage,
}: {
  open: boolean;
  lang?: Lang;
  onClose: () => void;
  onSelectLanguage: (langCode: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRANSLATE_SHEET_LANGUAGES;
    return TRANSLATE_SHEET_LANGUAGES.filter(
      item =>
        item.native.toLowerCase().includes(q) ||
        item.ar.includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[88] bg-black/62 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(18px, calc(env(safe-area-inset-bottom) + 10px))' }}
        className="w-full sm:max-w-[400px] rounded-t-[26px] sm:rounded-[26px] bg-[#171920] border-t sm:border border-white/[0.1] overflow-hidden flex flex-col max-h-[76vh]"
      >
        {/* Top Handle + Title */}
        <div className="px-4 pt-3 pb-3 space-y-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/25 mx-auto sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Languages className="w-4 h-4 text-[#25F4EE]" />
              <span>{lang === 'en' ? 'Translate to...' : 'اختر لغة الترجمة'}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-8 h-8 rounded-full hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-10 rounded-full bg-[#222530] px-3.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-[#8E8E93] shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search language...' : 'ابحث عن لغة...'}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-[#7A7A85] outline-none"
            />
          </div>
        </div>

        {/* Smooth Scrollable Vertical Language List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 divide-y divide-white/[0.05]">
          {filtered.map(item => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setQuery('');
                onSelectLanguage(item.code);
              }}
              className="w-full px-3.5 py-3 rounded-xl hover:bg-white/[0.07] active:bg-white/[0.12] flex items-center justify-between gap-3 text-start cursor-pointer transition-colors"
            >
              <span className="text-[14px] font-semibold text-white">{item.native}</span>
              <span className="text-xs text-[#8E8E93]">{item.ar}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
