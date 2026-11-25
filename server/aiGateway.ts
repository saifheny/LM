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

const LM_AI_SYSTEM_PROMPT = `You are LM AI, an intelligent assistant integrated inside the LM platform.
Rules:
1. You NEVER read private chats automatically — only analyze content explicitly shared with you.
2. You have ZERO financial authority — you cannot transfer money, modify balances, or execute payments.
3. Respond concisely, clearly, and naturally in the user's language (Arabic or English) using clean Markdown.`;

function logSecurity(userId: string, actionType: string, decision: 'ALLOWED' | 'BLOCKED', reason: string): string {
  const id = uuid();
  db.prepare(`
    INSERT INTO ai_security_logs (id, user_id, action_type, decision, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, actionType, decision, reason);
  return id;
}

export async function runLmAi(req: AiChatRequest): Promise<AiChatResponse> {
  const start = Date.now();
  const prompt = (req.prompt || '').trim();

  // 1. Silent server-enforced privacy check for private chat
  if (req.source === 'chat' && !req.explicitUserConsent) {
    const auditId = logSecurity(req.userId, 'CHAT_CONTEXT_READ', 'BLOCKED', 'المحادثات الخاصة تتطلب مشاركة صريحة.');
    return {
      ok: false,
      blocked: true,
      blockCategory: 'PRIVACY_CONSENT_REQUIRED',
      reply: 'يرجى تحديد الرسالة التي ترغب في مشاركتها معي أولًا لأتمكن من مساعدتك حولها.',
      providerUsed: 'lm-core',
      modelUsed: 'privacy-guard',
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  // 2. Silent server-enforced financial isolation
  const normalizedPrompt = normalizeArabicForFilter(prompt);
  for (const rx of FINANCIAL_BLOCK_PATTERNS) {
    if (rx.test(normalizedPrompt)) {
      const auditId = logSecurity(req.userId, 'FINANCIAL_OPERATION_REQUEST', 'BLOCKED', `Blocked financial action: "${prompt.slice(0, 60)}"`);
      return {
        ok: false,
        blocked: true,
        blockCategory: 'FINANCIAL_ISOLATION',
        reply: 'لا يمكنني تنفيذ التحويلات أو التعديلات المالية أو المدفوعات. يمكنني فقط الإجابة على أسئلتك أو إعداد التحليلات والملخصات.',
        providerUsed: 'lm-core',
        modelUsed: 'policy-guard',
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }
  }

  const config = loadProviderConfig();
  const requestedProvider = (req.provider || config.defaultProvider || 'local-smart') as string;
  const fullUserContent = req.sharedContext
    ? `[السياق]:\n${req.sharedContext}\n\n[السؤال]:\n${prompt}`
    : prompt;

  db.prepare('UPDATE users SET ai_used_today = ai_used_today + 1 WHERE id = ?').run(req.userId);
  const auditId = logSecurity(req.userId, req.source || 'ai_tab', 'ALLOWED', 'Processed');

  // If user explicitly chose a cloud provider whose API key isn't added yet -> signal UI to show inline API guide!
  const missingKeyMap: Record<string, boolean> = {
    gemini: !config.geminiApiKey,
    openai: !config.openaiApiKey,
    anthropic: !config.anthropicApiKey,
    openrouter: !config.openrouterApiKey,
    groq: !config.groqApiKey,
  };

  if (requestedProvider in missingKeyMap && missingKeyMap[requestedProvider]) {
    return {
      ok: true,
      needsApiKey: true,
      missingProvider: requestedProvider,
      reply: `لم يتم ربط مفتاح API الخاص بـ **${requestedProvider.toUpperCase()}** بعد. يمكنك إضافته مباشرةً من الدليل أدناه لتشغيل النموذج فورًا.`,
      providerUsed: requestedProvider,
      modelUsed: req.model || requestedProvider,
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  try {
    if (requestedProvider === 'gemini' && config.geminiApiKey) {
      const model = req.model || 'gemini-4-hydrogen';
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const input: unknown = req.imageBase64
        ? [
            { type: 'text', text: fullUserContent },
            { type: 'image', data: req.imageBase64, mime_type: req.imageMimeType || 'image/png' },
          ]
        : fullUserContent;

      const interaction = await ai.interactions.create({
        model,
        system_instruction: LM_AI_SYSTEM_PROMPT,
        input: input as string,
      });

      return {
        ok: true,
        reply: interaction.output_text || 'لم يتم استلام نص من النموذج.',
        providerUsed: 'Gemini',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    if (requestedProvider === 'openai' && config.openaiApiKey) {
      const model = req.model || 'gpt-4o-mini';
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
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
        providerUsed: 'OpenAI',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

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
          max_tokens: 1024,
          system: LM_AI_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: fullUserContent }],
        }),
      });
      const data = (await resp.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
      if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.content?.[0]?.text || '',
        providerUsed: 'Claude',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    if (requestedProvider === 'openrouter' && config.openrouterApiKey) {
      const model = req.model || 'meta-llama/llama-3.3-70b-instruct';
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'http://localhost:4000',
          'X-Title': 'LM',
        },
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
        providerUsed: 'OpenRouter',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    if (requestedProvider === 'groq' && config.groqApiKey) {
      const model = req.model || 'llama-3.3-70b-versatile';
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.groqApiKey}`,
        },
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
        providerUsed: 'Groq',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

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
      reply: `تعذر الاتصال بـ **${requestedProvider}** (${errMsg}). تأكد من صلاحية المفتاح أو جرب التبديل إلى LM Local.`,
      providerUsed: requestedProvider,
      modelUsed: req.model || 'fallback',
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  return {
    ok: true,
    reply: generateLocalSmartReply(prompt, req.sharedContext),
    providerUsed: 'LM Local',
    modelUsed: 'lm-local-v2',
    latencyMs: Date.now() - start,
    securityAuditId: auditId,
  };
}

function generateLocalSmartReply(prompt: string, sharedContext?: string): string {
  const lower = prompt.toLowerCase();

  if (sharedContext) {
    const clean = sharedContext.replace(/\s+/g, ' ').trim();
    const preview = clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;
    return [
      `بخصوص المنشور: _"${preview}"_`,
      '',
      `• **الإجابة المباشرة:** ${prompt.includes('?') || prompt.includes('؟') ? 'الفكرة الأساسية تركز على تبسيط التجربة البصرية وسرعة التفاعل بدون عناصر مشتتة.' : 'النقطة المحورية هنا عملية ومباشرة وتدعم تجربة استخدام سريعة ونظيفة.'}`,
      '• إذا كنت ترغب بتحليل أعمق باستخدام **Gemini** أو **GPT-4o**، اختر النموذج من الأعلى وأضف مفتاح الـ API الخاص بك.',
    ].join('\n');
  }

  if (lower.includes('ابحث') || lower.includes('حسابات') || lower.includes('search')) {
    const users = db.prepare('SELECT display_name, username, bio FROM users LIMIT 4').all() as Array<Record<string, unknown>>;
    const lines = users.map(u => `• **${u.display_name}** (@${u.username}) — ${u.bio}`).join('\n');
    return `إليك أبرز الحسابات النشطة حاليًا:\n\n${lines}`;
  }

  if (lower.includes('اكتب') || lower.includes('صياغ') || lower.includes('سكريبت') || lower.includes('draft')) {
    return [
      'إليك مسودة جاهزة ومختصرة:',
      '',
      '> "السرعة والبساطة هما معيار الجيل الجديد — تجربة واحدة تجمع التواصل، المحتوى، والذكاء الاصطناعي بدون أي تعقيد."',
      '',
      'هل تريد تعديل النبرة لتكون رسمية أكثر أو أقصر؟',
    ].join('\n');
  }

  return [
    `فهمت طلبك حول: **${prompt}**`,
    '',
    'هذا الرد يعمل عبر المحرك المحلي الفوري (`LM Local`). يمكنك في أي لحظة اختيار **Gemini** أو **OpenAI** أو **Claude** من قائمة النماذج العائمة وربط مفتاحك مباشرة لتشغيل النماذج السحابية الكاملة.',
  ].join('\n');
}
