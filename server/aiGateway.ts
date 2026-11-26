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
  groupHistoryContext?: string;
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

const LM_AI_SYSTEM_PROMPT = `You are a sharp, helpful AI assistant inside the LM platform.
Rules:
1. Never read private 1-on-1 chats unless the user explicitly shares a snippet; in group chats where the group admin enabled you as a member, use the provided recent group context naturally.
2. You have zero financial authority — never transfer money, modify balances, or execute payments.
3. Reply directly, clearly, and concisely in the same language the user writes in (Arabic or English).`;

function logSecurity(userId: string, actionType: string, decision: 'ALLOWED' | 'BLOCKED', reason: string): string {
  const id = uuid();
  db.prepare(`
    INSERT INTO ai_security_logs (id, user_id, action_type, decision, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, actionType, decision, reason);
  return id;
}

const OPENAI_COMPAT_ENDPOINTS: Record<
  string,
  { url: string; label: string; keyField: keyof ReturnType<typeof loadProviderConfig>; defaultModel: string }
> = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', label: 'OpenAI', keyField: 'openaiApiKey', defaultModel: 'gpt-4.1' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', label: 'DeepSeek', keyField: 'deepseekApiKey', defaultModel: 'deepseek-chat' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', label: 'xAI', keyField: 'xaiApiKey', defaultModel: 'grok-3' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', label: 'Mistral AI', keyField: 'mistralApiKey', defaultModel: 'mistral-large-latest' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', label: 'Groq', keyField: 'groqApiKey', defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', label: 'OpenRouter', keyField: 'openrouterApiKey', defaultModel: 'meta-llama/llama-3.3-70b-instruct' },
  perplexity: { url: 'https://api.perplexity.ai/chat/completions', label: 'Perplexity', keyField: 'perplexityApiKey', defaultModel: 'sonar-pro' },
  together: { url: 'https://api.together.xyz/v1/chat/completions', label: 'Together AI', keyField: 'togetherApiKey', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
};

/**
 * Picks the first actually configured provider when no specific provider was requested (e.g. from Chat or Community comments!)
 */
function pickBestConfiguredProvider(config: ReturnType<typeof loadProviderConfig>, requested?: string): string {
  const keys: Record<string, string> = {
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
  if (requested && (requested === 'ollama' || keys[requested])) return requested;
  if (!requested) {
    if (config.defaultProvider && keys[config.defaultProvider]) return config.defaultProvider;
    for (const [prov, k] of Object.entries(keys)) {
      if (k) return prov;
    }
  }
  return requested || config.defaultProvider || 'gemini';
}

// Short 90s cooldown memory for temporarily rate-limited (429) or overloaded (503) models
const overloadedModels = new Map<string, number>();

/**
 * Direct fast Gemini call with automatic instant failover on 429/503/404/timeout
 * (Zero 2-minute SDK hangs; answers in ~0.9s on gemini-2.5-flash!)
 */
async function callGeminiWithFailover(
  apiKey: string,
  requestedModel: string | undefined,
  fullUserContent: string
): Promise<{ text: string; modelUsed: string }> {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 14000 } });
  const preferred = requestedModel && requestedModel !== 'lm-smart-local' ? requestedModel : 'gemini-2.5-flash';
  const rawChain = [
    preferred,
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  const now = Date.now();
  // Skip recently 429/503 models first, keeping reliable fast models up front
  const fallbackChain = [
    ...rawChain.filter(m => (overloadedModels.get(m) || 0) < now),
    ...rawChain.filter(m => (overloadedModels.get(m) || 0) >= now),
  ];

  let lastErr: unknown = null;

  for (let i = 0; i < fallbackChain.length; i++) {
    const model = fallbackChain[i];
    const isStableFast = model === 'gemini-2.5-flash' || model === 'gemini-3-flash-preview' || model === 'gemini-3.5-flash-lite';
    const timeoutMs = isStableFast ? 12000 : 5500;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: LM_AI_SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: fullUserContent }] }],
            }),
          }
        );
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          error?: { code?: number; message?: string; status?: string };
        };

        if (res.ok) {
          const text = (data.candidates?.[0]?.content?.parts || [])
            .map(p => p.text || '')
            .join('')
            .trim();
          if (text) return { text, modelUsed: model };
        }

        // If 401/403 (bad key), fail immediately — don't try other models
        if (res.status === 401 || res.status === 403) {
          throw new Error(`AUTH_ERROR: ${data.error?.message || `HTTP ${res.status}`}`);
        }

        // Cache 429 / 503 / 404 for 90 seconds so next requests stay instant!
        if (res.status === 429 || res.status === 503 || res.status === 404) {
          overloadedModels.set(model, Date.now() + 90_000);
        }

        lastErr = new Error(data.error?.message || `HTTP ${res.status}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('AUTH_ERROR:')) throw err;
      overloadedModels.set(model, Date.now() + 90_000);
      lastErr = err;
    }
  }

  // Final attempt through official @google/genai SDK on gemini-2.5-flash
  const interaction = await ai.interactions.create({
    model: 'gemini-2.5-flash',
    system_instruction: LM_AI_SYSTEM_PROMPT,
    input: fullUserContent,
  });
  if (interaction.output_text?.trim()) {
    return { text: interaction.output_text.trim(), modelUsed: 'gemini-2.5-flash' };
  }
  throw lastErr || new Error('لم يتم استلام رد من Gemini.');
}

export async function runLmAi(req: AiChatRequest): Promise<AiChatResponse> {
  const start = Date.now();
  const prompt = (req.prompt || '').trim();

  // 1. Silent server-enforced financial isolation
  const normalizedPrompt = normalizeArabicForFilter(prompt);
  for (const rx of FINANCIAL_BLOCK_PATTERNS) {
    if (rx.test(normalizedPrompt)) {
      const auditId = logSecurity(req.userId, 'FINANCIAL_OPERATION_REQUEST', 'BLOCKED', `Blocked: "${prompt.slice(0, 60)}"`);
      return {
        ok: false,
        blocked: true,
        blockCategory: 'FINANCIAL_ISOLATION',
        reply: 'لا يمكنني تنفيذ التحويلات أو التعديلات المالية أو المدفوعات. يمكنني مساعدتك بالتحليل أو الصياغة أو الإجابة على أسئلتك.',
        providerUsed: 'LM',
        modelUsed: 'guard',
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }
  }

  const config = loadProviderConfig();
  const requestedProvider = pickBestConfiguredProvider(config, req.provider);

  let fullUserContent = prompt;
  if (req.groupHistoryContext) {
    fullUserContent = `[سياق محادثة المجموعة الحديثة — أنت عضو مفعّل داخل المجموعة]:\n${req.groupHistoryContext}\n\n[رسالة المستخدم الموجهة إليك]:\n${prompt}`;
  } else if (req.sharedContext) {
    fullUserContent = `[السياق المشارَك معك بإذن المستخدم]:\n${req.sharedContext}\n\n[سؤال المستخدم — أجب مباشرة على سؤاله واستخدم السياق إن كان مرتبطًا به]:\n${prompt}`;
  }

  db.prepare('UPDATE users SET ai_used_today = ai_used_today + 1 WHERE id = ?').run(req.userId);
  const auditId = logSecurity(req.userId, req.source || 'ai_tab', 'ALLOWED', 'Processed');

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
    return {
      ok: true,
      needsApiKey: true,
      missingProvider: requestedProvider,
      reply: `لم يتم إضافة مفتاح API لشركة **${requestedProvider.toUpperCase()}** بعد. أضف المفتاح لتشغيل النموذج فورًا.`,
      providerUsed: requestedProvider,
      modelUsed: req.model || requestedProvider,
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  try {
    // 1. Google Gemini with instant failover (NEVER stalls on 429!)
    if (requestedProvider === 'gemini' && config.geminiApiKey) {
      const out = await callGeminiWithFailover(config.geminiApiKey, req.model, fullUserContent);
      return {
        ok: true,
        reply: out.text,
        providerUsed: 'Google',
        modelUsed: out.modelUsed,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // 2. Anthropic Claude
    if (requestedProvider === 'anthropic' && config.anthropicApiKey) {
      const model = req.model || 'claude-sonnet-4-20250514';
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(22000),
        body: JSON.stringify({
          model,
          max_tokens: 1536,
          system: LM_AI_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: fullUserContent }],
        }),
      });
      const data = (await resp.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
      if (!resp.ok) throw new Error(`${resp.status === 401 ? 'AUTH_ERROR: ' : ''}${data.error?.message || `HTTP ${resp.status}`}`);
      return {
        ok: true,
        reply: data.content?.[0]?.text || '',
        providerUsed: 'Anthropic',
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
        signal: AbortSignal.timeout(22000),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: LM_AI_SYSTEM_PROMPT },
            { role: 'user', content: fullUserContent },
          ],
        }),
      });
      const data = (await resp.json()) as { message?: { content?: Array<{ text?: string }> } };
      if (!resp.ok) throw new Error(`${resp.status === 401 ? 'AUTH_ERROR: ' : ''}Cohere HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.message?.content?.[0]?.text || '',
        providerUsed: 'Cohere',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // 4. OpenAI-Compatible Providers (OpenAI, DeepSeek, xAI, Mistral, Groq, OpenRouter, Perplexity, Together)
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
        signal: AbortSignal.timeout(22000),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: LM_AI_SYSTEM_PROMPT },
            { role: 'user', content: fullUserContent },
          ],
        }),
      });
      const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!resp.ok) throw new Error(`${resp.status === 401 ? 'AUTH_ERROR: ' : ''}${data.error?.message || `HTTP ${resp.status}`}`);
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
        signal: AbortSignal.timeout(25000),
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
    const isAuth = errMsg.startsWith('AUTH_ERROR:');
    return {
      ok: true,
      needsApiKey: isAuth,
      missingProvider: isAuth ? requestedProvider : undefined,
      reply: `تعذر إتمام الطلب عبر **${requestedProvider}**: ${errMsg.replace('AUTH_ERROR:', '').trim()}`,
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
    reply: 'أضف مفتاح API لإحدى الشركات للبدء فورًا.',
    providerUsed: requestedProvider,
    modelUsed: req.model || 'none',
    latencyMs: Date.now() - start,
    securityAuditId: auditId,
  };
}
