import { GoogleGenAI } from '@google/genai';
import { v4 as uuid } from 'uuid';
import { db, loadProviderConfig } from './db.ts';

export interface AiChatRequest {
  userId: string;
  prompt: string;
  provider?: string;
  model?: string;
  source?: 'ai_hub' | 'ai_tab' | 'chat' | 'social' | 'post_summary' | 'video_summary';
  explicitUserConsent?: boolean;
  sharedContext?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface AiChatResponse {
  ok: boolean;
  blocked?: boolean;
  needsApiKey?: boolean;
  missingProvider?: string;
  blockCategory?: 'FINANCIAL_ISOLATION' | 'PRIVACY_CONSENT_REQUIRED';
  reply: string;
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  securityAuditId: string;
}

const FINANCIAL_BLOCK_PATTERNS = [
  /حول\s.*(فلوس|مبلغ|جنيه|دولار|رصيد|اموال|أموال|محفظ)/i,
  /تحويل\s.*(مالي|بنكي|اموال|أموال|رصيد|فلوس|جنيه|دولار)/i,
  /ابعت\s.*(فلوس|جنيه|دولار|رصيد|مبلغ)/i,
  /ارسل\s.*(فلوس|جنيه|دولار|رصيد|مبلغ|اموال)/i,
  /اسحب\s.*(فلوس|رصيد|مبلغ|اموال)/i,
  /عدل\s.*(رصيد|محفظ)/i,
  /ادفع\s.*(فاتور|من محفظ|مكاني|مبلغ|جنيه|دولار)/i,
  /transfer\s.*(money|funds|balance|egp|usd|\$|\d+)/i,
  /send\s.*(\$|egp|usd|money|funds)\s+(to|for)/i,
  /withdraw\s.*(money|funds|balance|\d+)/i,
  /modify\s.*(balance|wallet)/i,
  /execute\s.*(payment|transaction|transfer)/i,
];

function normalizeArabicForFilter(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي');
}

const LM_AI_SYSTEM_PROMPT = `You are an intelligent AI assistant integrated inside LM.
Strict platform rules:
1. Never read private chats automatically — only use explicitly shared context.
2. You have zero financial authority — never transfer money, modify balances, or execute payments.
3. Respond concisely, clearly, and naturally in the user's language (Arabic or English) using clean Markdown.`;

function logSecurity(userId: string, actionType: string, decision: 'ALLOWED' | 'BLOCKED', reason: string): string {
  const id = uuid();
  db.prepare(`
    INSERT INTO ai_security_logs (id, user_id, action_type, decision, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, actionType, decision, reason);
  return id;
}

const OPENAI_COMPAT_ENDPOINTS: Record<string, { url: string; label: string; keyField: keyof ReturnType<typeof loadProviderConfig>; defaultModel: string }> = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', label: 'OpenAI', keyField: 'openaiApiKey', defaultModel: 'gpt-4o' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', label: 'DeepSeek', keyField: 'deepseekApiKey', defaultModel: 'deepseek-chat' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', label: 'xAI Grok', keyField: 'xaiApiKey', defaultModel: 'grok-3-mini' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', label: 'Mistral AI', keyField: 'mistralApiKey', defaultModel: 'mistral-large-latest' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', label: 'Groq', keyField: 'groqApiKey', defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', label: 'OpenRouter', keyField: 'openrouterApiKey', defaultModel: 'meta-llama/llama-3.3-70b-instruct' },
  perplexity: { url: 'https://api.perplexity.ai/chat/completions', label: 'Perplexity', keyField: 'perplexityApiKey', defaultModel: 'sonar-pro' },
  together: { url: 'https://api.together.xyz/v1/chat/completions', label: 'Together AI', keyField: 'togetherApiKey', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
};

export async function runLmAi(req: AiChatRequest): Promise<AiChatResponse> {
  const start = Date.now();
  const prompt = (req.prompt || '').trim();

  // 1. Silent server-enforced privacy check for private chat
  if (req.source === 'chat' && !req.explicitUserConsent) {
    const auditId = logSecurity(req.userId, 'CHAT_CONTEXT_READ', 'BLOCKED', 'Explicit share required.');
    return {
      ok: false,
      blocked: true,
      blockCategory: 'PRIVACY_CONSENT_REQUIRED',
      reply: 'حدّد الرسالة التي ترغب في مشاركتها أولًا لأتمكن من الإجابة عنها.',
      providerUsed: 'LM',
      modelUsed: 'guard',
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  // 2. Silent server-enforced financial isolation
  const normalizedPrompt = normalizeArabicForFilter(prompt);
  for (const rx of FINANCIAL_BLOCK_PATTERNS) {
    if (rx.test(normalizedPrompt)) {
      const auditId = logSecurity(req.userId, 'FINANCIAL_OPERATION_REQUEST', 'BLOCKED', `Blocked: "${prompt.slice(0, 60)}"`);
      return {
        ok: false,
        blocked: true,
        blockCategory: 'FINANCIAL_ISOLATION',
        reply: 'لا يمكنني تنفيذ التحويلات أو التعديلات المالية أو المدفوعات. يمكنني مساعدتك فقط بالتحليل أو الصياغة أو المعلومات.',
        providerUsed: 'LM',
        modelUsed: 'guard',
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }
  }

  const config = loadProviderConfig();
  const requestedProvider = (req.provider || config.defaultProvider || 'gemini') as string;
  const fullUserContent = req.sharedContext
    ? `[السياق]:\n${req.sharedContext}\n\n[الطلب]:\n${prompt}`
    : prompt;

  db.prepare('UPDATE users SET ai_used_today = ai_used_today + 1 WHERE id = ?').run(req.userId);
  const auditId = logSecurity(req.userId, req.source || 'ai_tab', 'ALLOWED', 'Processed');

  // Check if API key is missing for the selected provider
  const keyCheck: Record<string, string> = {
    gemini: config.geminiApiKey,
    openai: config.openaiApiKey,
    anthropic: config.anthropicApiKey,
    deepseek: config.deepseekApiKey,
    xai: config.xaiApiKey,
    mistral: config.mistralApiKey,
    groq: config.groqApiKey,
    openrouter: config.openrouterApiKey,
    perplexity: config.perplexityApiKey,
    together: config.togetherApiKey,
    cohere: config.cohereApiKey,
  };

  if (requestedProvider in keyCheck && !keyCheck[requestedProvider]) {
    // Inside social/chat inline quick reply: give helpful fallback instead of dead-ending if no key configured yet
    if (req.source === 'social' || req.source === 'chat') {
      return {
        ok: true,
        needsApiKey: true,
        missingProvider: requestedProvider,
        reply: req.sharedContext
          ? `بخصوص المحتوى المشارك: النقطة الأساسية تدور حول _"${req.sharedContext.slice(0, 110)}"_. للحصول على إجابات أعمق، أضف مفتاح API لأي شركة من تبويب **LM AI**.`
          : `لم يتم ربط مفتاح API بعد. افتح تبويب **LM AI** واختر الشركة لإضافة مفتاحك.`,
        providerUsed: requestedProvider,
        modelUsed: req.model || requestedProvider,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    return {
      ok: true,
      needsApiKey: true,
      missingProvider: requestedProvider,
      reply: `لم يتم إضافة مفتاح API لشركة **${requestedProvider.toUpperCase()}** بعد. أضف المفتاح من الدليل أدناه لتشغيل النموذج فورًا.`,
      providerUsed: requestedProvider,
      modelUsed: req.model || requestedProvider,
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  try {
    // 1. Google Gemini (@google/genai)
    if (requestedProvider === 'gemini' && config.geminiApiKey) {
      const model = req.model || 'gemini-4-hydrogen';
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const interaction = await ai.interactions.create({
        model,
        system_instruction: LM_AI_SYSTEM_PROMPT,
        input: fullUserContent,
      });
      return {
        ok: true,
        reply: interaction.output_text || 'لم يتم استلام رد من النموذج.',
        providerUsed: 'Google Gemini',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // 2. Anthropic Claude
    if (requestedProvider === 'anthropic' && config.anthropicApiKey) {
      const model = req.model || 'claude-3-7-sonnet-latest';
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1536,
          system: LM_AI_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: fullUserContent }],
        }),
      });
      const data = (await resp.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
      if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.content?.[0]?.text || '',
        providerUsed: 'Anthropic Claude',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // 3. Cohere v2 Chat
    if (requestedProvider === 'cohere' && config.cohereApiKey) {
      const model = req.model || 'command-a-03-2025';
      const resp = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.cohereApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: LM_AI_SYSTEM_PROMPT },
            { role: 'user', content: fullUserContent },
          ],
        }),
      });
      const data = (await resp.json()) as { message?: { content?: Array<{ text?: string }> }; message_error?: string };
      if (!resp.ok) throw new Error(`Cohere HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.message?.content?.[0]?.text || '',
        providerUsed: 'Cohere',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // 4. All 8 OpenAI-Compatible Global Providers (OpenAI, DeepSeek, xAI Grok, Mistral, Groq, OpenRouter, Perplexity, Together)
    if (requestedProvider in OPENAI_COMPAT_ENDPOINTS) {
      const spec = OPENAI_COMPAT_ENDPOINTS[requestedProvider];
      const apiKey = String(config[spec.keyField] || '');
      const model = req.model || spec.defaultModel;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      if (requestedProvider === 'openrouter') {
        headers['HTTP-Referer'] = 'http://localhost:4000';
        headers['X-Title'] = 'LM';
      }
      const resp = await fetch(spec.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: LM_AI_SYSTEM_PROMPT },
            { role: 'user', content: fullUserContent },
          ],
        }),
      });
      const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.choices?.[0]?.message?.content || '',
        providerUsed: spec.label,
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // 5. Local Ollama
    if (requestedProvider === 'ollama' && config.ollamaUrl) {
      const model = req.model || 'llama3.2';
      const resp = await fetch(`${config.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: LM_AI_SYSTEM_PROMPT },
            { role: 'user', content: fullUserContent },
          ],
        }),
      });
      const data = (await resp.json()) as { message?: { content?: string }; error?: string };
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.message?.content || '',
        providerUsed: 'Ollama',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: true,
      needsApiKey: true,
      missingProvider: requestedProvider,
      reply: `تعذر الاتصال بـ **${requestedProvider}** (${errMsg}). تحقق من مفتاح الـ API أو إعدادات الاتصال.`,
      providerUsed: requestedProvider,
      modelUsed: req.model || 'error',
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  return {
    ok: true,
    needsApiKey: true,
    missingProvider: 'gemini',
    reply: 'اختر شركة AI وأضف مفتاح الـ API الخاص بك للبدء فورًا.',
    providerUsed: requestedProvider,
    modelUsed: req.model || 'none',
    latencyMs: Date.now() - start,
    securityAuditId: auditId,
  };
}
