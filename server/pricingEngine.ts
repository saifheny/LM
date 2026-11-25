import { CountryCode, RankId, VipTier, AiTierId } from './types.ts';

export interface MarketCurrency {
  code: CountryCode;
  nameAr: string;
  nameEn: string;
  currency: string;
  symbol: string;
  flag: string;
  // Purchasing-power multiplier relative to EGP base price
  multiplier: number;
  roundTo: number;
}

export const MARKETS: Record<CountryCode, MarketCurrency> = {
  EG: {
    code: 'EG',
    nameAr: 'مصر',
    nameEn: 'Egypt',
    currency: 'EGP',
    symbol: 'ج.م',
    flag: '🇪🇬',
    multiplier: 1,
    roundTo: 1,
  },
  SA: {
    code: 'SA',
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    currency: 'SAR',
    symbol: 'ر.س',
    flag: '🇸🇦',
    multiplier: 0.14,
    roundTo: 1,
  },
  AE: {
    code: 'AE',
    nameAr: 'الإمارات',
    nameEn: 'UAE',
    currency: 'AED',
    symbol: 'د.إ',
    flag: '🇦🇪',
    multiplier: 0.15,
    roundTo: 1,
  },
  US: {
    code: 'US',
    nameAr: 'الولايات المتحدة',
    nameEn: 'United States',
    currency: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    multiplier: 0.045, // Purchasing-power adjusted (not naive FX)
    roundTo: 0.99,
  },
  EU: {
    code: 'EU',
    nameAr: 'الاتحاد الأوروبي',
    nameEn: 'European Union',
    currency: 'EUR',
    symbol: '€',
    flag: '🇪🇺',
    multiplier: 0.04,
    roundTo: 0.99,
  },
};

export function localizePrice(egpBase: number, country: CountryCode): { amount: number; formatted: string; currency: string } {
  const m = MARKETS[country] || MARKETS.EG;
  if (country === 'EG') {
    return {
      amount: egpBase,
      formatted: `${egpBase.toLocaleString('en-US')} ${m.symbol}`,
      currency: m.currency,
    };
  }
  const raw = egpBase * m.multiplier;
  let amount: number;
  if (m.roundTo === 0.99) {
    amount = Math.max(0.99, Math.round(raw) - 0.01);
    amount = Number(amount.toFixed(2));
  } else {
    amount = Math.max(1, Math.round(raw));
  }
  const formatted =
    m.currency === 'USD' || m.currency === 'EUR'
      ? `${m.symbol}${amount.toLocaleString('en-US')}`
      : `${amount.toLocaleString('en-US')} ${m.symbol}`;
  return { amount, formatted, currency: m.currency };
}

export const VIP_PLANS: Array<{
  tier: VipTier;
  nameAr: string;
  nameEn: string;
  egpMonthly: number;
  highlightSec: 0 | 5 | 10 | 15;
  perksAr: string[];
  perksEn: string[];
}> = [
  {
    tier: 5,
    nameAr: 'VIP 5',
    nameEn: 'VIP 5',
    egpMonthly: 135,
    highlightSec: 0,
    perksAr: [
      'يحافظ على الشكل الأساسي الأنيق لتطبيق LM',
      'إزالة إعلانات المنصة الأساسية تلقائيًا',
      'تعليقات عادية في البث المباشر',
      'شارة VIP 5 خفيفة في الملف الشخصي',
    ],
    perksEn: [
      'Preserves the signature LM minimalist design',
      'Removes standard platform ads automatically',
      'Standard comments in Live streams',
      'Subtle VIP 5 profile badge',
    ],
  },
  {
    tier: 4,
    nameAr: 'VIP 4',
    nameEn: 'VIP 4',
    egpMonthly: 235,
    highlightSec: 0,
    perksAr: [
      'تغيير أيقونة التطبيق الخارجية من مكتبة الأيقونات',
      'ظهور شارة VIP 4 مميزة على الحساب والمنشورات',
      'كل مزايا VIP 5 وإزالة الإعلانات',
      'تعليقات عادية في البث المباشر',
    ],
    perksEn: [
      'Custom external App Icon selector',
      'Distinct VIP 4 badge across profile and posts',
      'All VIP 5 & ad-removal benefits',
      'Standard comments in Live streams',
    ],
  },
  {
    tier: 3,
    nameAr: 'VIP 3',
    nameEn: 'VIP 3',
    egpMonthly: 700,
    highlightSec: 5,
    perksAr: [
      'تعليقات مميزة في البث المباشر لمدة 5 ثوانٍ (أولوية رقم 3)',
      'تخصيص اسم التطبيق وأيقونته (حيث تسمح أنظمة التشغيل)',
      'ثيمات وألوان حصرية داخل التطبيق (الذهبي / الزمردي)',
      'كل مزايا VIP 4 و5',
    ],
    perksEn: [
      'Live Highlighted Comments for 5 seconds (Priority #3)',
      'Custom App Name & Icon (where OS permits)',
      'Exclusive interior themes (Royal Gold / Emerald)',
      'All VIP 4 & 5 perks',
    ],
  },
  {
    tier: 2,
    nameAr: 'VIP 2',
    nameEn: 'VIP 2',
    egpMonthly: 1350, // Proposed range 1,100 - 1,999 EGP
    highlightSec: 10,
    perksAr: [
      'تعليقات مميزة في البث المباشر لمدة 10 ثوانٍ (أولوية رقم 2)',
      'تخصيص أعمق للمظهر وتجربة الاستخدام',
      'امتيازات وتحسينات في قسمين من أقسام LM',
      'كل مزايا VIP 3',
    ],
    perksEn: [
      'Live Highlighted Comments for 10 seconds (Priority #2)',
      'Deeper interface and interaction customization',
      'Enhanced privileges across 2 platform sections',
      'All VIP 3 perks',
    ],
  },
  {
    tier: 1,
    nameAr: 'VIP 1',
    nameEn: 'VIP 1',
    egpMonthly: 1999,
    highlightSec: 15,
    perksAr: [
      'تعليقات مميزة في البث المباشر لمدة 15 ثانية (أعلى أولوية #1)',
      'تخصيص كامل ومزايا حصرية في 4 أقسام من المنصة',
      'ثيم Imperial Onyx الحصري ولمعة البلاتين',
      'أولوية في بعض خدمات المنصة وسرعة الاستجابة',
    ],
    perksEn: [
      'Live Highlighted Comments for 15 seconds (Top Priority #1)',
      'Full customization across 4 platform sections',
      'Exclusive Imperial Onyx Platinum theme',
      'Priority access across core platform services',
    ],
  },
];

export const PRIORITY_SUPPORT_EGP = 6999;

export const AD_REMOVAL_PLANS = [
  { id: 'videos', nameAr: 'إزالة إعلانات الفيديوهات القصيرة', nameEn: 'Remove Short Video Ads', egpMonthly: 100 },
  { id: 'largeGroups', nameAr: 'إزالة إعلانات المجموعات الكبيرة', nameEn: 'Remove Large Group Ads', egpMonthly: 50 },
  { id: 'ai', nameAr: 'إزالة إعلانات قسم LM AI', nameEn: 'Remove LM AI Ads', egpMonthly: 50 },
  { id: 'investment', nameAr: 'إزالة إعلانات قسم الاستثمار', nameEn: 'Remove Investment Ads', egpMonthly: 5 },
] as const;

export const AI_PLANS: Array<{
  id: AiTierId;
  nameAr: string;
  nameEn: string;
  egpMonthly: number;
  dailyLimit: number;
  featuresAr: string[];
}> = [
  {
    id: 'free',
    nameAr: 'الباقة المجانية',
    nameEn: 'Free Tier',
    egpMonthly: 0,
    dailyLimit: 15,
    featuresAr: ['15 طلب يوميًا', 'بحث داخل المنصة وصياغة رسائل', 'لا يقرأ المحادثات الخاصة تلقائيًا'],
  },
  {
    id: 'ai_20',
    nameAr: 'LM AI أساسي',
    nameEn: 'LM AI Starter',
    egpMonthly: 20,
    dailyLimit: 60,
    featuresAr: ['60 طلب يوميًا بنماذج سريعة', 'تلخيص المنشورات والفيديوهات', 'استدعاء @LM AI داخل الشات بإذنك'],
  },
  {
    id: 'ai_50',
    nameAr: 'LM AI بلس',
    nameEn: 'LM AI Plus',
    egpMonthly: 50,
    dailyLimit: 180,
    featuresAr: ['180 طلب يوميًا', 'تحليل الصور والمستندات', 'تلخيص المجموعات بعد موافقة المستخدم'],
  },
  {
    id: 'ai_100',
    nameAr: 'LM AI برو',
    nameEn: 'LM AI Pro',
    egpMonthly: 100,
    dailyLimit: 500,
    featuresAr: ['500 طلب يوميًا بأولوية سرعة', 'ربط نماذج متعددة + بحث موسع', 'تحليل متقدم للصور والملفات'],
  },
  {
    id: 'ai_200',
    nameAr: 'LM AI ألترا',
    nameEn: 'LM AI Ultra',
    egpMonthly: 200,
    dailyLimit: 2000,
    featuresAr: ['2,000 طلب يوميًا بأقصى سرعة', 'الوصول المبكر لأحدث النماذج', 'أدوات متقدمة لتحليل البيانات والتقارير'],
  },
];

export const RANKS: Array<{
  id: RankId;
  nameAr: string;
  nameEn: string;
  tier: 'standard' | 'supreme';
  egpPrice: number;
  accent: string;
}> = [
  { id: 'soldier', nameAr: 'جندي', nameEn: 'Soldier', tier: 'standard', egpPrice: 0, accent: '#71717A' },
  { id: 'pfc', nameAr: 'جندي أول', nameEn: 'Private First Class', tier: 'standard', egpPrice: 150, accent: '#94A3B8' },
  { id: 'sergeant', nameAr: 'رقيب', nameEn: 'Sergeant', tier: 'standard', egpPrice: 450, accent: '#38BDF8' },
  { id: 'colonel', nameAr: 'عقيد', nameEn: 'Colonel', tier: 'standard', egpPrice: 1200, accent: '#818CF8' },
  { id: 'general', nameAr: 'جنرال', nameEn: 'General', tier: 'standard', egpPrice: 3500, accent: '#34D399' },
  { id: 'prince', nameAr: 'أمير', nameEn: 'Prince', tier: 'standard', egpPrice: 8500, accent: '#F59E0B' },
  { id: 'king', nameAr: 'الملك', nameEn: 'The King', tier: 'supreme', egpPrice: 15000, accent: '#EAB308' },
  { id: 'president', nameAr: 'الرئيس', nameEn: 'The President', tier: 'supreme', egpPrice: 18500, accent: '#E2E8F0' },
  { id: 'emperor', nameAr: 'الإمبراطور', nameEn: 'The Emperor', tier: 'supreme', egpPrice: 25000, accent: '#D4AF37' },
];

export function evaluateResidencyPolicy(params: {
  currentCountry: CountryCode;
  targetCountry: CountryCode | null;
  monthsAbroad: number;
  travelExceptionActive: boolean;
}) {
  const { currentCountry, targetCountry, monthsAbroad, travelExceptionActive } = params;
  if (!targetCountry || targetCountry === currentCountry) {
    return {
      status: 'local',
      billingCountry: currentCountry,
      messageAr: `تسعيرك الحالي محسوب بعملة بلد إقامتك (${MARKETS[currentCountry].nameAr} — ${MARKETS[currentCountry].currency}).`,
      messageEn: `Billing is locked to your residency country (${MARKETS[currentCountry].nameEn} — ${MARKETS[currentCountry].currency}).`,
      nextRenewalSwitch: false,
    };
  }
  if (travelExceptionActive && monthsAbroad <= 2) {
    return {
      status: 'travel-exempt',
      billingCountry: currentCountry,
      messageAr: `استثناء السفر المؤقت مفعّل (${monthsAbroad} شهر في ${MARKETS[targetCountry].nameAr}). يحتفظ اشتراكك بعملة ${MARKETS[currentCountry].currency} بدون أي تغيير.`,
      messageEn: `Temporary travel exemption active (${monthsAbroad} mo in ${MARKETS[targetCountry].nameEn}). Your plan stays in ${MARKETS[currentCountry].currency}.`,
      nextRenewalSwitch: false,
    };
  }
  if (monthsAbroad < 3) {
    return {
      status: 'monitoring',
      billingCountry: currentCountry,
      messageAr: `تم رصد تواجدك في ${MARKETS[targetCountry].nameAr} لمدة ${monthsAbroad} شهر. لا يتغير السعر قبل التحقق بعد 3 أشهر.`,
      messageEn: `Detected ${monthsAbroad} month(s) in ${MARKETS[targetCountry].nameEn}. Pricing does not change before the 3-month residency check.`,
      nextRenewalSwitch: false,
    };
  }
  if (monthsAbroad === 3) {
    return {
      status: 'grace-period',
      billingCountry: currentCountry,
      messageAr: `مرت 3 أشهر في ${MARKETS[targetCountry].nameAr}. لديك الآن شهر إضافي كفترة سماح قبل تطبيق عملة ${MARKETS[targetCountry].currency} (أو تقديم إثبات سفر مؤقت).`,
      messageEn: `3 months reached in ${MARKETS[targetCountry].nameEn}. You now have a 1-month grace period before billing moves to ${MARKETS[targetCountry].currency}.`,
      nextRenewalSwitch: false,
    };
  }
  return {
    status: 'switch-next-renewal',
    billingCountry: targetCountry,
    messageAr: `استمرت الإقامة في ${MARKETS[targetCountry].nameAr} لأكثر من 4 أشهر (3 أشهر + شهر سماح). سيتم احتساب التجديد القادم بعملة ${MARKETS[targetCountry].currency} فقط، وليس بأثر رجعي.`,
    messageEn: `Residency in ${MARKETS[targetCountry].nameEn} exceeded 4 months (3 + 1 grace). Your NEXT renewal will bill in ${MARKETS[targetCountry].currency} — never retroactively.`,
    nextRenewalSwitch: true,
  };
}
