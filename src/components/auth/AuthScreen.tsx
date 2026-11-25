import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, ArrowLeft, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { COUNTRY_META, CountryCode, UserProfile } from '../../types';
import { LmBrandMark, RankBadge, UserAvatar, VipBadge } from '../shared/LmBrandMark';
import { SpatialCompanion3D } from '../shared/Spatial3D';

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
      toast(isAr ? `أهلًا ${res.user.displayName}` : `Welcome, ${res.user.displayNameEn}`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto tg-wallpaper flex flex-col justify-center items-center p-4 sm:p-6">
      <button
        onClick={() => setLang(isAr ? 'en' : 'ar')}
        className="fixed top-5 end-5 liquid-glass px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5" />
        {isAr ? 'English' : 'العربية'}
      </button>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: 3D Spatial Companion + Instant One-Tap Profiles */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start space-y-5">
          <div className="flex items-center gap-5">
            <SpatialCompanion3D size={135} />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <LmBrandMark size={38} iconStyle="default" />
                <span className="text-3xl font-extrabold tracking-tight">LM</span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--lm-text-secondary)]">
                {isAr ? 'تواصَل، شاهِد، ابتكِر في عالم واحد.' : 'Connect, watch, and create in one spatial world.'}
              </p>
            </div>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {allUsers.map((u) => (
              <motion.button
                key={u.id}
                whileHover={{ y: -2, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => loginUser(u)}
                className="lm-card flex items-center gap-3 p-3 rounded-2xl hover:border-[var(--lm-accent)]/60 transition-colors text-start cursor-pointer"
              >
                <UserAvatar initials={u.avatarInitials} color={u.avatarColor} avatarUrl={u.avatarUrl} size={44} vipTier={u.vipTier} online />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                    <span className="truncate">{isAr ? u.displayName : u.displayNameEn}</span>
                    <VipBadge tier={u.vipTier} compact />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span dir="ltr" className="text-[11px] text-[var(--lm-text-muted)] font-mono-num">@{u.username}</span>
                    <RankBadge rankId={u.rankId} lang={lang} />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Right: Liquid-Glass Auth Capsule */}
        <div className="lg:col-span-5 liquid-glass rounded-3xl p-6 space-y-5">
          <div className="grid grid-cols-2 p-1 rounded-full bg-[var(--lm-surface-2)]">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${mode === 'login' ? 'lm-btn-primary' : 'text-[var(--lm-text-secondary)]'}`}
            >
              {isAr ? 'دخول' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${mode === 'register' ? 'lm-btn-primary' : 'text-[var(--lm-text-secondary)]'}`}
            >
              {isAr ? 'حساب جديد' : 'Sign Up'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={isAr ? 'الاسم' : 'Name'}
                className="lm-input w-full rounded-2xl px-4 py-3 text-sm"
                required
              />
            )}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              dir="ltr"
              className="lm-input w-full rounded-2xl px-4 py-3 text-sm font-mono-num"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              dir="ltr"
              className="lm-input w-full rounded-2xl px-4 py-3 text-sm font-mono-num"
              required
            />
            {mode === 'register' && (
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryCode)}
                className="lm-input w-full rounded-2xl px-4 py-3 text-sm"
              >
                {Object.entries(COUNTRY_META).map(([code, m]) => (
                  <option key={code} value={code}>
                    {m.flag} {isAr ? m.ar : m.en} ({m.currency})
                  </option>
                ))}
              </select>
            )}

            {error && <div className="p-3 rounded-2xl bg-red-500/15 text-xs text-red-400">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="lm-btn-primary w-full py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{mode === 'login' ? (isAr ? 'دخول' : 'Continue') : (isAr ? 'ابدأ الآن' : 'Create')}</span>
              {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
