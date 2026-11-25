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

/** Compact pill display helper so model names NEVER bloat the UI pill! */
export function shortenModelLabel(label: string): string {
  const clean = label
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/^(Meta|Google|OpenAI|Anthropic|DeepSeek|Mistral|Qwen|Cohere)\s+/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-latest$/i, '')
    .trim();
  const words = clean.split(/\s+/);
  const compact = words.slice(0, 2).join(' ');
  return compact.length > 16 ? `${compact.slice(0, 15)}…` : compact;
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
      'افتح Google AI Studio وسجّل الدخول بحساب Google.',
      'اضغط Create API Key وانسخ المفتاح.',
      'الصقه هنا ليتم جلب كل نماذج Google تلقائيًا.',
    ],
    models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', tag: 'Pro' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', tag: 'Pro' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', tag: 'Fast' },
    ],
    /* Official 4-Color Google "G" Brand Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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
      'افتح OpenAI Platform → API Keys.',
      'اضغط Create new secret key وانسخه.',
      'الصقه هنا لتحديث وجلب جميع نماذج OpenAI تلقائيًا.',
    ],
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1', tag: 'Pro' },
      { id: 'gpt-4o', label: 'GPT-4o', tag: 'Omni' },
      { id: 'o3', label: 'o3', tag: 'Reasoning' },
      { id: 'o4-mini', label: 'o4-mini', tag: 'Fast' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', tag: 'Lite' },
    ],
    /* Official OpenAI Hexagonal Blossom Knot */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
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
      'الصقه هنا لتحديث جميع نماذج Claude تلقائيًا.',
    ],
    models: [
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet', tag: 'Pro' },
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', tag: 'Pro' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', tag: 'Fast' },
      { id: 'claude-3-opus-latest', label: 'Claude 3 Opus', tag: 'Max' },
    ],
    /* Official Anthropic "A\" Geometric Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#D97757">
        <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
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
      'الصقه هنا لتفعيل DeepSeek V3 و R1 تلقائيًا.',
    ],
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3', tag: 'Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1', tag: 'Reasoner' },
    ],
    /* Official DeepSeek Whale Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M21.2 10.6c-.8-.3-1.8-.1-2.5.4-.6-2.9-3.2-5.1-6.4-5.1-3.6 0-6.6 2.8-6.8 6.4-1.3.4-2.5 1.3-3 2.5-.2.5.3 1 .8.8 1-.4 2.1-.3 3 .2 1.2 1.5 3.2 2.4 5.5 2.4 4.2 0 7.5-2.8 8.3-6.5.6-.1 1.2-.3 1.6-.7.3-.3.1-.3-.5-.4z"
          fill="#4D6BFE"
        />
        <circle cx="15.1" cy="10.4" r="1.15" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'xai',
    name: 'xAI',
    configField: 'xaiApiKey',
    statusField: 'xaiConfigured',
    keyUrl: 'https://console.x.ai/',
    placeholder: 'xai-...',
    steps: [
      'افتح xAI Console وسجّل الدخول.',
      'أنشئ مفتاح API من قسم API Keys.',
      'الصقه هنا لتحديث كل نماذج Grok تلقائيًا.',
    ],
    models: [
      { id: 'grok-3', label: 'Grok 3', tag: 'Pro' },
      { id: 'grok-3-mini', label: 'Grok 3 Mini', tag: 'Fast' },
      { id: 'grok-2-vision-1212', label: 'Grok 2 Vision', tag: 'Vision' },
    ],
    /* Official xAI Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M3.1 21L10.3 11.4L3.6 3H7.4L12.3 9.2L17.1 3H20.8L14.2 11.5L21 21H17.2L12.1 14.2L7 21H3.1Z" />
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
      'الصقه هنا لتحديث وجلب كل نماذج Mistral.',
    ],
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large', tag: 'Pro' },
      { id: 'codestral-latest', label: 'Codestral', tag: 'Code' },
      { id: 'pixtral-large-latest', label: 'Pixtral Large', tag: 'Vision' },
      { id: 'mistral-small-latest', label: 'Mistral Small', tag: 'Fast' },
    ],
    /* Official Mistral Layered Pixel M */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M3 4H7V8H3V4ZM17 4H21V8H17V4Z" fill="#FACC15" />
        <path d="M3 8H11V12H3V8ZM13 8H21V12H13V8Z" fill="#F59E0B" />
        <path d="M3 12H21V16H3V12Z" fill="#EA580C" />
        <path d="M3 16H7V20H3V16ZM10 16H14V20H10V16ZM17 16H21V20H17V16Z" fill="#DC2626" />
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
      'افتح Groq Console وأنشئ مفتاحًا.',
      'الصقه هنا لتحديث كل النماذج فائقة السرعة تلقائيًا.',
    ],
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', tag: 'Fast' },
      { id: 'qwen-qwq-32b', label: 'Qwen QwQ 32B', tag: 'Reasoning' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', tag: 'Fast' },
    ],
    /* Official Groq Emblem */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9v-1h-9v3.2h5.2c-.8 2.2-2.9 3.6-5.2 3.6-3.2 0-5.8-2.6-5.8-5.8S8.8 6.2 12 6.2c1.6 0 3 .6 4 1.7l2.4-2.3C16.8 4 14.5 3 12 3z"
          fill="#F55036"
        />
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
      'يتم تحديث قائمة النماذج المجانية والمدفوعة (120+ نموذج) مباشرةً من OpenRouter.',
    ],
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', tag: 'Open' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', tag: 'Reasoning' },
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', tag: 'Pro' },
    ],
    /* Official OpenRouter Routing Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M3 12h6.5c2 0 3-1.5 4.2-3.3C14.8 7 15.8 6 18 6h2.5" stroke="#FFFFFF" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M9.5 12c2 0 3 1.5 4.2 3.3C14.8 17 15.8 18 18 18h2.5" stroke="#A78BFA" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M18.5 3.8L21 6l-2.5 2.2M18.5 15.8L21 18l-2.5 2.2" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
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
      'افتح Perplexity API Settings وأنشئ مفتاحًا.',
      'الصقه هنا لتفعيل نماذج Sonar للبحث المباشر.',
    ],
    models: [
      { id: 'sonar-pro', label: 'Sonar Pro', tag: 'Search' },
      { id: 'sonar-reasoning-pro', label: 'Sonar Reasoning', tag: 'Deep' },
      { id: 'sonar', label: 'Sonar', tag: 'Fast' },
    ],
    /* Official Perplexity Geometric Asterisk Prism */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 2.5v19M5.5 6.5L12 12l6.5-5.5M5.5 17.5L12 12l6.5 5.5" stroke="#20B8CD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="6" y="7" width="12" height="10" stroke="#20B8CD" strokeWidth="1.5" strokeLinejoin="round" />
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
      'الصقه هنا لجلب وتحديث جميع النماذج تلقائيًا.',
    ],
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 Turbo', tag: 'Turbo' },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 Turbo', tag: 'Turbo' },
    ],
    /* Official Together Interlocking Dots Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="8" r="2.7" fill="#3B82F6" />
        <circle cx="16" cy="8" r="2.7" fill="#60A5FA" />
        <circle cx="8" cy="16" r="2.7" fill="#60A5FA" />
        <circle cx="16" cy="16" r="2.7" fill="#FFFFFF" />
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
      'انسخ المفتاح والصقه هنا لجلب أحدث نماذج Command.',
    ],
    models: [
      { id: 'command-a-03-2025', label: 'Command A', tag: 'Pro' },
      { id: 'command-r-plus', label: 'Command R+', tag: 'Arabic' },
      { id: 'command-r', label: 'Command R', tag: 'Fast' },
    ],
    /* Official Cohere Organic Capsule Mark */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M5.5 7.5C5.5 5 7.5 3.5 11.2 3.5C15.5 3.5 18.5 5.4 18.5 8.5C18.5 11.5 15.2 12.6 11 12.6H8.5C6.8 12.6 5.5 10.6 5.5 7.5Z" fill="#39D393" />
        <circle cx="8.2" cy="17.2" r="3.2" fill="#D18EE2" />
        <path d="M13 17.2C13 15.4 14.5 14 16.5 14C18.5 14 19.8 15.3 19.8 17.2C19.8 19 18.4 20.4 16.5 20.4C14.5 20.4 13 19 13 17.2Z" fill="#39D393" />
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
      'ثبّت Ollama على جهازك وشغّل أي نموذج محلي.',
      'تُجلب كل النماذج المثبتة على جهازك تلقائيًا.',
    ],
    models: [
      { id: 'llama3.2', label: 'Llama 3.2', tag: 'Local' },
      { id: 'qwen2.5', label: 'Qwen 2.5', tag: 'Local' },
      { id: 'deepseek-r1', label: 'DeepSeek R1', tag: 'Local' },
      { id: 'gemma3', label: 'Gemma 3', tag: 'Local' },
    ],
    /* Official Ollama Llama Silhouette */
    renderLogo: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M8.5 4.5C7.7 4.5 7.2 5.4 7.5 6.8L8.2 9.4C6.5 10.4 5.6 12.2 5.8 14.5C6.1 17.8 8.7 20 12 20C15.3 20 17.9 17.8 18.2 14.5C18.4 12.2 17.5 10.4 15.8 9.4L16.5 6.8C16.8 5.4 16.3 4.5 15.5 4.5C14.6 4.5 13.8 5.9 13.4 7.7C12.9 7.6 12.5 7.5 12 7.5C11.5 7.5 11.1 7.6 10.6 7.7C10.2 5.9 9.4 4.5 8.5 4.5Z"
          stroke="#FFFFFF"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="9.8" cy="13.2" r="1" fill="#FFFFFF" />
        <circle cx="14.2" cy="13.2" r="1" fill="#FFFFFF" />
      </svg>
    ),
  },
];
