import React, { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Lang } from '../../types';
import { ChromeArrowButton } from '../shared/HardwareUI';
import { apiGet, apiPost } from '../../lib/api';

interface ApiHubViewProps {
  lang: Lang;
}

export function ApiHubView({ lang }: ApiHubViewProps) {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [livekitUrl, setLivekitUrl] = useState('');
  const [meilisearchUrl, setMeilisearchUrl] = useState('');
  const [matrixUrl, setMatrixUrl] = useState('');

  const [savedBanner, setSavedBanner] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; detail: string }>>({});

  useEffect(() => {
    apiGet<{ ok: boolean; providers: Record<string, string | boolean> }>('/api/providers')
      .then(res => {
        const p = res.providers;
        if (p.geminiMasked) setGeminiApiKey(String(p.geminiMasked));
        if (p.openaiMasked) setOpenaiApiKey(String(p.openaiMasked));
        if (p.anthropicMasked) setAnthropicApiKey(String(p.anthropicMasked));
        if (p.openrouterMasked) setOpenrouterApiKey(String(p.openrouterMasked));
        if (p.groqMasked) setGroqApiKey(String(p.groqMasked));
        if (p.ollamaUrl) setOllamaUrl(String(p.ollamaUrl));
        if (p.livekitUrl) setLivekitUrl(String(p.livekitUrl));
        if (p.meilisearchUrl) setMeilisearchUrl(String(p.meilisearchUrl));
        if (p.matrixUrl) setMatrixUrl(String(p.matrixUrl));
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await apiPost('/api/providers', {
      geminiApiKey,
      openaiApiKey,
      anthropicApiKey,
      openrouterApiKey,
      groqApiKey,
      ollamaUrl,
      livekitUrl,
      meilisearchUrl,
      matrixUrl,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  }

  async function testEndpoint(target: string) {
    const res = await apiPost<{ ok: boolean; detail: string }>('/api/providers/test', { target });
    setTestResults(prev => ({ ...prev, [target]: res }));
  }

  const rows = [
    {
      id: 'gemini',
      label: 'Google Gemini API (@google/genai)',
      value: geminiApiKey,
      set: setGeminiApiKey,
      placeholder: 'AIzaSy...',
      secret: true,
      testable: true,
    },
    {
      id: 'openai',
      label: 'OpenAI API',
      value: openaiApiKey,
      set: setOpenaiApiKey,
      placeholder: 'sk-...',
      secret: true,
      testable: false,
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude API',
      value: anthropicApiKey,
      set: setAnthropicApiKey,
      placeholder: 'sk-ant-...',
      secret: true,
      testable: false,
    },
    {
      id: 'openrouter',
      label: 'OpenRouter Unified API',
      value: openrouterApiKey,
      set: setOpenrouterApiKey,
      placeholder: 'sk-or-...',
      secret: true,
      testable: false,
    },
    {
      id: 'groq',
      label: 'Groq LPU API',
      value: groqApiKey,
      set: setGroqApiKey,
      placeholder: 'gsk_...',
      secret: true,
      testable: false,
    },
    {
      id: 'ollama',
      label: 'Ollama Local Server',
      value: ollamaUrl,
      set: setOllamaUrl,
      placeholder: 'http://localhost:11434',
      secret: false,
      testable: true,
    },
    {
      id: 'matrix',
      label: 'Matrix Synapse Homeserver',
      value: matrixUrl,
      set: setMatrixUrl,
      placeholder: 'http://localhost:8008',
      secret: false,
      testable: true,
    },
    {
      id: 'meilisearch',
      label: 'Meilisearch Engine',
      value: meilisearchUrl,
      set: setMeilisearchUrl,
      placeholder: 'http://localhost:7700',
      secret: false,
      testable: true,
    },
    {
      id: 'livekit',
      label: 'LiveKit WebRTC Server',
      value: livekitUrl,
      set: setLivekitUrl,
      placeholder: 'ws://localhost:7880',
      secret: false,
      testable: false,
    },
  ];

  return (
    <div className="min-h-full w-full bg-black text-[#F5F5F7]">
      {/* Pure Containerless Hairline API Hub */}
      <form onSubmit={handleSave} className="max-w-[720px] mx-auto min-h-screen border-x border-white/[0.08]">
        <header className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between gap-4 sticky top-0 bg-black/90 backdrop-blur-md z-20">
          <div>
            <h1 className="text-lg font-semibold text-white">API Hub</h1>
            <p className="text-xs text-[#71717A] mt-0.5">
              {lang === 'ar'
                ? 'تُحفظ المفاتيح محليًا فقط في ملف معزول عن GitHub.'
                : 'Keys are stored strictly locally outside version control.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {savedBanner && (
              <span className="text-xs text-[#22C55E] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>تم الحفظ</span>
              </span>
            )}
            <ChromeArrowButton type="submit" size={40} title="حفظ الإعدادات" />
          </div>
        </header>

        <div className="divide-y divide-white/[0.08]">
          {rows.map(r => {
            const test = testResults[r.id];
            return (
              <div key={r.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#E4E4E7]">{r.label}</label>
                  {r.testable && (
                    <button
                      type="button"
                      onClick={() => testEndpoint(r.id)}
                      className="text-[11px] text-[#8E8E93] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>فحص الاتصال</span>
                    </button>
                  )}
                </div>

                <input
                  type={r.secret ? 'password' : 'text'}
                  dir="ltr"
                  value={r.value}
                  onChange={e => r.set(e.target.value)}
                  placeholder={r.placeholder}
                  className="w-full h-10 rounded-full bg-[#070709] border border-white/[0.09] px-4 text-xs font-mono-num text-white placeholder:text-[#52525B] outline-none focus:border-white/25"
                />

                {test && (
                  <div className={`text-[11px] px-2 ${test.ok ? 'text-[#22C55E]' : 'text-[#A1A1AA]'}`}>
                    {test.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </form>
    </div>
  );
}
