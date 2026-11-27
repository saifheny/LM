import React from 'react';
import { motion } from 'framer-motion';

/**
 * 2026 Sculpted Luminous Glass Close Orb (Replaces plain raw X buttons across all modals & popups)
 */
export function CloseOrbButton({
  onClick,
  size = 'md',
  title = 'إغلاق',
  className = '',
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  className?: string;
}) {
  const dim =
    size === 'xs' ? 'w-6 h-6' : size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const iconDim =
    size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`group relative ${dim} rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className={`${iconDim} transition-transform duration-200 group-hover:rotate-90`}
      >
        <path
          d="M5.75 5.75L14.25 14.25M14.25 5.75L5.75 14.25"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </motion.button>
  );
}

/**
 * 2026 Sculpted Proportioned Publish / Confirm Action Pill (Zero awkward sizes, zero electric blue!)
 */
export function PublishActionButton({
  type = 'submit',
  onClick,
  disabled = false,
  loading = false,
  label,
  loadingLabel = 'جارٍ النشر...',
  variant = 'luminous',
  icon,
  className = '',
}: {
  type?: 'button' | 'submit';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  loadingLabel?: string;
  variant?: 'luminous' | 'rose' | 'emerald' | 'live';
  icon?: React.ReactNode;
  className?: string;
}) {
  const palette =
    variant === 'rose'
      ? 'bg-[#FE2C55] hover:bg-[#E5254B] text-white border-transparent'
      : variant === 'live'
        ? 'bg-[#FE2C55] hover:bg-[#E5254B] text-white border-transparent'
        : variant === 'emerald'
          ? 'bg-[#10B981] hover:bg-[#059669] text-[#121212] font-bold border-transparent'
          : 'bg-[#FE2C55] hover:bg-[#E5254B] text-white font-bold border-transparent';

  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      disabled={disabled || loading}
      onClick={onClick}
      className={`h-9 px-5 rounded-full border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed transition-opacity ${palette} ${className}`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        icon || (
          <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
            <path
              d="M10 15.5V4.5M10 4.5L5.5 9M10 4.5L14.5 9"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      )}
      <span>{loading ? loadingLabel : label}</span>
    </motion.button>
  );
}

/**
 * 2026 Unified Floating Modal Backdrop + Sculpted Glass Sheet
 */
export function StudioModalOverlay({
  onClose,
  children,
  zClass = 'z-[70]',
}: {
  onClose: () => void;
  children: React.ReactNode;
  zClass?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      className={`fixed inset-0 ${zClass} bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-[440px] rounded-t-[24px] sm:rounded-[24px] bg-[#1C1D24] border-t sm:border border-white/[0.1] overflow-hidden text-start"
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        {children}
      </motion.div>
    </motion.div>
  );
}
