import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Globe, Lock, ShieldCheck, UserPlus, LogIn } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { COUNTRY_META, CountryCode, UserProfile } from '../../types';
import { LmBrandMark, RankBadge, UserAvatar, VipBadge } from '../shared/LmBrandMark';

export function AuthScreen() {
  const { allUsers, loginUser, lang, setLang, toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('youssef');
  const [password, setPassword] = useState('123456');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState<CountryCode>('EG');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAr = lang === 'ar';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api<{ user: UserProfile }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        loginUser(res.user);
        toast(isAr ? `مرحبًا بعودتك، ${res.user.displayName}` : `Welcome back, ${res.user.displayNameEn}`, 'success');
      } else {
        const res = await api<{ user: UserProfile }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, displayName, password, country }),
        });
        loginUser(res.user);
        toast(isAr ? 'تم إنشاء حسابك الموحد في LM بنجاح' : 'Unified LM account created', 'success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--lm-bg)] text-[var(--lm-text)] flex flex-col">
      {/* Top minimal bar */}
      <header className="h-14 shrink-0 px-6 border-b border-[var(--lm-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LmBrandMark size={32} iconStyle="default" />
          <div>
            <span className="font-bold text-base tracking-tight">LM</span>
            <span className="mx-2 text-[var(--lm-border-strong)]">|</span>
            <span className="text-xs text-[var(--lm-text-secondary)]">
              {isAr ? 'المنظومة الرقمية المتكاملة' : 'Integrated Digital Ecosystem'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="lm-btn-ghost px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          {isAr ? 'English' : 'العربية'}
        </button>
      </header>

      {/* Main centered split */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Clean Brand Statement + Quick Demo Accounts */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-[var(--lm-border)] bg-[var(--lm-surface)] text-[var(--lm-text-secondary)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {isAr ? 'نسخة العرض التفاعلي المحلية • حساب موحد واحد' : 'Local Interactive Edition • Unified Identity'}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                {isAr ? 'منصة واحدة للتواصل، المحتوى، البث، والمساعد الذكي.' : 'One unified platform for Messaging, Content, Live, and AI.'}
              </h1>
              <p className="text-sm sm:text-base text-[var(--lm-text-secondary)] leading-relaxed max-w-xl">
                {isAr
                  ? 'انطلقت من مصر ببنية معيارية جاهزة للعالم. محادثات مشفرة، فيديوهات قصيرة، بث مباشر بأولوية تعليقات VIP، ومساعد ذكي يحترم خصوصيتك ولا يلمس أموالك.'
                  : 'Born in Egypt, engineered for global scale. Encrypted messaging, short video, VIP-prioritized Live streaming, and privacy-first LM AI.'}
              </p>
            </div>

            {/* Key Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="lm-card rounded-xl p-4 flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#2F6BFF] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">{isAr ? 'خصوصية محادثات صارمة' : 'Strict Chat Privacy'}</div>
                  <p className="text-xs text-[var(--lm-text-secondary)] mt-0.5">
                    {isAr ? 'LM AI لا يقرأ محادثاتك الخاصة تلقائيًا إلا بمشاركتك وإذنك الصريح.' : 'LM AI never reads private chats without explicit user consent.'}
                  </p>
                </div>
              </div>
              <div className="lm-card rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">{isAr ? 'عزل الصلاحيات المالية' : 'Financial Isolation'}</div>
                  <p className="text-xs text-[var(--lm-text-secondary)] mt-0.5">
                    {isAr ? 'الذكاء الاصطناعي معزول تمامًا عن المحفظة، والمالية تعمل بوضع تصميم تجريبي آمن.' : 'AI is strictly isolated from funds; Finance runs in safe Sandbox preview.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Investor / Tester Account Switcher */}
            <div className="lm-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {isAr ? 'دخول فوري بحسابات جاهزة للتجربة' : 'Instant Demo Accounts'}
                </h2>
                <span className="text-[11px] text-[var(--lm-text-muted)]">
                  {isAr ? 'قارن تجربة VIP 1 مع VIP 3 والمستخدم العادي' : 'Compare VIP 1, VIP 3 & Free'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      loginUser(u);
                      toast(isAr ? `تم الدخول بحساب ${u.displayName}` : `Signed in as ${u.displayNameEn}`, 'success');
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[var(--lm-border)] bg-[var(--lm-surface-2)] hover:bg-[var(--lm-surface-hover)] hover:border-[var(--lm-border-strong)] transition-all text-start cursor-pointer"
                  >
                    <UserAvatar initials={u.avatarInitials} color={u.avatarColor} size={38} vipTier={u.vipTier} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold truncate">{isAr ? u.displayName : u.displayNameEn}</span>
                        <VipBadge tier={u.vipTier} compact />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span dir="ltr" className="text-[11px] text-[var(--lm-text-muted)] font-mono-num inline-block">@{u.username}</span>
                        <RankBadge rankId={u.rankId} lang={lang} />
                        <span className="text-[11px] text-[var(--lm-text-muted)]">{COUNTRY_META[u.country].flag}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Standard Login / Sign Up Form */}
          <div className="lg:col-span-5 lm-card rounded-2xl p-6 space-y-5">
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)]">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'login' ? 'bg-[var(--lm-surface)] text-[var(--lm-text)] shadow-sm border border-[var(--lm-border)]' : 'text-[var(--lm-text-secondary)]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'register' ? 'bg-[var(--lm-surface)] text-[var(--lm-text)] shadow-sm border border-[var(--lm-border)]' : 'text-[var(--lm-text-secondary)]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isAr ? 'حساب جديد' : 'Create Account'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--lm-text-secondary)] mb-1.5">
                    {isAr ? 'الاسم الكامل' : 'Full Name'}
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={isAr ? 'مثال: أحمد سامي' : 'e.g. Ahmed Samy'}
                    className="lm-input w-full rounded-xl px-3.5 py-2.5 text-sm"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--lm-text-secondary)] mb-1.5">
                  {isAr ? 'اسم المستخدم (Handle)' : 'Username'}
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="youssef"
                  dir="ltr"
                  className="lm-input w-full rounded-xl px-3.5 py-2.5 text-sm font-mono-num"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--lm-text-secondary)] mb-1.5">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  dir="ltr"
                  className="lm-input w-full rounded-xl px-3.5 py-2.5 text-sm font-mono-num"
                  required
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--lm-text-secondary)] mb-1.5">
                    {isAr ? 'بلد الإقامة (لتحديد العملة والتسعير المحلي)' : 'Residency Country (Local Pricing)'}
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as CountryCode)}
                    className="lm-input w-full rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    {Object.entries(COUNTRY_META).map(([code, m]) => (
                      <option key={code} value={code}>
                        {m.flag} {isAr ? m.ar : m.en} ({m.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="lm-btn-primary w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? (isAr ? 'جاري التحقق...' : 'Authenticating...')
                  : mode === 'login'
                  ? (isAr ? 'دخول إلى منصة LM' : 'Enter LM Platform')
                  : (isAr ? 'إنشاء الحساب والبدء' : 'Create Unified Account')}
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="pt-3 border-t border-[var(--lm-border)] text-[11px] text-[var(--lm-text-muted)] text-center">
              {isAr
                ? 'كلمة المرور التجريبية للحسابات الجاهزة: 123456 — يمكنك تسجيل الخروج والتبديل في أي وقت.'
                : 'Demo password for seeded accounts: 123456 — sign out or switch anytime.'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
