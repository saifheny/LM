import React, { useEffect, useState, useRef } from 'react';
import { createChart, ColorType, CandlestickSeriesPartialOptions } from 'lightweight-charts';
import { TrendingUp, Coins, Wallet, Building2 } from 'lucide-react';
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
  description: string;
}

export function FinanceView() {
  const { user, lang } = useApp();
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

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !activeAsset) return;

    const isLight = user?.theme === 'alabaster';
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isLight ? '#475569' : '#94A3B8',
        fontFamily: 'JetBrains Mono, Inter, monospace',
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.04)' },
        horzLines: { color: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.04)' },
      },
      width: container.clientWidth,
      height: 330,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const candleOpts: CandlestickSeriesPartialOptions = {
      upColor: '#10B981',
      downColor: '#FF2D55',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#FF2D55',
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
        {/* Sleek Glass Portfolio Capsules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="lm-card rounded-3xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--lm-text-muted)]">
              <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4 text-[var(--lm-accent)]" /> {isAr ? 'المحفظة' : 'Wallet'}</span>
              <span className="font-mono-num text-[10px] px-2 py-0.5 rounded-full bg-[var(--lm-surface-2)]">SANDBOX</span>
            </div>
            <div className="text-2xl font-extrabold font-mono-num">
              {user.demoBalanceEgp.toLocaleString('en-US')} <span className="text-xs font-normal text-[var(--lm-text-muted)]">EGP</span>
            </div>
          </div>

          <div className="lm-card rounded-3xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--lm-text-muted)]">
              <span className="flex items-center gap-1.5"><Coins className="w-4 h-4 text-[#F5C451]" /> {isAr ? 'عوائد الهدايا' : 'Creator Revenue'}</span>
              <span className="font-mono-num text-[10px] text-emerald-400">75%</span>
            </div>
            <div className="text-2xl font-extrabold font-mono-num text-emerald-400">
              {user.creatorEarningsEgp.toLocaleString('en-US')} <span className="text-xs font-normal text-[var(--lm-text-muted)]">EGP</span>
            </div>
          </div>

          <div className="lm-card rounded-3xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--lm-text-muted)]">
              <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-[#F5C451]" /> {isAr ? 'ملكية المؤسس' : 'Founder Equity'}</span>
              <span className="font-mono-num text-[10px] text-[#F5C451]">PRIVATE</span>
            </div>
            <div className="text-2xl font-extrabold font-mono-num">52%</div>
          </div>
        </div>

        {/* TRADINGVIEW PRO TERMINAL */}
        <div className="lm-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => setSelectedSymbol(a.symbol)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono-num font-bold transition-all cursor-pointer ${
                    a.symbol === selectedSymbol
                      ? 'lm-btn-primary'
                      : 'bg-[var(--lm-surface-2)] text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)]'
                  }`}
                >
                  {a.symbol}
                </button>
              ))}
            </div>

            {latest && (
              <div className="flex items-baseline gap-2.5 font-mono-num">
                <span className="text-xl font-extrabold">{latest.close.toLocaleString('en-US')}</span>
                <span className={`text-xs font-bold flex items-center gap-0.5 ${Number(deltaPct) >= 0 ? 'text-emerald-400' : 'text-[#FF2D55]'}`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  {Number(deltaPct) >= 0 ? '+' : ''}{deltaPct}%
                </span>
              </div>
            )}
          </div>

          <div ref={chartContainerRef} className="w-full rounded-2xl bg-[var(--lm-surface-2)] p-2" />
        </div>

        {/* COMPACT LEDGER */}
        <div className="lm-card rounded-3xl p-5 space-y-2.5">
          <div className="text-xs font-bold text-[var(--lm-text-secondary)]">
            {isAr ? 'سجل الحركات التجريبية' : 'Recent Activity'}
          </div>
          <div className="space-y-1.5">
            {ledger.slice(0, 6).map((row) => (
              <div key={row.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[var(--lm-surface-2)] text-xs">
                <span className="font-medium">{row.description}</span>
                <span className="font-mono-num font-bold text-emerald-400">{row.amount_egp.toLocaleString('en-US')} EGP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
