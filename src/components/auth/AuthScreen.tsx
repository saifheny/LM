import React, { useState } from 'react';
import { Globe, ArrowLeft, ArrowRight } from 'lucide-react';
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
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { username, password } : { username, displayName, password, country };
      const res = await api<{ user: UserProfile }>(endpoint, { method: 'POST', body: JSON.stringify(body) });
      loginUser(res.user);
      toast(isAr ? `أهلًا بك، ${res.user.displayName}` : `Welcome, ${res.user.displayNameEn}`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto tg-wallpaper text-white flex flex-col justify-center items-center p-4 sm:p-6">
      <button
        onClick={() => setLang(isAr ? 'en' : 'ar')}
        className="fixed top-5 end-5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md text-xs font-medium flex items-center gap-1.5 cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5" />
        {isAr ? 'English' : 'العربية'}
      </button>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Instant One-Tap Profile Cards with Real Portrait Photos */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-3.5">
            <LmBrandMark size={52} iconStyle="default" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">LM</h1>
              <p className="text-xs sm:text-sm text-white/65">
                {isAr ? 'دردشة تيليجرام • فيديوهات تيك توك • بث مباشر • ذكاء اصطناعي' : 'Telegram Chat • TikTok Shorts • Live • AI'}
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-[#212121]/90 backdrop-blur-xl border border-white/10 p-5 space-y-3 shadow-2xl">
            <div className="text-xs font-semibold text-white/60">
              {isAr ? 'اختر حسابًا للدخول الفوري والتجربة:' : 'Tap an account for instant sign-in:'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => loginUser(u)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] hover:bg-[#766AC8]/35 border border-white/[0.07] hover:border-[#8774E1]/50 transition-all text-start cursor-pointer"
                >
                  <UserAvatar initials={u.avatarInitials} color={u.avatarColor} avatarUrl={u.avatarUrl} size={44} vipTier={u.vipTier} online />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                      <span className="truncate">{isAr ? u.displayName : u.displayNameEn}</span>
                      <VipBadge tier={u.vipTier} compact />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span dir="ltr" className="text-[11px] text-white/50 font-mono-num">@{u.username}</span>
                      <RankBadge rankId={u.rankId} lang={lang} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Clean Telegram-Style Sign In Card */}
        <div className="lg:col-span-5 rounded-3xl bg-[#212121]/95 backdrop-blur-xl border border-white/10 p-6 space-y-5 shadow-2xl">
          <div className="grid grid-cols-2 p-1 rounded-full bg-black/30">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 rounded-full text-xs font-bold cursor-pointer ${mode === 'login' ? 'bg-[#8774E1] text-white' : 'text-white/60'}`}
            >
              {isAr ? 'دخول' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`py-2 rounded-full text-xs font-bold cursor-pointer ${mode === 'register' ? 'bg-[#8774E1] text-white' : 'text-white/60'}`}
            >
              {isAr ? 'حساب جديد' : 'Sign Up'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isAr ? 'الاسم الكامل' : 'Full Name'}
                className="w-full rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#8774E1]"
                required
              />
            )}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              dir="ltr"
              className="w-full rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3 text-sm font-mono-num outline-none focus:border-[#8774E1]"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              dir="ltr"
              className="w-full rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-3 text-sm font-mono-num outline-none focus:border-[#8774E1]"
              required
            />
            {mode === 'register' && (
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryCode)}
                className="w-full rounded-2xl bg-[#2C2C2C] border border-white/10 px-4 py-3 text-sm outline-none"
              >
                {Object.entries(COUNTRY_META).map(([code, m]) => (
                  <option key={code} value={code}>
                    {m.flag} {isAr ? m.ar : m.en} ({m.currency})
                  </option>
                ))}
              </select>
            )}

            {error && <div className="p-3 rounded-2xl bg-red-500/15 text-xs text-red-300">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-[#8774E1] hover:bg-[#766AC8] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{mode === 'login' ? (isAr ? 'متابعة إلى LM' : 'Continue') : (isAr ? 'إنشاء الحساب' : 'Create Account')}</span>
              {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
