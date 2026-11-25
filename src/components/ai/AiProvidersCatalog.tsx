import React from 'react';

export interface AiCompanyModel {
  id: string;
  label: string;
  tag?: string;
}

export interface AiCompanyDef {
  id: string;
  name: string;
  configField: string;
  statusField: string;
  keyUrl: string;
  placeholder: string;
  steps: string[];
  models: AiCompanyModel[];
  renderLogo: (size?: number) => React.ReactNode;
}

export const AI_COMPANIES: AiCompanyDef[] = [
  {
    id: 'gemini',
    name: 'Google',
    configField: 'geminiApiKey',
    statusField: 'geminiConfigured',
    keyUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIzaSy...',
    steps: [
      'افتح Google AI Studio من الرابط أدناه وسجّل الدخول بحساب Google.',
      'اضغط Create API Key وانسخ المفتاح.',
      'الصقه هنا واضغط حفظ ثم اختر النموذج.',
    ],
    models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', tag: 'Flagship' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', tag: 'Pro' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', tag: 'Fast' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C12.8 7.5 16.5 11.2 22 12C16.5 12.8 12.8 16.5 12 22C11.2 16.5 7.5 12.8 2 12C7.5 11.2 11.2 7.5 12 2Z"
          fill="url(#gLogoGrad)"
        />
        <defs>
          <linearGradient id="gLogoGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 'openai',
    name: 'OpenAI',
    configField: 'openaiApiKey',
    statusField: 'openaiConfigured',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    steps: [
      'افتح لوحة مفاتيح OpenAI من الرابط أدناه.',
      'اضغط Create new secret key وانسخ المفتاح.',
      'الصقه هنا واضغط حفظ.',
    ],
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1', tag: 'Latest' },
      { id: 'gpt-4o', label: 'GPT-4o', tag: 'Omni' },
      { id: 'o3-mini', label: 'o3-mini', tag: 'Reasoning' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', tag: 'Fast' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9.5" stroke="#FFFFFF" strokeWidth="1.7" />
        <path d="M12 5.5L17.6 8.8V15.2L12 18.5L6.4 15.2V8.8L12 5.5Z" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    configField: 'anthropicApiKey',
    statusField: 'anthropicConfigured',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
    steps: [
      'افتح Anthropic Console → API Keys.',
      'أنشئ مفتاحًا جديدًا وانسخه.',
      'الصقه هنا واضغط حفظ.',
    ],
    models: [
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet', tag: 'Best' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', tag: 'Fast' },
      { id: 'claude-3-opus-latest', label: 'Claude 3 Opus', tag: 'Deep' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6.5 19L11.2 5H13.6L18.3 19H15.6L14.5 15.5H10.3L9.2 19H6.5ZM11 13.2H13.8L12.4 8.6L11 13.2Z" fill="#E89A6C" />
      </svg>
    ),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    configField: 'deepseekApiKey',
    statusField: 'deepseekConfigured',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    placeholder: 'sk-...',
    steps: [
      'افتح DeepSeek Platform → API Keys.',
      'أنشئ مفتاح API وانسخه.',
      'الصقه هنا لتشغيل DeepSeek V3 و R1 فورًا.',
    ],
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek-V3', tag: 'General' },
      { id: 'deepseek-reasoner', label: 'DeepSeek-R1', tag: 'Reasoning' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 13.5C5.5 8.5 10.5 6 15.5 7.5C18.5 8.4 20.5 10.5 21 13.5C18.2 12.2 16 13.8 14.5 15.5C12.2 18 7.5 18 4 13.5Z"
          fill="#4D6BFE"
        />
        <circle cx="14.5" cy="10.8" r="1.2" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    configField: 'xaiApiKey',
    statusField: 'xaiConfigured',
    keyUrl: 'https://console.x.ai/',
    placeholder: 'xai-...',
    steps: [
      'افتح xAI Console وسجّل الدخول.',
      'أنشئ مفتاح API من قسم API Keys.',
      'الصقه هنا لتشغيل Grok 3.',
    ],
    models: [
      { id: 'grok-3', label: 'Grok 3', tag: 'Flagship' },
      { id: 'grok-3-mini', label: 'Grok 3 Mini', tag: 'Fast' },
      { id: 'grok-2-latest', label: 'Grok 2', tag: 'Stable' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M5 5L19 19M19 5L12.5 11.5M5 19L10.5 13.5" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    configField: 'mistralApiKey',
    statusField: 'mistralConfigured',
    keyUrl: 'https://console.mistral.ai/api-keys',
    placeholder: '...',
    steps: [
      'افتح Mistral Console → API Keys.',
      'اضغط Create new key وانسخه.',
      'الصقه هنا لتفعيل Mistral Large و Codestral.',
    ],
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large', tag: 'Pro' },
      { id: 'codestral-latest', label: 'Codestral', tag: 'Code' },
      { id: 'mistral-small-latest', label: 'Mistral Small', tag: 'Fast' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5" width="4" height="4" fill="#F59E0B" />
        <rect x="16" y="5" width="4" height="4" fill="#F59E0B" />
        <rect x="4" y="10" width="8" height="4" fill="#EA580C" />
        <rect x="12" y="10" width="8" height="4" fill="#EA580C" />
        <rect x="4" y="15" width="4" height="4" fill="#DC2626" />
        <rect x="10" y="15" width="4" height="4" fill="#DC2626" />
        <rect x="16" y="15" width="4" height="4" fill="#DC2626" />
      </svg>
    ),
  },
  {
    id: 'groq',
    name: 'Groq',
    configField: 'groqApiKey',
    statusField: 'groqConfigured',
    keyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
    steps: [
      'افتح Groq Console وأنشئ مفتاحًا مجانيًا.',
      'انسخ المفتاح والصقه هنا لأسرع استجابة LPU.',
    ],
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tag: 'Ultra Fast' },
      { id: 'qwen-qwq-32b', label: 'Qwen QwQ 32B', tag: 'Reasoning' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', tag: 'Balanced' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="#F97316" strokeWidth="2.4" />
        <path d="M12 12H20.5" stroke="#F97316" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    configField: 'openrouterApiKey',
    statusField: 'openrouterConfigured',
    keyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-...',
    steps: [
      'افتح OpenRouter Keys وأنشئ مفتاحًا موحدًا.',
      'الصقه هنا للوصول لمئات النماذج العالمية.',
    ],
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 70B', tag: 'Open' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', tag: 'Reasoning' },
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', tag: 'Multilingual' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M4 12H10L15 6H20M10 12L15 18H20" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy="12" r="2" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    configField: 'perplexityApiKey',
    statusField: 'perplexityConfigured',
    keyUrl: 'https://www.perplexity.ai/settings/api',
    placeholder: 'pplx-...',
    steps: [
      'افتح إعدادات Perplexity API وأنشئ مفتاحًا.',
      'الصقه هنا لتفعيل البحث المباشر Sonar Pro.',
    ],
    models: [
      { id: 'sonar-pro', label: 'Sonar Pro', tag: 'Live Web' },
      { id: 'sonar-reasoning', label: 'Sonar Reasoning', tag: 'Deep Search' },
      { id: 'sonar', label: 'Sonar', tag: 'Fast' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 3V21M5 7L12 12L19 7M5 17L12 12L19 17" stroke="#22D3EE" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'together',
    name: 'Together AI',
    configField: 'togetherApiKey',
    statusField: 'togetherConfigured',
    keyUrl: 'https://api.together.xyz/settings/api-keys',
    placeholder: '...',
    steps: [
      'افتح Together AI → API Keys وانسخ المفتاح.',
      'الصقه هنا لتشغيل النماذج المفتوحة عالية السرعة.',
    ],
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo', tag: 'Turbo' },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B Turbo', tag: 'Turbo' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="12" r="5" stroke="#38BDF8" strokeWidth="2" />
        <circle cx="15" cy="12" r="5" stroke="#818CF8" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'cohere',
    name: 'Cohere',
    configField: 'cohereApiKey',
    statusField: 'cohereConfigured',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    placeholder: '...',
    steps: [
      'افتح Cohere Dashboard → API Keys.',
      'انسخ المفتاح والصقه هنا لتشغيل Command A.',
    ],
    models: [
      { id: 'command-a-03-2025', label: 'Command A', tag: 'Enterprise' },
      { id: 'command-r-plus', label: 'Command R+', tag: 'Arabic Pro' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="6" width="11" height="6" rx="3" fill="#34D399" />
        <rect x="9" y="13" width="11" height="6" rx="3" fill="#10B981" />
      </svg>
    ),
  },
  {
    id: 'ollama',
    name: 'Ollama',
    configField: 'ollamaUrl',
    statusField: 'ollamaConfigured',
    keyUrl: 'https://ollama.com',
    placeholder: 'http://localhost:11434',
    steps: [
      'ثبّت Ollama على جهازك وشغّل النموذج المطلوب.',
      'تأكد من العنوان المحلي واضغط حفظ.',
    ],
    models: [
      { id: 'llama3.2', label: 'Llama 3.2', tag: 'Local' },
      { id: 'qwen2.5', label: 'Qwen 2.5', tag: 'Local' },
      { id: 'deepseek-r1', label: 'DeepSeek R1', tag: 'Local' },
      { id: 'gemma3', label: 'Gemma 3', tag: 'Local' },
    ],
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="13" r="6.5" stroke="#E4E4E7" strokeWidth="1.9" />
        <path d="M9 7.5L8 4.5M15 7.5L16 4.5" stroke="#E4E4E7" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="10" cy="12.5" r="1" fill="#E4E4E7" />
        <circle cx="14" cy="12.5" r="1" fill="#E4E4E7" />
      </svg>
    ),
  },
];
