/**
 * 100% Free Multi-Source Live Internet Search Helper for LM AI ($0 cost, ZERO API keys!)
 * Uses:
 * 1. DuckDuckGo Instant Answer & HTML Lite search (live web snippets & URLs)
 * 2. Wikipedia OpenSearch + Summary REST API (Arabic & English up-to-date encyclopedia facts)
 * Always runs with strict timeouts so AI replies stay snappy.
 */

export interface LiveWebSnippet {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

const SKIP_SEARCH_RX = /^(اهلا|أهلا|مرحبا|مرحبًا|سلام|السلام عليكم|ازيك|إزيك|عامل ايه|شكرا|شكرًا|تمام|حاضر|ماشي|hi|hello|hey|thanks|ok|okay|good morning|good night)[\s!؟?.]*$/i;

const LIVE_INFO_TRIGGERS = [
  /اليوم|الان|الآن|النهارده|النهاردة|حديث|جديد|اخبار|أخبار|عاجل|سعر|اسعار|أسعار|دولار|ذهب|طقس|درجة الحرارة|مباراة|مباريات|نتيجة|بطولة|كاس|كأس|الدوري|من هو|من هي|ما هو|ما هي|كم سعر|متى|موعد|احدث|أحدث|في العالم|بحث|ابحث|انترنت|إنترنت|2025|2026|2027/i,
  /\b(today|now|latest|news|breaking|price|rate|weather|score|match|who is|what is|when is|current|search|internet|update|release|2025|2026|2027)\b/i,
];

export function shouldFetchLiveWeb(prompt: string, source?: string): boolean {
  const clean = (prompt || '').trim();
  if (clean.length < 4) return false;
  if (source === 'video_summary' || source === 'post_summary') return false;
  if (SKIP_SEARCH_RX.test(clean)) return false;
  if (LIVE_INFO_TRIGGERS.some(rx => rx.test(clean))) return true;
  // Also search for informational questions ending with '?' / '؟' that are >= 14 chars
  if (clean.length >= 14 && /[?؟]$/.test(clean)) return true;
  return false;
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchDuckDuckGoLite(query: string): Promise<LiveWebSnippet[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(3600),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: LiveWebSnippet[] = [];

    const titleRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

    const titles: Array<{ url: string; title: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = titleRegex.exec(html)) !== null && titles.length < 5) {
      let href = m[1] || '';
      const uddg = href.match(/uddg=([^&]+)/);
      if (uddg) {
        try {
          href = decodeURIComponent(uddg[1]);
        } catch {
          // keep raw
        }
      }
      if (/^https?:\/\//i.test(href)) {
        titles.push({ url: href, title: stripHtmlTags(m[2] || '') });
      }
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      snippets.push(stripHtmlTags(m[1] || m[2] || ''));
    }

    for (let i = 0; i < titles.length; i++) {
      if (!titles[i].title) continue;
      results.push({
        title: titles[i].title.slice(0, 140),
        snippet: (snippets[i] || '').slice(0, 260),
        url: titles[i].url,
        source: 'DuckDuckGo',
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string): Promise<LiveWebSnippet[]> {
  const isArabic = /[\u0600-\u06FF]/.test(query);
  const wikiLang = isArabic ? 'ar' : 'en';
  try {
    const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query.slice(0, 100))}&limit=2&namespace=0&format=json`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LM-SuperApp/6.0 (https://lm.app)' },
      signal: AbortSignal.timeout(2600),
    });
    if (!res.ok) return [];
    const arr = (await res.json()) as [string, string[], string[], string[]];
    const titles = arr[1] || [];
    const urls = arr[3] || [];
    const out: LiveWebSnippet[] = [];

    for (let i = 0; i < Math.min(2, titles.length); i++) {
      const title = titles[i];
      if (!title) continue;
      try {
        const sumRes = await fetch(
          `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          {
            headers: { 'User-Agent': 'LM-SuperApp/6.0 (https://lm.app)' },
            signal: AbortSignal.timeout(2200),
          }
        );
        if (sumRes.ok) {
          const sum = (await sumRes.json()) as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
          if (sum.extract) {
            out.push({
              title: sum.title || title,
              snippet: sum.extract.slice(0, 320),
              url: sum.content_urls?.desktop?.page || urls[i] || `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
              source: `Wikipedia (${wikiLang.toUpperCase()})`,
            });
          }
        }
      } catch {
        // skip individual wiki summary timeout
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function gatherLiveWebContext(query: string): Promise<string | null> {
  const clean = query.trim().slice(0, 180);
  if (!clean) return null;

  const [ddg, wiki] = await Promise.all([searchDuckDuckGoLite(clean), searchWikipedia(clean)]);
  const combined = [...ddg, ...wiki].filter(item => item.title && (item.snippet || item.url)).slice(0, 5);
  if (combined.length === 0) return null;

  const lines = combined.map(
    (item, idx) =>
      `${idx + 1}. [${item.title}](${item.url}) (${item.source}): ${item.snippet || 'راجع المصدر للتفاصيل.'}`
  );

  return `[نتائج بحث حية من الإنترنت بتاريخ اليوم — استخدمها لتقديم معلومات حديثة ودقيقة مع ذكر المصادر بإيجاز عند الحاجة]:\n${lines.join('\n')}`;
}
