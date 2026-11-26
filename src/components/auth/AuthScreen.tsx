import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { Lang, UserProfile } from '../../types';
import { UserAvatar, VerifiedIcon } from '../shared/LmBrandMark';
import { apiPost, setAuthToken } from '../../lib/api';
import { CosmicPlanetCanvas } from './CosmicPlanetCanvas';

interface AuthScreenProps {
  users: UserProfile[];
  lang?: Lang;
  onToggleLang?: () => void;
  onAuthenticated: (u: UserProfile) => void;
}

export function AuthScreen({ users, onAuthenticated }: AuthScreenProps) {
  const [registerInlineOpen, setRegisterInlineOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [submittingName, setSubmittingName] = useState(false);
  const [enteringGuest, setEnteringGuest] = useState(false);
  const [inlineErr, setInlineErr] = useState('');

  // Optional Login Modal for returning users
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Enforce pure crisp English tab title & LTR framing on the outer landing page
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'LM';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  const normalizedWords = nameInput.trim().split(/\s+/).filter(Boolean);
  const wordCount = normalizedWords.length;
  const tooManyWords = wordCount > 3;

  async function handleQuickNameRegister(e: React.FormEvent) {
    e.preventDefault();
    setInlineErr('');
    const clean = nameInput.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) {
      setInlineErr('Please enter your name.');
      return;
    }
    if (clean.split(' ').filter(Boolean).length > 3) {
      setInlineErr('Maximum 3 words allowed.');
      return;
    }
    setSubmittingName(true);
    try {
      const res = await apiPost<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/quick-register', {
        displayName: clean,
      });
      if (res.token) setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setInlineErr(err instanceof Error ? err.message : 'Unable to continue right now.');
    } finally {
      setSubmittingName(false);
    }
  }

  async function handleEnterAsGuest() {
    if (enteringGuest) return;
    setEnteringGuest(true);
    setInlineErr('');
    try {
      const res = await apiPost<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/guest', {});
      if (res.token) setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setInlineErr(err instanceof Error ? err.message : 'Connection error. Try again.');
    } finally {
      setEnteringGuest(false);
    }
  }

  async function handleReturningLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || loggingIn) return;
    setLoginErr('');
    setLoggingIn(true);
    try {
      const res = await apiPost<{ ok: boolean; user: UserProfile; token?: string }>('/api/auth/login', {
        username: loginUsername.trim(),
        password: loginPassword,
      });
      if (res.token) setAuthToken(res.token);
      setLoginModalOpen(false);
      onAuthenticated(res.user);
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Invalid username or password.');
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div
      dir="ltr"
      lang="en"
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
      className="relative min-h-screen w-full overflow-hidden bg-[#050409] text-white flex flex-col select-none"
    >
      {/* 1:1 Interactive Three.js WebGL Dotted Cosmic Earth Planet */}
      <CosmicPlanetCanvas />

      {/* Minimal Top Bar — ONLY crisp LM wordmark on left + Login & Get Started on right */}
      <header className="relative z-20 w-full max-w-[1260px] mx-auto px-6 sm:px-10 pt-5 sm:pt-7 flex items-center justify-between pointer-events-none">
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            setRegisterInlineOpen(false);
            setInlineErr('');
          }}
          className="pointer-events-auto text-[21px] sm:text-[22px] font-bold tracking-[-0.04em] text-white hover:opacity-90 transition-opacity"
        >
          LM
        </a>

        <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              setLoginErr('');
              setLoginModalOpen(true);
            }}
            className="h-8 sm:h-9 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] backdrop-blur-md text-[12px] font-medium text-white/90 hover:text-white cursor-pointer transition-colors"
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setRegisterInlineOpen(true);
              setInlineErr('');
            }}
            className="h-8 sm:h-9 px-4 rounded-full bg-white hover:bg-[#ECECF2] text-[#07060B] text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-[0_6px_22px_rgba(255,255,255,0.18)]"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
          </button>
        </div>
      </header>

      {/* Hero Typography & Morphing CTAs Positioned Over Upper-Center of the Planet Dome */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-5 text-center -mt-12 sm:-mt-20 pointer-events-none">
        <div className="max-w-[680px] mx-auto pointer-events-auto">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-[40px] sm:text-[62px] md:text-[72px] font-semibold tracking-[-0.04em] leading-[1.03] text-white drop-shadow-[0_10px_40px_rgba(5,4,9,0.55)]"
          >
            Connect without
            <br />
            boundaries
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 sm:mt-5 text-[13px] sm:text-[14.5px] text-white/65 max-w-[440px] mx-auto leading-[1.6] font-normal drop-shadow-[0_4px_20px_rgba(5,4,9,0.75)]"
          >
            Share posts, stream live, chat in real time, watch short videos, and create with LM AI — all unified inside one seamless platform.
          </motion.p>

          {/* Morphing CTA Row: "Get Started ->" & "Explore Site ->" <-> Inline 3-Word Name Input + Next Arrow */}
          <div className="mt-6 sm:mt-7 min-h-[76px] flex flex-col items-center justify-start">
            <AnimatePresence mode="wait">
              {!registerInlineOpen ? (
                <motion.div
                  key="cta_buttons"
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap"
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.025 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setRegisterInlineOpen(true);
                      setInlineErr('');
                    }}
                    className="h-10 sm:h-11 px-5 sm:px-6 rounded-full bg-white hover:bg-[#ECECF2] text-[#07060B] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-[0_10px_30px_rgba(255,255,255,0.18)] transition-colors"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.025 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={enteringGuest}
                    onClick={handleEnterAsGuest}
                    className="h-10 sm:h-11 px-5 sm:px-6 rounded-full bg-[#110E1E]/75 hover:bg-[#19142C]/90 backdrop-blur-xl border border-white/[0.14] text-white/95 text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors disabled:opacity-60"
                  >
                    <span>{enteringGuest ? 'Entering...' : 'Explore Site'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/75" strokeWidth={2.2} />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.form
                  key="name_input_box"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  onSubmit={handleQuickNameRegister}
                  className="w-full max-w-[390px] mx-auto space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex-1 h-11 rounded-full bg-[#0C0A16]/88 backdrop-blur-2xl border px-4 flex items-center gap-2 shadow-[0_14px_38px_rgba(0,0,0,0.65)] transition-colors ${
                        tooManyWords
                          ? 'border-[#FB7185]/75'
                          : 'border-white/[0.18] focus-within:border-[#C084FC]/75'
                      }`}
                    >
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => {
                          setNameInput(e.target.value);
                          setInlineErr('');
                        }}
                        placeholder="Enter your name (max 3 words)"
                        className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/45 outline-none min-w-0"
                      />
                      <span
                        className={`text-[10.5px] font-mono-num shrink-0 ${
                          tooManyWords ? 'text-[#FB7185] font-bold' : 'text-white/45'
                        }`}
                      >
                        {wordCount}/3
                      </span>
                    </div>

                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.94 }}
                      disabled={submittingName || tooManyWords || nameInput.trim().length < 2}
                      title="Continue"
                      className="w-11 h-11 rounded-full bg-white hover:bg-[#ECECF2] text-[#07060B] flex items-center justify-center shrink-0 cursor-pointer shadow-[0_10px_28px_rgba(255,255,255,0.22)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {submittingName ? (
                        <span className="w-4 h-4 rounded-full border-2 border-[#07060B] border-t-transparent animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                      )}
                    </motion.button>
                  </div>

                  {tooManyWords ? (
                    <div className="text-[11.5px] text-[#FDA4AF] font-medium">
                      Maximum 3 words allowed.
                    </div>
                  ) : inlineErr ? (
                    <div className="text-[11.5px] text-[#FDA4AF] font-medium">{inlineErr}</div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 text-[11px] text-white/55">
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterInlineOpen(false);
                          setInlineErr('');
                        }}
                        className="hover:text-white cursor-pointer transition-colors"
                      >
                        Back
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        disabled={enteringGuest}
                        onClick={handleEnterAsGuest}
                        className="hover:text-white cursor-pointer transition-colors"
                      >
                        Continue as guest
                      </button>
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Returning Member Sign-In Modal — Pure English, Clean Glass */}
      <AnimatePresence>
        {loginModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLoginModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-[400px] rounded-t-[24px] sm:rounded-[24px] bg-[#0D0B16]/96 border-t sm:border border-white/[0.12] p-5 space-y-4 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
                <span className="text-[14px] font-semibold tracking-tight text-white">Sign in to LM</span>
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleReturningLogin} className="space-y-2.5">
                <input
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full h-10 rounded-xl bg-[#07060D] border border-white/[0.1] px-3.5 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-[#C084FC]/65"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-10 rounded-xl bg-[#07060D] border border-white/[0.1] px-3.5 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-[#C084FC]/65"
                />
                {loginErr && <div className="text-[12px] text-[#FDA4AF] px-1">{loginErr}</div>}
                <button
                  type="submit"
                  disabled={loggingIn || !loginUsername.trim()}
                  className="w-full h-10 rounded-full bg-white hover:bg-[#ECECF2] text-[#07060B] text-[13px] font-semibold cursor-pointer disabled:opacity-45 transition-colors"
                >
                  {loggingIn ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {users.length > 0 && (
                <div className="pt-2.5 border-t border-white/[0.08] space-y-2">
                  <div className="text-[11px] text-white/45">Quick access</div>
                  <div className="max-h-[156px] overflow-y-auto divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#08070F]">
                    {users.slice(0, 5).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setLoginModalOpen(false);
                          onAuthenticated(u);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-white/[0.05] text-left cursor-pointer transition-colors"
                      >
                        <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium text-white truncate flex items-center gap-1">
                            <span>{u.displayName}</span>
                            {u.verified && <VerifiedIcon />}
                          </div>
                          <div className="text-[10.5px] text-white/45 font-mono-num truncate">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
