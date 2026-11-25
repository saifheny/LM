import React, { useEffect, useState, useRef } from 'react';
import { createChart, ColorType, CandlestickSeriesPartialOptions } from 'lightweight-charts';
import {
  Landmark,
  TrendingUp,
  ShieldAlert,
  BookOpen,
  Building2,
  Coins,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';

interface MarketAsset {
  symbol: string;
  nameAr: string;
  nameEn: string;
  category: 'stocks' | 'crypto';
  currency: string;
  series: Array<{ time: string; open: number; high: number; low: number; close: number }>;
}

interface LedgerRow {
  id: string;
  debit_account: string;
  credit_account: string;
  amount_egp: number;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

export function FinanceView() {
  const { user, lang, setActiveTab } = useApp();
  const isAr = lang === 'ar';

  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('EGX30');
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<{ assets: MarketAsset[] }>('/api/finance/markets').then(d => setAssets(d.assets)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    api<{ entries: LedgerRow[] }>(`/api/finance/ledger/${user.id}`).then(d => setLedger(d.entries)).catch(() => {});
  }, [user]);

  const activeAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  // Mount real TradingView Lightweight Charts (Apache 2.0 from LM Blueprint)
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !activeAsset) return;

    const isLight = user?.theme === 'alabaster';
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isLight ? '#475569' : '#9BA3B5',
        fontFamily: 'JetBrains Mono, Inter, monospace',
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)' },
        horzLines: { color: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)' },
      },
      width: container.clientWidth,
      height: 310,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const candleOpts: CandlestickSeriesPartialOptions = {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    };
    const series = chart.addCandlestickSeries(candleOpts);
    series.setData(activeAsset.series);
    chart.timeScale().fitContent();

    const onResize = () => {
      if (container) chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [activeAsset, user?.theme]);

  if (!user) return null;

  const latest = activeAsset?.series[activeAsset.series.length - 1];
  const prev = activeAsset?.series[activeAsset.series.length - 2];
  const deltaPct = latest && prev ? (((latest.close - prev.close) / prev.close) * 100).toFixed(2) : '0.00';

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-5">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Explicit Design / Sandbox Compliance Banner */}
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/35 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300">
                {isAr ? 'وضع التصميم والعرض التفاعلي فقط (Sandbox Preview)' : 'Visual Design & Sandbox Preview Only'}
              </div>
              <p className="text-[var(--lm-text-secondary)] mt-0.5 leading-relaxed">
                {isAr
                  ? 'لا توجد بطاقات فيزا أو ربط بنكي أو تحويلات أموال حقيقية في هذه النسخة التجريبية. ستُفعّل الخدمات المالية والأصول الرقمية والأسهم فقط بعد التراخيص والشراكات القانونية.'
                  : 'No real Visa, banking rails, or live funds are processed in this demo edition. Licensed rails come in the funded phase.'}
              </p>
            </div>
          </div>
          <span className="font-mono-num text-[10px] px-2.5 py-1 rounded-lg bg-black/30 border border-amber-500/30 text-amber-300 shrink-0">
            AI ISOLATED • NO LIVE FUNDS
          </span>
        </div>

        {/* Optional 5 EGP Investment Ad Notice */}
        {!user.adRemoval.investment && (
          <div className="lm-card-subtle rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="text-[var(--lm-text-secondary)]">
              {isAr ? 'إعلان قسم الاستثمار • يمكنك إزالته مقابل 5 ج.م شهريًا فقط.' : 'Investment Section Ad • Removable for 5 EGP/mo.'}
            </span>
            <button onClick={() => setActiveTab('vip')} className="text-[var(--lm-accent)] font-semibold hover:underline cursor-pointer">
              {isAr ? 'إزالة (5 ج.م)' : 'Remove'}
            </button>
          </div>
        )}

        {/* Top Summary Cards (Visual Wallet + Creator Earnings + LM Equity Vision) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="lm-card rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--lm-text-muted)]">
              <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4 text-[var(--lm-accent)]" /> {isAr ? 'الرصيد التجريبي (محاكاة)' : 'Sandbox Balance'}</span>
              <span className="font-mono-num text-[10px] px-2 py-0.5 rounded bg-[var(--lm-surface-2)]">DEMO</span>
            </div>
            <div className="text-2xl font-bold font-mono-num">
              {user.demoBalanceEgp.toLocaleString('en-US')} <span className="text-xs font-normal text-[var(--lm-text-muted)]">EGP</span>
            </div>
            <div className="text-[11px] text-[var(--lm-text-secondary)]">
              {isAr ? 'فصل تام لحسابات العملاء عن أموال الشركة (بنية القيد المزدوج).' : 'Strict client-fund segregation (Double-Entry Ledger architecture).'}
            </div>
          </div>

          <div className="lm-card rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--lm-text-muted)]">
              <span className="flex items-center gap-1.5"><Coins className="w-4 h-4 text-[#D4AF37]" /> {isAr ? 'أرباح الهدايا والاشتراكات' : 'Creator Earnings'}</span>
              <span className="font-mono-num text-[10px] text-emerald-400">75% SHARE</span>
            </div>
            <div className="text-2xl font-bold font-mono-num text-emerald-400">
              {user.creatorEarningsEgp.toLocaleString('en-US')} <span className="text-xs font-normal text-[var(--lm-text-muted)]">EGP</span>
            </div>
            <div className="text-[11px] text-[var(--lm-text-secondary)]">
              {isAr ? 'تُحدَّث تلقائيًا عند إرسال الهدايا في قسم البث المباشر.' : 'Auto-updated from Live stream virtual gift splits.'}
            </div>
          </div>

          <div className="lm-card rounded-2xl p-5 space-y-2 border-[#D4AF37]/30">
            <div className="flex items-center justify-between text-xs text-[var(--lm-text-muted)]">
              <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-[#D4AF37]" /> {isAr ? 'رؤية أسهم وحوكمة LM' : 'LM Private Equity Vision'}</span>
              <span className="font-mono-num text-[10px] text-[#E8C85E]">PRIVATE</span>
            </div>
            <div className="text-2xl font-bold font-mono-num">
              52% <span className="text-xs font-normal text-[var(--lm-text-secondary)]">{isAr ? 'حصة مسيطرة للمؤسس والإدارة' : 'Founder Control'}</span>
            </div>
            <div className="text-[11px] text-[var(--lm-text-secondary)]">
              {isAr ? 'شركة خاصة غير مدرجة • مشاركة المستثمرين عبر هيكل قانوني مرخص.' : 'Private non-IPO governance • Licensed investor participation.'}
            </div>
          </div>
        </div>

        {/* REAL TRADINGVIEW LIGHTWEIGHT CHARTS MARKET TERMINAL */}
        <div className="lm-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                {isAr ? 'منصة أبحاث الأسواق والأصول الرقمية (TradingView Lightweight Charts)' : 'Market & Crypto Analytics (TradingView Lightweight Charts)'}
              </h2>
              <p className="text-[11px] text-[var(--lm-text-muted)] mt-0.5">
                {isAr ? 'مكتبة رسوم مالية مفتوحة المصدر (Apache 2.0) — عرض تحليلي تفاعلي بالشموع اليابانية' : 'Open-source Apache 2.0 interactive Japanese Candlestick analytics'}
              </p>
            </div>
            {latest && (
              <div className="text-end font-mono-num">
                <div className="text-lg font-bold">
                  {latest.close.toLocaleString('en-US')} <span className="text-xs text-[var(--lm-text-muted)]">{activeAsset?.currency}</span>
                </div>
                <div className={`text-xs font-semibold ${Number(deltaPct) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Number(deltaPct) >= 0 ? '+' : ''}{deltaPct}%
                </div>
              </div>
            )}
          </div>

          {/* Asset Picker Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {assets.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setSelectedSymbol(a.symbol)}
                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 shrink-0 cursor-pointer transition-colors ${
                  a.symbol === selectedSymbol
                    ? 'bg-[var(--lm-accent-soft)] border-[var(--lm-accent)]/50 font-semibold'
                    : 'bg-[var(--lm-surface-2)] border-[var(--lm-border)] hover:bg-[var(--lm-surface-hover)]'
                }`}
              >
                <span className="font-mono-num font-bold">{a.symbol}</span>
                <span className="text-[11px] text-[var(--lm-text-secondary)]">{isAr ? a.nameAr : a.nameEn}</span>
              </button>
            ))}
          </div>

          {/* Interactive Chart Mount */}
          <div ref={chartContainerRef} className="w-full rounded-xl bg-[var(--lm-surface-2)] border border-[var(--lm-border)] p-2" />
        </div>

        {/* DOUBLE-ENTRY DEMO LEDGER TABLE */}
        <div className="lm-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--lm-accent)]" />
              {isAr ? 'سجل دفتر القيود المزدوجة (Double-Entry Sandbox Ledger)' : 'Immutable Double-Entry Sandbox Ledger'}
            </h3>
            <span className="text-[10px] font-mono-num text-[var(--lm-text-muted)]">Blnk / Formance Architecture</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[var(--lm-border)] text-[var(--lm-text-muted)] text-[11px]">
                  <th className="py-2 px-2 text-start">{isAr ? 'البيان' : 'Description'}</th>
                  <th className="py-2 px-2 text-start">{isAr ? 'من حساب (Debit)' : 'Debit'}</th>
                  <th className="py-2 px-2 text-start">{isAr ? 'إلى حساب (Credit)' : 'Credit'}</th>
                  <th className="py-2 px-2 text-end">{isAr ? 'القيمة' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--lm-border)]">
                {ledger.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--lm-surface-2)]">
                    <td className="py-2.5 px-2 font-medium">{row.description}</td>
                    <td className="py-2.5 px-2 font-mono-num text-[11px] text-[var(--lm-text-muted)]">{row.debit_account}</td>
                    <td className="py-2.5 px-2 font-mono-num text-[11px] text-[var(--lm-text-muted)]">{row.credit_account}</td>
                    <td className="py-2.5 px-2 text-end font-mono-num font-bold text-emerald-400">
                      {row.amount_egp.toLocaleString('en-US')} EGP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
