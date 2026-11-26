import React from 'react';

/**
 * Organized, calm 2026 monochrome empty state used consistently across comments, chat, calls, live, and profile tabs.
 */
export function EmptyState2026({
  icon,
  title,
  subtitle,
  action,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center px-5 ${
        compact ? 'py-7 gap-2' : 'py-12 gap-3'
      }`}
    >
      <div
        className={`rounded-full bg-white/[0.04] border border-white/[0.09] text-[#A1A1AA] flex items-center justify-center ${
          compact ? 'w-11 h-11' : 'w-14 h-14'
        }`}
      >
        {icon}
      </div>
      <div className="space-y-1 max-w-[280px]">
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-[#F2F2F5]`}>{title}</div>
        {subtitle && <p className="text-[11.5px] text-[#7A7A85] leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/**
 * Instant pulsing comment list skeleton shown while fetching so users NEVER see "0 تعليق" flash before real comments arrive!
 */
export function CommentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3.5 py-2 animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/[0.08] shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-24 rounded-full bg-white/[0.1]" />
              <div className="h-2 w-10 rounded-full bg-white/[0.06]" />
            </div>
            <div className="h-3 w-4/5 rounded-full bg-white/[0.08]" />
            {idx % 2 === 0 && <div className="h-3 w-2/5 rounded-full bg-white/[0.06]" />}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Instant chat thread skeleton shown when switching conversations before messages resolve.
 */
export function MessageListSkeleton() {
  return (
    <div className="space-y-4 py-4 animate-pulse">
      <div className="flex items-end gap-2 justify-start">
        <div className="w-7 h-7 rounded-full bg-white/[0.08] shrink-0" />
        <div className="h-12 w-52 rounded-2xl bg-white/[0.07]" />
      </div>
      <div className="flex items-end gap-2 justify-end">
        <div className="h-14 w-60 rounded-2xl bg-white/[0.09]" />
      </div>
      <div className="flex items-end gap-2 justify-start">
        <div className="w-7 h-7 rounded-full bg-white/[0.08] shrink-0" />
        <div className="h-10 w-40 rounded-2xl bg-white/[0.07]" />
      </div>
    </div>
  );
}
