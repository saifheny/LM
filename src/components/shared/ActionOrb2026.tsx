import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StylusEditIcon, RemoveCrossIcon } from './Icons2026Pro';

/**
 * 2026 Revolutionary Tactile Floating Action Menu Orb (Replaces generic trash-can / pencil rows!)
 * - Compact floating glass ••• orb
 * - Spring-animated glass menu with sculpted jewel-toned duotone icons
 * - 2-tap inline morphing confirmation on Remove ("إزالة" -> "تأكيد الإزالة") — ZERO ugly trash-can icon!
 */
export interface ActionMenuExtraItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

export function ActionMenuOrb({
  onEdit,
  onRemove,
  extraItems,
  editLabel = 'تعديل',
  removeLabel = 'إزالة',
  align = 'end',
  direction = 'down',
  compact = false,
}: {
  onEdit?: () => void;
  onRemove?: () => void;
  extraItems?: ActionMenuExtraItem[];
  editLabel?: string;
  removeLabel?: string;
  align?: 'start' | 'end';
  direction?: 'up' | 'down';
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmRemove(false);
      return;
    }
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={wrapRef} onClick={e => e.stopPropagation()} className="relative inline-flex">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(v => !v)}
        aria-label="خيارات"
        className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center cursor-pointer transition-colors ${
          open
            ? 'bg-white/[0.15] text-white border border-white/20'
            : 'bg-white/[0.04] hover:bg-white/[0.12] text-[#9E9EA8] hover:text-white border border-transparent'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="6.5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="17.5" r="1.8" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: direction === 'up' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: direction === 'up' ? 4 : -4 }}
            transition={{ type: 'spring', stiffness: 480, damping: 28 }}
            className={`absolute z-40 min-w-[144px] max-w-[200px] p-1.5 rounded-2xl bg-[#15151C]/98 backdrop-blur-2xl border border-white/[0.14] shadow-[0_14px_40px_rgba(0,0,0,0.72)] space-y-1 ${
              direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            } ${align === 'end' ? 'end-0' : 'start-0'}`}
          >
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.08] flex items-center gap-2.5 text-xs font-medium text-[#F2F2F5] cursor-pointer transition-colors text-start"
              >
                <StylusEditIcon className="w-4 h-4 shrink-0" />
                <span>{editLabel}</span>
              </button>
            )}

            {extraItems?.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-medium cursor-pointer transition-colors text-start ${
                  item.danger
                    ? 'hover:bg-[#EF4444]/12 text-[#FB7185] font-semibold'
                    : 'hover:bg-white/[0.08] text-[#F2F2F5]'
                }`}
              >
                <span className="shrink-0 flex items-center justify-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}

            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmRemove) {
                    setConfirmRemove(true);
                  } else {
                    setOpen(false);
                    setConfirmRemove(false);
                    onRemove();
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold cursor-pointer transition-all text-start ${
                  confirmRemove
                    ? 'bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#FCA5A5]'
                    : 'hover:bg-[#EF4444]/12 text-[#FB7185]'
                }`}
              >
                <RemoveCrossIcon className="w-4 h-4 shrink-0" />
                <span>{confirmRemove ? 'تأكيد الإزالة' : removeLabel}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact 2-Tap Remove Pill (Inline alternative to Trash Can icon for comments & AI sessions!)
 */
export function QuickRemovePill({
  onRemove,
  label = 'إزالة',
  iconOnly = false,
}: {
  onRemove: () => void;
  label?: string;
  iconOnly?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        if (!confirm) setConfirm(true);
        else {
          setConfirm(false);
          onRemove();
        }
      }}
      title={confirm ? 'اضغط مجددًا للتأكيد' : label}
      className={`inline-flex items-center gap-1.5 rounded-full transition-all cursor-pointer py-0.5 ${
        confirm
          ? 'px-2.5 py-1 bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#FCA5A5] text-[12px] font-semibold'
          : iconOnly
          ? 'w-7 h-7 justify-center hover:bg-white/[0.08] text-[#9E9EA8] hover:text-[#FB7185]'
          : 'text-[12.5px] font-medium text-[#9E9EA8] hover:text-[#FB7185]'
      }`}
    >
      <RemoveCrossIcon className="w-4 h-4 shrink-0" />
      {(!iconOnly || confirm) && <span>{confirm ? 'تأكيد الحذف؟' : label}</span>}
    </button>
  );
}
