import { GoogleGenAI } from '@google/genai';
import { v4 as uuid } from 'uuid';
import { db, loadProviderConfig } from './db.ts';

export interface AiChatRequest {
  userId: string;
  prompt: string;
  provider?: string;
  model?: string;
  source?: 'ai_hub' | 'chat' | 'post_summary' | 'video_summary';
  explicitUserConsent?: boolean;
  sharedContext?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface AiChatResponse {
  ok: boolean;
  blocked?: boolean;
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
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip harakat / shadda
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي');
}

const LM_AI_SYSTEM_PROMPT = `You are LM AI, the integrated daily assistant inside the LM Super App (starting in Egypt and built for global expansion).
Strict non-negotiable platform rules:
1. You NEVER read private chats automatically — you only analyze content explicitly shared with you by the user.
2. You have ZERO financial authority — you cannot transfer money, modify balances, or execute payments. You may only analyze public data or draft informational reports.
3. Respond concisely, helpfully, and intelligently in the same language the user writes in (Arabic or English). Use clean formatting.`;

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

  // 1. HARD PRIVACY CHECK: If called from private chat without explicit consent
  if (req.source === 'chat' && !req.explicitUserConsent) {
    const auditId = logSecurity(
      req.userId,
      'CHAT_CONTEXT_READ',
      'BLOCKED',
      'تم منع وصول LM AI إلى المحادثة الخاصة لعدم وجود إذن صريح ومشاركة محددة من المستخدم.'
    );
    return {
      ok: false,
      blocked: true,
      blockCategory: 'PRIVACY_CONSENT_REQUIRED',
      reply: '🔒 **حماية خصوصية المحادثات:** لا يملك LM AI صلاحية قراءة محادثاتك الخاصة تلقائيًا. يرجى تحديد الرسالة أو الجزء الذي ترغب في مشاركته ومنح الإذن الصريح أولًا.',
      providerUsed: 'lm-security-firewall',
      modelUsed: 'policy-enforcer-v1',
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  // 2. HARD FINANCIAL ISOLATION FIREWALL
  const normalizedPrompt = normalizeArabicForFilter(prompt);
  for (const rx of FINANCIAL_BLOCK_PATTERNS) {
    if (rx.test(normalizedPrompt)) {
      const auditId = logSecurity(
        req.userId,
        'FINANCIAL_OPERATION_REQUEST',
        'BLOCKED',
        `تم حظر محاولة تنفيذ إجراء مالي عبر الذكاء الاصطناعي: "${prompt.slice(0, 80)}"`
      );
      return {
        ok: false,
        blocked: true,
        blockCategory: 'FINANCIAL_ISOLATION',
        reply: '🛡️ **عزل الصلاحيات المالية (LM Financial Firewall):**\n\nلا يملك المساعد الذكي **LM AI** أي صلاحية لإجراء التحويلات أو تعديل الأرصدة أو تنفيذ المعاملات المالية. هذه السياسة مفروضة على مستوى الخادم لحماية أموالك.\n\nيمكنني مساعدتك في إعداد تقرير تحليلي أو شرح البيانات، بينما تتم أي خطوة مالية بشكل منفصل تمامًا داخل قسم المحفظة.',
        providerUsed: 'lm-security-firewall',
        modelUsed: 'financial-isolation-v1',
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }
  }

  const config = loadProviderConfig();
  const requestedProvider = (req.provider || config.defaultProvider || 'local-smart') as string;
  const fullUserContent = req.sharedContext
    ? `[محتوى تمّت مشاركته صراحةً بإذن المستخدم]:\n${req.sharedContext}\n\n[طلب المستخدم]:\n${prompt}`
    : prompt;

  // Increment usage count
  db.prepare('UPDATE users SET ai_used_today = ai_used_today + 1 WHERE id = ?').run(req.userId);

  const actionLabel = req.source === 'chat' ? 'EXPLICIT_CHAT_SHARE_AI' : req.source === 'post_summary' ? 'POST_SUMMARY_AI' : 'GENERAL_AI_QUERY';
  const auditId = logSecurity(
    req.userId,
    actionLabel,
    'ALLOWED',
    req.sharedContext
      ? 'تم تنفيذ الطلب على المحتوى المشارَك صراحةً فقط مع عزل تام للصلاحيات المالية.'
      : 'طلب مساعد ذكي ضمن الصلاحيات المسموحة (بدون وصول للمحادثات الخاصة أو المحفظة).'
  );

  try {
    // PROVIDER 1: Google Gemini via official @google/genai Interactions API
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
        providerUsed: 'Google Gemini (@google/genai)',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // PROVIDER 2: OpenAI
    if (requestedProvider === 'openai' && config.openaiApiKey) {
      const model = req.model || 'gpt-4o-mini';
      const messages: unknown[] = [
        { role: 'system', content: LM_AI_SYSTEM_PROMPT },
        req.imageBase64
          ? {
              role: 'user',
              content: [
                { type: 'text', text: fullUserContent },
                { type: 'image_url', image_url: { url: `data:${req.imageMimeType || 'image/png'};base64,${req.imageBase64}` } },
              ],
            }
          : { role: 'user', content: fullUserContent },
      ];
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({ model, messages }),
      });
      const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!resp.ok) throw new Error(data.error?.message || `OpenAI HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.choices?.[0]?.message?.content || '',
        providerUsed: 'OpenAI API',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // PROVIDER 3: Anthropic Claude
    if (requestedProvider === 'anthropic' && config.anthropicApiKey) {
      const model = req.model || 'claude-3-5-sonnet-latest';
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
      if (!resp.ok) throw new Error(data.error?.message || `Anthropic HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.content?.[0]?.text || '',
        providerUsed: 'Anthropic Claude API',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // PROVIDER 4: OpenRouter (200+ open-source & frontier models)
    if (requestedProvider === 'openrouter' && config.openrouterApiKey) {
      const model = req.model || 'meta-llama/llama-3.3-70b-instruct';
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'LM Super App',
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
      if (!resp.ok) throw new Error(data.error?.message || `OpenRouter HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.choices?.[0]?.message?.content || '',
        providerUsed: 'OpenRouter Multi-Model Gateway',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // PROVIDER 5: Groq
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
      if (!resp.ok) throw new Error(data.error?.message || `Groq HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.choices?.[0]?.message?.content || '',
        providerUsed: 'Groq Fast Inference',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }

    // PROVIDER 6: Local Ollama (from LM Blueprint)
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
      if (!resp.ok) throw new Error(data.error || `Ollama HTTP ${resp.status}`);
      return {
        ok: true,
        reply: data.message?.content || '',
        providerUsed: 'Ollama (Local Open-Source)',
        modelUsed: model,
        latencyMs: Date.now() - start,
        securityAuditId: auditId,
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: true,
      reply: `⚠️ تعذر الاتصال بالمزود الخارجي (${requestedProvider}): ${errMsg}\n\n---\n**الرد عبر محرك LM المحلي الاحتياطي:**\n${generateLocalSmartReply(prompt, req.sharedContext, Boolean(req.imageBase64))}`,
      providerUsed: `Fallback (${requestedProvider} unreachable)`,
      modelUsed: 'lm-local-engine',
      latencyMs: Date.now() - start,
      securityAuditId: auditId,
    };
  }

  // DEFAULT: Zero-Key Local Smart Engine (queries real SQLite LM platform data!)
  return {
    ok: true,
    reply: generateLocalSmartReply(prompt, req.sharedContext, Boolean(req.imageBase64)),
    providerUsed: 'LM Local Smart Engine (Zero-Key)',
    modelUsed: 'lm-context-v1',
    latencyMs: Date.now() - start,
    securityAuditId: auditId,
  };
}

function generateLocalSmartReply(prompt: string, sharedContext?: string, hasImage?: boolean): string {
  const lower = prompt.toLowerCase();

  // 1. Summarization of explicitly shared post/video/chat
  if (sharedContext) {
    const clean = sharedContext.replace(/\s+/g, ' ').trim();
    const preview = clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
    const words = clean.split(' ').length;
    return [
      `**ملخص المحتوى المُشارَك بإذنك (${words} كلمة):**`,
      `• **الفكرة الأساسية:** ${preview}`,
      `• **نطاق الوصول:** تمت معالجة النص الذي اخترت مشاركته فقط دون الاطلاع على أي محادثات أخرى.`,
      `• **إجراء مقترح:** يمكنك الآن صياغة رد مختصر، أو حفظ النقاط الرئيسية، أو طرح سؤال متابعة حول هذا المحتوى.`,
      `\n> *ملاحظة: أضف مفتاح API من (إعدادات → مركز الـ APIs) لتفعيل نماذج Gemini / OpenAI / Claude / Ollama مباشرة.*`,
    ].join('\n');
  }

  // 2. Image analysis in zero-key mode
  if (hasImage) {
    return [
      '**تم استلام الصورة بنجاح في LM AI:**',
      '• تم فحص الملف محليًا وتجهيزه بترميز Base64 جاهز للإرسال لنماذج الرؤية متعددة الوسائط.',
      '• لتفعيل التحليل البصري العميق للصور والملفات، أضف مفتاح **Gemini API** (يدعم `gemini-4-hydrogen`) أو **OpenAI API** من قسم **مركز الـ APIs** في القائمة الجانبية — وسيعمل التحليل الفوري فورًا بدون إعادة تشغيل.',
    ].join('\n');
  }

  // 3. Live Platform Search inside LM SQLite database!
  if (lower.includes('ابحث') || lower.includes('دور') || lower.includes('مين') || lower.includes('search') || lower.includes('find') || lower.includes('صفحات') || lower.includes('حسابات')) {
    const users = db.prepare('SELECT display_name, username, vip_tier, rank_id, bio FROM users LIMIT 5').all() as Array<Record<string, unknown>>;
    const groups = db.prepare('SELECT title, member_count FROM conversations WHERE type != ? LIMIT 3').all('dm') as Array<Record<string, unknown>>;
    const userLines = users.map(u => `• **${u.display_name}** (@${u.username}) — ${Number(u.vip_tier) > 0 ? `VIP ${u.vip_tier}` : 'حساب قياسي'}`).join('\n');
    const groupLines = groups.map(g => `• **${g.title}** (${Number(g.member_count).toLocaleString('en-US')} عضو)`).join('\n');
    return `**نتائج البحث الحية داخل منصة LM:**\n\n**حسابات وصناع محتوى مقترحون:**\n${userLines}\n\n**مجتمعات ومجموعات نشطة:**\n${groupLines}\n\nيمكنك الانتقال لأي حساب أو مجتمع مباشرة من شريط البحث السريع (\`Ctrl+K\`).`;
  }

  // 4. Drafting messages
  if (lower.includes('صياغ') || lower.includes('رسالة') || lower.includes('رد') || lower.includes('اكتب') || lower.includes('draft')) {
    return [
      '**صياغة مقترحة جاهزة للإرسال:**',
      '',
      '> "أهلاً بك! شكرًا لتواصلك عبر منصة LM. راجعت التفاصيل المقترحة وأقترح أن نحدد موعدًا قصيرًا اليوم لمناقشة الخطوات القادمة وتوحيد الرؤية. في انتظار تأكيدك بالوقت الأنسب لك."',
      '',
      'هل تفضل نسخة أكثر رسمية أم مختصرة أكثر؟',
    ].join('\n');
  }

  // 5. VIP / Platform help
  if (lower.includes('vip') || lower.includes('تعليق') || lower.includes('مميز') || lower.includes('سعر') || lower.includes('إمبراطور')) {
    return [
      '**ملخص منظومة VIP والرتب داخل LM:**',
      '• **التعليقات المميزة في البث المباشر:** VIP 1 (15 ثانية • أولوية #1)، VIP 2 (10 ثوانٍ • أولوية #2)، VIP 3 (5 ثوانٍ • أولوية #3).',
      '• **التخصيص والمظهر:** VIP 4 يتيح تغيير الأيقونة، VIP 3 يضيف تخصيص الاسم والثيمات الحصرية، وVIP 1 يفتح أعلى تخصيص في 4 أقسام.',
      '• **التسعير الجغرافي:** يُحسب حسب بلد الإقامة مع استثناء السفر المؤقت (شهران) وفترة التحقق 3 أشهر + شهر سماح قبل تغيير العملة في التجديد القادم.',
    ].join('\n');
  }

  // 6. General intelligent response
  return [
    `تم استلام استفسارك داخل **LM AI**: _"${prompt}"_`,
    '',
    'يمكنني مساعدتك الآن مباشرةً في:',
    '• **البحث داخل LM:** جرّب كتابة _"ابحث عن الحسابات والمجتمعات النشطة"_',
    '• **تلخيص المحتوى:** اضغط زر **"تلخيص بـ LM AI"** على أي منشور أو فيديو، أو شارك رسالة محددة من الشات عبر `@LM AI`.',
    '• **صياغة الرسائل:** اكتب _"ساعدني في صياغة رسالة احترافية لـ..."_',
    '• **اختبار الأمان المالي:** جرّب كتابة _"حوّل 500 جنيه إلى كريم"_ لترى جدار الحماية المالي يعمل لحظيًا!',
    '',
    'لربط قدرات الذكاء الاصطناعي الكاملة، أضف أي مفتاح API (**Gemini / OpenAI / Claude / OpenRouter / Groq / Ollama**) من **مركز الـ APIs** في الشريط الجانبي.',
  ].join('\n');
}
