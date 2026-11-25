import React, { useEffect, useState, useCallback } from 'react';
import {
  Crown,
  Palette,
  Award,
  Globe2,
  ShieldCheck,
  Check,
  Sparkles,
  Plane,
  Ban,
  Cpu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { AiTierId, COUNTRY_META, CountryCode, RankId, ThemeId, UserProfile, VipTier } from '../../types';
import { APP_ICON_STYLES, LmBrandMark } from '../shared/LmBrandMark';
import { VipArtifact3D } from '../shared/Spatial3D';

interface CatalogData {
  country: CountryCode;
  vipPlans: Array<{
    tier: VipTier;
    nameAr: string;
    nameEn: string;
    egpMonthly: number;
    highlightSec: number;
    perksAr: string[];
    perksEn: string[];
    localized: { amount: number; formatted: string; currency: string };
  }>;
  prioritySupport: { egpMonthly: number; localized: { formatted: string } };
  adRemovalPlans: Array<{ id: 'videos' | 'largeGroups' | 'ai' | 'investment'; nameAr: string; nameEn: string; localized: { formatted: string } }>;
  adRemovalTotal: { formatted: string };
  aiPlans: Array<{ id: AiTierId; nameAr: string; nameEn: string; dailyLimit: number; featuresAr: string[]; localized: { amount: number; formatted: string } }>;
  ranks: Array<{ id: RankId; nameAr: string; nameEn: string; tier: 'standard' | 'supreme'; accent: string; localized: { amount: number; formatted: string } }>;
}

const THEMES: Array<{ id: ThemeId; nameAr: string; nameEn: string; minVip: number; swatch: string }> = [
  { id: 'obsidian', nameAr: 'أوبسيديان LM (الأساسي)', nameEn: 'LM Obsidian', minVip: 0, swatch: '#2F6BFF' },
  { id: 'alabaster', nameAr: 'نهاري مصقول (Light)', nameEn: 'Alabaster Light', minVip: 0, swatch: '#E2E8F0' },
  { id: 'royal-gold', nameAr: 'ذهبي ملكي (VIP 3+)', nameEn: 'Royal Gold (VIP 3+)', minVip: 3, swatch: '#D4AF37' },
  { id: 'emerald-reserve', nameAr: 'زمردي خاص (VIP 3+)', nameEn: 'Emerald Reserve (VIP 3+)', minVip: 3, swatch: '#10B981' },
  { id: 'imperial-onyx', nameAr: 'أونيكس بلاتيني (VIP 1)', nameEn: 'Imperial Onyx (VIP 1)', minVip: 1, swatch: '#F8FAFC' },
];

export function VipStoreView() {
  const { user, lang, setUserLocal, toast } = useApp();
  const isAr = lang === 'ar';

  const [subTab, setSubTab] = useState<'vip' | 'ranks' | 'ads' | 'geo'>('vip');
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [customName, setCustomName] = useState(user?.customAppName || 'LM');

  // Geo Residency Simulator state
  const [simTargetCountry, setSimTargetCountry] = useState<CountryCode>('US');
  const [simMonths, setSimMonths] = useState<number>(2);
  const [simTravelExempt, setSimTravelExempt] = useState<boolean>(true);
  const [simEvaluation, setSimEvaluation] = useState<{
    status: string;
    billingCountry: CountryCode;
    messageAr: string;
    messageEn: string;
    nextRenewalSwitch: boolean;
  } | null>(null);

  const loadCatalog = useCallback(async (country: CountryCode) => {
    const data = await api<CatalogData>(`/api/pricing/catalog?country=${country}`);
    setCatalog(data);
  }, []);

  useEffect(() => {
    if (user?.country) {
      loadCatalog(user.country);
      setCustomName(user.customAppName || 'LM');
    }
  }, [user?.country, user?.customAppName, loadCatalog]);

  useEffect(() => {
    if (!user) return;
    api<{ evaluation: NonNullable<typeof simEvaluation> }>('/api/pricing/simulate-residency', {
      method: 'POST',
      body: JSON.stringify({
        currentCountry: user.country,
        targetCountry: simTargetCountry,
        monthsAbroad: simMonths,
        travelExceptionActive: simTravelExempt,
      }),
    })
      .then(d => setSimEvaluation(d.evaluation))
      .catch(() => {});
  }, [user?.country, simTargetCountry, simMonths, simTravelExempt, user]);

  if (!user || !catalog) return null;

  const hasVipAccess = (minVip: number) => {
    if (minVip === 0) return true;
    return user.vipTier > 0 && user.vipTier <= minVip;
  };

  async function activateVip(tier: VipTier) {
    if (!user) return;
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/activate-vip`, {
      method: 'POST',
      body: JSON.stringify({ vipTier: tier }),
    });
    setUserLocal(res.user);
    toast(
      tier === 0
        ? (isAr ? 'تم التبديل للباقة المجانية للتجربة' : 'Switched to Free tier')
        : (isAr ? `تم تفعيل عضوية VIP ${tier} فورًا في وضع التجربة` : `VIP ${tier} activated in demo mode`),
      'success'
    );
  }

  async function togglePrioritySupport() {
    if (!user) return;
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/activate-vip`, {
      method: 'POST',
      body: JSON.stringify({ prioritySupport: !user.prioritySupport }),
    });
    setUserLocal(res.user);
    toast(
      res.user.prioritySupport
        ? (isAr ? 'تم تفعيل مستوى الدعم والأولوية الأعلى' : 'Priority Support Tier enabled')
        : (isAr ? 'تم إيقاف مستوى الدعم الإضافي' : 'Priority Support disabled'),
      'success'
    );
  }

  async function activateAiTier(aiTier: AiTierId) {
    if (!user) return;
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/activate-vip`, {
      method: 'POST',
      body: JSON.stringify({ aiTier }),
    });
    setUserLocal(res.user);
    toast(isAr ? 'تم تحديث باقة LM AI بنجاح' : 'LM AI tier updated', 'success');
  }

  async function activateRank(rankId: RankId) {
    if (!user) return;
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/activate-rank`, {
      method: 'POST',
      body: JSON.stringify({ rankId }),
    });
    setUserLocal(res.user);
    toast(isAr ? 'تم تفعيل الرتبة / اللقب في ملفك الشخصي' : 'Rank/Title updated', 'success');
  }

  async function toggleAdRemoval(key: 'videos' | 'largeGroups' | 'ai' | 'investment') {
    if (!user) return;
    const next = { ...user.adRemoval, [key]: !user.adRemoval[key] };
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/ad-removal`, {
      method: 'POST',
      body: JSON.stringify({ adRemoval: next }),
    });
    setUserLocal(res.user);
    toast(isAr ? 'تم تحديث إعدادات إزالة إعلانات المنصة فورًا' : 'Platform ad settings updated', 'success');
  }

  async function applyCustomization(patch: { theme?: ThemeId; customAppIcon?: string; customAppName?: string; country?: CountryCode }) {
    if (!user) return;
    const res = await api<{ user: UserProfile }>(`/api/users/${user.id}/customize`, {
      method: 'POST',
      body: JSON.stringify(patch),
    });
    setUserLocal(res.user);
    if (patch.country) await loadCatalog(patch.country);
    toast(isAr ? 'تم حفظ التخصيص وتطبيقه مباشرة على التطبيق' : 'Customization applied live', 'success');
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-5">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header & Sub-Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#D4AF37]" />
              {isAr ? 'منظومة VIP، الرتب، التخصيص، والتسعير الجغرافي' : 'VIP, Ranks, Customization & Geo-Pricing'}
            </h1>
            <p className="text-xs text-[var(--lm-text-secondary)] mt-0.5">
              {isAr
                ? `الأسعار المعروضة محسوبة تلقائيًا بعملة بلد إقامتك: ${COUNTRY_META[user.country].flag} ${COUNTRY_META[user.country].ar} (${COUNTRY_META[user.country].currency})`
                : `Prices dynamically localized for ${COUNTRY_META[user.country].flag} ${COUNTRY_META[user.country].en} (${COUNTRY_META[user.country].currency})`}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[var(--lm-surface)] border border-[var(--lm-border)]">
            {[
              { id: 'vip', labelAr: 'عضويات VIP والتخصيص', labelEn: 'VIP & Themes', icon: Crown },
              { id: 'ranks', labelAr: 'الرتب والألقاب', labelEn: 'Ranks & Titles', icon: Award },
              { id: 'ads', labelAr: 'الإعلانات وLM AI', labelEn: 'Ads & AI Plans', icon: Cpu },
              { id: 'geo', labelAr: 'التسعير الجغرافي', labelEn: 'Geo-Pricing', icon: Globe2 },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id as typeof subTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                    subTab === t.id
                      ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)] font-semibold'
                      : 'text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {isAr ? t.labelAr : t.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* SUB-TAB 1: VIP 5 -> VIP 1 + PRIORITY + LIVE CUSTOMIZER */}
        {subTab === 'vip' && (
          <div className="space-y-5">
            {/* 3D Interactive Prestige Showcase Banner */}
            <div className="lm-card rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <VipArtifact3D tier={user.vipTier || 1} size={130} />
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono-num uppercase tracking-wider text-[#F5C451]">
                    3D Interactive Prestige • Drag to Rotate
                  </span>
                  <h2 className="text-xl font-extrabold">
                    {user.vipTier ? `VIP ${user.vipTier}` : (isAr ? 'ارتقِ إلى عالم VIP' : 'Unlock LM VIP')}
                  </h2>
                  <p className="text-xs text-[var(--lm-text-secondary)] max-w-md">
                    {isAr
                      ? 'اسحب المجسم ثلاثي الأبعاد لتدويره — تتغير خامته البلورية والذهبية تلقائيًا حسب درجتك.'
                      : 'Drag the 3D crystal artifact — its material dynamically morphs with your active VIP tier.'}
                  </p>
                </div>
              </div>
            </div>

            {/* VIP 5 Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5">
              {catalog.vipPlans.map((plan) => {
                const isCurrent = user.vipTier === plan.tier;
                const isTop = plan.tier === 1;
                return (
                  <div
                    key={plan.tier}
                    className={`rounded-2xl p-4 flex flex-col justify-between border transition-all ${
                      isTop
                        ? 'bg-[#D4AF37]/8 border-[#D4AF37]/45'
                        : isCurrent
                        ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/50'
                        : 'lm-card'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{plan.nameAr}</span>
                        {plan.highlightSec > 0 && (
                          <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#E8C85E] border border-[#D4AF37]/30">
                            {isAr ? `بث ${plan.highlightSec}ث` : `Live ${plan.highlightSec}s`}
                          </span>
                        )}
                      </div>
                      <div className="font-mono-num text-lg font-bold whitespace-nowrap">
                        {plan.localized.formatted}
                        <span className="text-[10px] font-normal text-[var(--lm-text-muted)]"> / {isAr ? 'شهريًا' : 'mo'}</span>
                      </div>
                      <ul className="space-y-2 pt-2 border-t border-[var(--lm-border)]">
                        {(isAr ? plan.perksAr : plan.perksEn).map((perk) => (
                          <li key={perk} className="text-[11px] text-[var(--lm-text-secondary)] flex items-start gap-1.5 leading-snug">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => activateVip(isCurrent ? 0 : plan.tier)}
                      className={`mt-4 w-full py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        isCurrent ? 'lm-btn-ghost' : 'lm-btn-primary'
                      }`}
                    >
                      {isCurrent
                        ? (isAr ? 'العضوية الحالية (إيقاف للتجربة)' : 'Active (Reset)')
                        : (isAr ? `تجربة ${plan.nameAr} فورًا` : `Activate ${plan.nameEn}`)}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Ultra Priority Tier (6,999 EGP) */}
            <div className="lm-card rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-[#D4AF37]/35">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold">
                    {isAr ? 'مستوى الدعم الإضافي والأولوية القصوى (أعلى من VIP 1)' : 'Ultra Support & Priority Tier (Above VIP 1)'}
                  </h3>
                  <span className="font-mono-num text-xs font-bold text-[#E8C85E]">
                    {catalog.prioritySupport.localized.formatted} / {isAr ? 'شهريًا' : 'mo'}
                  </span>
                </div>
                <p className="text-xs text-[var(--lm-text-secondary)] leading-relaxed">
                  {isAr
                    ? 'وصول مبكر للتحديثات ونماذج LM AI الجديدة، أولوية في معالجة ورفع الفيديوهات وفق قدرة الخوادم، أولوية في خدمة العملاء، ورصيد دعم ترويجي (يُعامل كحملة ترويجية واضحة منفصلة عن الانتشار العضوي).'
                    : 'Early updates & AI models, priority video processing queue, concierge support, and clear promotional credits.'}
                </p>
              </div>
              <button
                onClick={togglePrioritySupport}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                  user.prioritySupport ? 'lm-btn-ghost' : 'bg-[#D4AF37] text-[#0B0A08]'
                }`}
              >
                {user.prioritySupport ? (isAr ? 'مفعّل حاليًا ✓' : 'Active ✓') : (isAr ? 'تفعيل تجريبي للأولوية' : 'Enable Priority Tier')}
              </button>
            </div>

            {/* LIVE APP CUSTOMIZER (Icon + Name + Themes) */}
            <div className="lm-card rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[var(--lm-accent)]" />
                  {isAr ? 'تخصيص مظهر التطبيق والأيقونة والاسم (تأثير لحظي)' : 'Live App Customization (Instant Preview)'}
                </h3>
                <span className="text-[11px] text-[var(--lm-text-muted)]">
                  {isAr ? 'الأيقونة: VIP 4+ • الاسم والثيمات: VIP 3+ • أونيكس: VIP 1' : 'Icon: VIP 4+ • Name & Themes: VIP 3+ • Onyx: VIP 1'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Themes */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--lm-text-secondary)]">{isAr ? 'ثيمات التطبيق الداخلية' : 'Interior Themes'}</div>
                  <div className="space-y-1.5">
                    {THEMES.map((t) => {
                      const unlocked = hasVipAccess(t.minVip);
                      const active = user.theme === t.id;
                      return (
                        <button
                          key={t.id}
                          disabled={!unlocked}
                          onClick={() => applyCustomization({ theme: t.id })}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            active
                              ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/50 font-semibold'
                              : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] hover:bg-[var(--lm-surface-hover)]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span style={{ backgroundColor: t.swatch }} className="w-3.5 h-3.5 rounded-full border border-white/20" />
                            {isAr ? t.nameAr : t.nameEn}
                          </span>
                          {active && <Check className="w-3.5 h-3.5 text-[var(--lm-accent)]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. App Icon (VIP 4+) */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--lm-text-secondary)]">
                    {isAr ? 'أيقونة التطبيق الخارجية (VIP 4+)' : 'App Icon Style (VIP 4+)'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(APP_ICON_STYLES).map(([key, meta]) => {
                      const unlocked = key === 'default' || hasVipAccess(4);
                      const active = user.customAppIcon === key;
                      return (
                        <button
                          key={key}
                          disabled={!unlocked}
                          onClick={() => applyCustomization({ customAppIcon: key })}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                            active
                              ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/50'
                              : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] hover:bg-[var(--lm-surface-hover)]'
                          }`}
                        >
                          <LmBrandMark iconStyle={key} size={34} />
                          <span className="text-[10px] truncate max-w-full">{isAr ? meta.labelAr : meta.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Custom App Name (VIP 3+) */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--lm-text-secondary)]">
                    {isAr ? 'تخصيص اسم التطبيق (VIP 3+ حيث يسمح النظام)' : 'Custom App Name (VIP 3+ where OS allows)'}
                  </div>
                  <div className="p-3.5 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] space-y-3">
                    <input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      disabled={!hasVipAccess(3)}
                      maxLength={18}
                      placeholder="LM Imperial"
                      className="lm-input w-full rounded-xl px-3 py-2 text-xs disabled:opacity-45"
                    />
                    <button
                      disabled={!hasVipAccess(3)}
                      onClick={() => applyCustomization({ customAppName: customName.trim() || 'LM' })}
                      className="lm-btn-primary w-full py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40"
                    >
                      {isAr ? 'تطبيق الاسم على الواجهة فورًا' : 'Apply App Name'}
                    </button>
                    <p className="text-[10px] text-[var(--lm-text-muted)] leading-relaxed">
                      {isAr
                        ? 'ملاحظة تقنية: يتغير الاسم فورًا في الويب وأندرويد (عبر Activity Aliases)، بينما يتيح iOS تغيير الأيقونة فقط.'
                        : 'Note: Supported live on Web & Android; iOS allows alternate icons only.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: RANKS & SUPREME TITLES */}
        {subTab === 'ranks' && (
          <div className="space-y-4">
            <div className="lm-card-subtle rounded-2xl p-4 flex items-center gap-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {isAr
                  ? 'مبدأ أساسي في LM: جميع الرتب والألقاب العليا (بما فيها الإمبراطور) تمنح مكانة اجتماعية ومظهرًا فريدًا فقط، ولا تمنح أي سلطة إدارية على حسابات أو بثوث أو محتوى الآخرين.'
                  : 'Core LM Rule: Ranks and supreme titles grant prestige and visual distinction only — zero administrative power over other users.'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {catalog.ranks.map((r) => {
                const active = user.rankId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 ${
                      r.tier === 'supreme'
                        ? 'bg-[#D4AF37]/8 border-[#D4AF37]/40'
                        : 'lm-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono-num uppercase text-[var(--lm-text-muted)]">
                          {r.tier === 'supreme' ? (isAr ? 'لقب أعلى قابل للاختيار' : 'Supreme Selectable Title') : (isAr ? 'رتبة اجتماعية' : 'Social Rank')}
                        </span>
                        <h3 style={{ color: r.accent }} className="text-base font-bold mt-0.5 flex items-center gap-1.5">
                          {r.tier === 'supreme' && <Crown className="w-4 h-4" />}
                          {isAr ? r.nameAr : r.nameEn}
                        </h3>
                      </div>
                      <span className="font-mono-num text-sm font-bold">
                        {r.localized.amount === 0 ? (isAr ? 'افتراضي' : 'Default') : r.localized.formatted}
                      </span>
                    </div>

                    <button
                      onClick={() => activateRank(r.id)}
                      className={`w-full py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        active ? 'lm-btn-ghost' : 'lm-btn-primary'
                      }`}
                    >
                      {active ? (isAr ? 'اللقب المعروض حاليًا ✓' : 'Currently Displayed ✓') : (isAr ? 'اختيار وتجربة اللقب' : 'Select Title')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-TAB 3: MODULAR AD REMOVAL (205 EGP) + AI PLANS */}
        {subTab === 'ads' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Modular Platform Ad Removal */}
            <div className="lg:col-span-6 lm-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Ban className="w-4 h-4 text-[var(--lm-accent)]" />
                    {isAr ? 'إزالة إعلانات المنصة التقليدية' : 'Modular Platform Ad Removal'}
                  </h3>
                  <p className="text-[11px] text-[var(--lm-text-muted)] mt-0.5">
                    {isAr
                      ? `الإجمالي المنفصل: ${catalog.adRemovalTotal.formatted}/شهريًا • لا يُخفي المحتوى الممول من المستخدمين`
                      : `Standalone bundle total: ${catalog.adRemovalTotal.formatted}/mo • Sponsored user posts remain labeled`}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {catalog.adRemovalPlans.map((ad) => {
                  const enabled = user.adRemoval[ad.id];
                  return (
                    <div key={ad.id} className="p-3.5 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold">{isAr ? ad.nameAr : ad.nameEn}</div>
                        <div className="text-[11px] font-mono-num text-[var(--lm-text-muted)] mt-0.5">
                          {ad.localized.formatted} / {isAr ? 'شهريًا' : 'mo'}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAdRemoval(ad.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                          enabled
                            ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                            : 'lm-btn-primary'
                        }`}
                      >
                        {enabled ? (isAr ? 'الإعلانات مُزالة ✓' : 'Ads Removed ✓') : (isAr ? 'تفعيل الإزالة' : 'Remove Ads')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Subscription Tiers (20 / 50 / 100 / 200 EGP) */}
            <div className="lg:col-span-6 lm-card rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  {isAr ? 'باقات اشتراك المساعد الذكي LM AI' : 'LM AI Subscription Tiers'}
                </h3>
                <p className="text-[11px] text-[var(--lm-text-muted)] mt-0.5">
                  {isAr ? 'اختر الباقة المناسبة لحدود الاستخدام اليومي وسرعة المعالجة' : 'Choose your daily request limit and model speed'}
                </p>
              </div>
              <div className="space-y-2">
                {catalog.aiPlans.map((p) => {
                  const active = user.aiTier === p.id;
                  return (
                    <div key={p.id} className="p-3 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span>{isAr ? p.nameAr : p.nameEn}</span>
                          <span className="font-mono-num text-[var(--lm-accent)]">
                            {p.localized.amount === 0 ? (isAr ? 'مجاني' : 'Free') : p.localized.formatted}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--lm-text-secondary)] mt-0.5">
                          {p.featuresAr.join(' • ')}
                        </div>
                      </div>
                      <button
                        onClick={() => activateAiTier(p.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                          active ? 'lm-btn-ghost' : 'lm-btn-primary'
                        }`}
                      >
                        {active ? (isAr ? 'مفعّلة ✓' : 'Active ✓') : (isAr ? 'اختيار' : 'Select')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: GEO-PRICING & RESIDENCY SWITCH SIMULATOR */}
        {subTab === 'geo' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Switch Current Residency Country */}
            <div className="lg:col-span-5 lm-card rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[var(--lm-accent)]" />
                {isAr ? 'بلد الإقامة الحالي (يحدد عملة التسعير)' : 'Active Residency Country'}
              </h3>
              <p className="text-xs text-[var(--lm-text-secondary)] leading-relaxed">
                {isAr
                  ? 'التسعير في LM يُحدد وفق القدرة الشرائية لبلد الإقامة وليس الجنسية. جرّب التبديل بين مصر وأمريكا والخليج وشاهد تغير جميع أسعار VIP والألقاب فورًا.'
                  : 'Pricing reflects local purchasing power by residency, not nationality. Switch markets to see prices recalculate live.'}
              </p>
              <div className="space-y-2">
                {(Object.keys(COUNTRY_META) as CountryCode[]).map((code) => {
                  const m = COUNTRY_META[code];
                  const active = user.country === code;
                  return (
                    <button
                      key={code}
                      onClick={() => applyCustomization({ country: code })}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        active
                          ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/50 font-semibold'
                          : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] hover:bg-[var(--lm-surface-hover)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{m.flag}</span>
                        <span>{isAr ? m.ar : m.en}</span>
                      </span>
                      <span className="font-mono-num text-[var(--lm-text-muted)]">{m.currency}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive 3+1 Month Residency & Travel Exception Simulator */}
            <div className="lg:col-span-7 lm-card rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Plane className="w-4 h-4 text-[#D4AF37]" />
                {isAr ? 'محاكي آلية تغيير العملة واستثناء السفر المؤقت' : 'Currency Switch & Temporary Travel Simulator'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[var(--lm-text-secondary)] mb-1.5">
                    {isAr ? 'الدولة التي سافر إليها المستخدم:' : 'Travel / New Country:'}
                  </label>
                  <select
                    value={simTargetCountry}
                    onChange={(e) => setSimTargetCountry(e.target.value as CountryCode)}
                    className="lm-input w-full rounded-xl px-3 py-2 text-xs"
                  >
                    {(Object.keys(COUNTRY_META) as CountryCode[]).map((c) => (
                      <option key={c} value={c}>
                        {COUNTRY_META[c].flag} {isAr ? COUNTRY_META[c].ar : COUNTRY_META[c].en} ({COUNTRY_META[c].currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[var(--lm-text-secondary)] mb-1.5">
                    {isAr ? `مدة التواجد في الدولة الجديدة: ${simMonths} شهر` : `Duration abroad: ${simMonths} month(s)`}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={simMonths}
                    onChange={(e) => setSimMonths(Number(e.target.value))}
                    className="w-full accent-[var(--lm-accent)]"
                  />
                  <div className="flex justify-between text-[10px] font-mono-num text-[var(--lm-text-muted)]">
                    <span>0m</span>
                    <span>2m ({isAr ? 'سياحة' : 'Travel'})</span>
                    <span>3m ({isAr ? 'تحقق' : 'Check'})</span>
                    <span>4m ({isAr ? 'سماح' : 'Grace'})</span>
                    <span>6m</span>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={simTravelExempt}
                  onChange={(e) => setSimTravelExempt(e.target.checked)}
                />
                <span>
                  {isAr
                    ? 'تقديم طلب استثناء سفر مؤقت (مثل السياحة لمدة شهرين مع مستندات الإثبات)'
                    : 'Submit temporary travel exemption request (e.g. 2-month tourism with proof)'}
                </span>
              </label>

              {simEvaluation && (
                <div
                  className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                    simEvaluation.nextRenewalSwitch
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-emerald-500/10 border-emerald-500/35'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {simEvaluation.nextRenewalSwitch
                        ? (isAr ? 'إشعار: تغيير العملة عند التجديد القادم' : 'Notice: Switch at Next Renewal')
                        : (isAr ? 'الاحتفاظ بعملة الإقامة الأصلية' : 'Original Currency Retained')}
                    </span>
                    <span className="font-mono-num px-2 py-0.5 rounded bg-black/25">
                      {COUNTRY_META[simEvaluation.billingCountry].flag} {COUNTRY_META[simEvaluation.billingCountry].currency}
                    </span>
                  </div>
                  <p>{isAr ? simEvaluation.messageAr : simEvaluation.messageEn}</p>
                </div>
              )}

              {/* Policy Steps Visual */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-center text-[10px]">
                {[
                  { step: '1', label: isAr ? 'استثناء سفر مؤقت' : 'Travel Exempt', active: simMonths <= 2 && simTravelExempt },
                  { step: '2', label: isAr ? 'التحقق بعد 3 أشهر' : '3-Month Check', active: simMonths === 3 },
                  { step: '3', label: isAr ? 'شهر سماح إضافي' : '+1 Mo Grace', active: simMonths === 3 },
                  { step: '4', label: isAr ? 'تبديل عند التجديد' : 'Next Renewal', active: simMonths >= 4 },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-2 rounded-xl border ${
                      s.active ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/45 font-semibold' : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] text-[var(--lm-text-muted)]'
                    }`}
                  >
                    <div className="font-mono-num">#{s.step}</div>
                    <div className="mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
