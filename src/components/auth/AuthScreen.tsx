import React, { useState } from 'react';
import { Lang, UserProfile } from '../../types';
import { LmBrandMark, UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { ChromeArrowButton } from '../shared/HardwareUI';
import { apiPost } from '../../lib/api';

interface AuthScreenProps {
  users: UserProfile[];
  lang: Lang;
  onToggleLang: () => void;
  onAuthenticated: (u: UserProfile) => void;
}

export function AuthScreen({ users, lang, onToggleLang, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'quick' | 'login' | 'register'>('quick');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('123456');
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'login') {
        const res = await apiPost<{ ok: boolean; user: UserProfile }>('/api/auth/login', { username, password });
        onAuthenticated(res.user);
      } else {
        const res = await apiPost<{ ok: boolean; user: UserProfile }>('/api/auth/register', {
          username,
          displayName,
          password,
        });
        onAuthenticated(res.user);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'خطأ في تسجيل الدخول');
    }
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen w-full bg-black text-[#F5F5F7] flex flex-col justify-between px-6 py-8">
      <div className="max-w-[440px] w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LmBrandMark size={32} />
          <span className="text-sm font-semibold tracking-tight">LM</span>
        </div>
        <button
          type="button"
          onClick={onToggleLang}
          className="text-xs font-mono-num text-[#71717A] hover:text-white cursor-pointer"
        >
          {lang === 'ar' ? 'EN' : 'AR'}
        </button>
      </div>

      <div className="max-w-[440px] w-full mx-auto my-auto py-10">
        <h1
          style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 65%, #71717A 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          className="text-3xl font-semibold tracking-tight mb-2"
        >
          {lang === 'ar' ? 'حساب واحد لكل شيء.' : 'One Identity. Every Space.'}
        </h1>
        <p className="text-xs text-[#71717A] mb-8">
          {lang === 'ar' ? 'اختر حسابًا للدخول الفوري أو أنشئ حسابًا جديدًا.' : 'Select a profile for instant access or create an account.'}
        </p>

        <div className="flex items-center gap-5 border-b border-white/[0.08] mb-4 text-xs">
          {[
            { id: 'quick' as const, ar: 'دخول فوري', en: 'Instant' },
            { id: 'login' as const, ar: 'تسجيل دخول', en: 'Sign In' },
            { id: 'register' as const, ar: 'حساب جديد', en: 'Create' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setMode(tab.id); setErr(''); }}
              className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                mode === tab.id ? 'border-white text-white font-semibold' : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
              }`}
            >
              {lang === 'ar' ? tab.ar : tab.en}
            </button>
          ))}
        </div>

        {mode === 'quick' ? (
          <div className="divide-y divide-white/[0.08] border-b border-white/[0.08]">
            {users.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => onAuthenticated(u)}
                className="w-full py-3.5 flex items-center justify-between hover:bg-white/[0.03] px-2 transition-colors cursor-pointer group text-start"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={40} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#F5F5F7] flex items-center gap-1.5">
                      <span>{u.displayName}</span>
                      {u.verified && <VerifiedIcon />}
                    </div>
                    <div className="text-xs text-[#71717A] truncate">@{u.username} • {u.bio}</div>
                  </div>
                </div>
                <ChromeArrowButton size={34} />
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {mode === 'register' && (
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Display name'}
                className="w-full h-12 rounded-full bg-[#070709] border border-white/[0.1] px-4 text-sm text-white placeholder:text-[#52525B] outline-none focus:border-white/25"
              />
            )}
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={lang === 'ar' ? 'اسم المستخدم (مثال: youssef)' : 'Username'}
              className="w-full h-12 rounded-full bg-[#070709] border border-white/[0.1] px-4 text-sm text-white placeholder:text-[#52525B] outline-none focus:border-white/25"
            />
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                className="flex-1 h-12 rounded-full bg-[#070709] border border-white/[0.1] px-4 text-sm text-white placeholder:text-[#52525B] outline-none focus:border-white/25"
              />
              <ChromeArrowButton type="submit" size={46} />
            </div>
            {err && <div className="text-xs text-[#EF4444] px-2">{err}</div>}
          </form>
        )}
      </div>

      <div className="max-w-[440px] w-full mx-auto text-[11px] text-[#52525B] flex items-center justify-between">
        <span>LM 2026</span>
        <span className="font-mono-num">E2EE • Local Core</span>
      </div>
    </div>
  );
}
