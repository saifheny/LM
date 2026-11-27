import React, { useEffect, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Lang } from '../../types';
import { ChromeArrowButton } from '../shared/HardwareUI';
import { AI_COMPANIES } from '../ai/AiProvidersCatalog';
import { apiGet, apiPost } from '../../lib/api';

interface ApiHubViewProps {
  lang: Lang;
}

export function ApiHubView({ lang }: ApiHubViewProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    apiGet<{ ok: boolean; providers: Record<string, string | boolean> }>('/api/providers')
      .then(res => {
        const p = res.providers;
        const init: Record<string, string> = {};
        for (const comp of AI_COMPANIES) {
          if (comp.id === 'ollama') {
            init[comp.configField] = String(p.ollamaUrl || 'http://localhost:11434');
          } else {
            const maskedKey = `${comp.id}Masked`;
            if (p[maskedKey]) init[comp.configField] = String(p[maskedKey]);
          }
        }
        setValues(init);
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await apiPost('/api/providers', values);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  }

  return (
    <div className="min-h-full w-full bg-[#121212] text-[#F2F2F5]">
      <form onSubmit={handleSave} className="max-w-[720px] mx-auto min-h-screen border-x border-white/[0.07]">
        <header className="px-5 py-5 border-b border-white/[0.07] flex items-center justify-between gap-4 sticky top-0 bg-[#121212]/92 backdrop-blur-md z-20">
          <div>
            <h1 className="text-lg font-semibold text-white">API Hub</h1>
            <p className="text-xs text-[#7A7A85] mt-0.5">
              {lang === 'ar'
                ? 'ربط مفاتيح شركات الذكاء الاصطناعي العالمية محليًا بأمان.'
                : 'Connect global AI providers locally.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {savedBanner && (
              <span className="text-xs text-[#22C55E] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>تم الحفظ</span>
              </span>
            )}
            <ChromeArrowButton type="submit" size={40} title="حفظ" />
          </div>
        </header>

        <div className="divide-y divide-white/[0.07]">
          {AI_COMPANIES.map(comp => (
            <div key={comp.id} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-white">
                  {comp.renderLogo(18)}
                  <span>{comp.name}</span>
                </div>

                <a
                  href={comp.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#8E8E93] hover:text-white flex items-center gap-1"
                >
                  <span>الحصول على المفتاح</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <input
                type={comp.id === 'ollama' ? 'text' : 'password'}
                dir="ltr"
                value={values[comp.configField] || ''}
                onChange={e => setValues(prev => ({ ...prev, [comp.configField]: e.target.value }))}
                placeholder={comp.placeholder}
                className="w-full h-10 rounded-full bg-[#131317] border border-white/[0.09] px-4 text-xs font-mono-num text-white placeholder:text-[#585860] outline-none focus:border-white/25"
              />
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
