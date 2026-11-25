import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Lang, UserProfile } from '../../types';
import { apiGet } from '../../lib/api';

interface FinanceViewProps {
  user: UserProfile;
  lang: Lang;
}

interface OhlcPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MarketAsset {
  symbol: string;
  nameAr: string;
  nameEn: string;
  category: 'stocks' | 'crypto';
  currency: string;
  series: OhlcPoint[];
}

interface LedgerRow {
  id: string;
  debit_account: string;
  credit_account: string;
  amount_egp: number;
  category: string;
  description: string;
  created_at: string;
}

export function FinanceView({ user, lang }: FinanceViewProps) {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('EGX30');
  const [chartStyle, setChartStyle] = useState<'candles' | 'area'>('candles');
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiGet<{ ok: boolean; assets: MarketAsset[] }>('/api/finance/markets')
      .then(d => setAssets(d.assets))
      .catch(() => {});
    apiGet<{ ok: boolean; entries: LedgerRow[] }>(`/api/finance/ledger/${user.id}`)
      .then(d => setLedger(d.entries))
      .catch(() => {});
  }, [user.id]);

  const activeAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || !activeAsset) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#71717A',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
    });

    if (chartStyle === 'candles') {
      const series = chart.addCandlestickSeries({
        upColor: '#F5F5F7',
        downColor: '#52525B',
        borderUpColor: '#F5F5F7',
        borderDownColor: '#52525B',
        wickUpColor: '#F5F5F7',
        wickDownColor: '#52525B',
      });
      series.setData(activeAsset.series);
    } else {
      const series = chart.addAreaSeries({
        lineColor: '#F5F5F7',
        topColor: 'rgba(255,255,255,0.14)',
        bottomColor: 'rgba(255,255,255,0.0)',
        lineWidth: 2,
      });
      series.setData(activeAsset.series.map(p => ({ time: p.time, value: p.close })));
    }

    chart.timeScale().fitContent();

    const onResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [activeAsset, chartStyle]);

  const lastBar = activeAsset?.series[activeAsset.series.length - 1];
  const firstBar = activeAsset?.series[0];
  const pctChange =
    lastBar && firstBar ? (((lastBar.close - firstBar.open) / firstBar.open) * 100).toFixed(2) : '0.00';
  const isUp = Number(pctChange) >= 0;

  return (
    <div className="min-h-full w-full bg-black text-[#F5F5F7]">
      {/* Pure Containerless Markets & Sandbox Ledger Column */}
      <div className="max-w-[900px] mx-auto min-h-screen border-x border-white/[0.08]">
        {/* Top Balance & Mode Hairline Row */}
        <header className="px-5 py-5 border-b border-white/[0.08] flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono-num text-[#71717A] tracking-wider uppercase">
              {lang === 'ar' ? 'الرصيد التجريبي • Sandbox' : 'Sandbox Balance'}
            </div>
            <div className="text-3xl font-mono-num font-semibold text-white mt-1">
              {user.demoBalanceEgp.toLocaleString('en-US')} <span className="text-sm text-[#71717A]">EGP</span>
            </div>
          </div>

          <div className="text-end">
            <div className="text-[11px] font-mono-num text-[#71717A]">
              {lang === 'ar' ? 'عوائد المحتوى التجريبية' : 'Creator Sandbox Yield'}
            </div>
            <div className="text-lg font-mono-num text-[#E4E4E7] mt-0.5">
              +{user.creatorEarningsEgp.toLocaleString('en-US')} EGP
            </div>
          </div>
        </header>

        {/* Horizontal Hairline Asset Ticker Strip (Zero Cards) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x rtl:divide-x-reverse divide-white/[0.08] border-b border-white/[0.08]">
          {assets.map(asset => {
            const active = asset.symbol === selectedSymbol;
            const last = asset.series[asset.series.length - 1];
            const prev = asset.series[asset.series.length - 2] || last;
            const chg = prev ? (((last.close - prev.close) / prev.close) * 100).toFixed(2) : '0.00';
            const pos = Number(chg) >= 0;

            return (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => setSelectedSymbol(asset.symbol)}
                className={`px-3.5 py-3 text-start transition-colors cursor-pointer ${
                  active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="text-xs font-mono-num font-semibold text-white">{asset.symbol}</div>
                <div className="text-[11.5px] font-mono-num text-[#A1A1AA] mt-0.5">
                  {last?.close.toLocaleString('en-US')}
                </div>
                <div className={`text-[10.5px] font-mono-num mt-0.5 flex items-center gap-0.5 ${pos ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{chg}%</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Instrument Header + Pure #000000 TradingView Chart */}
        {activeAsset && (
          <section className="border-b border-white/[0.08]">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {lang === 'ar' ? activeAsset.nameAr : activeAsset.nameEn}
                </div>
                <div className="flex items-center gap-2.5 mt-1 font-mono-num">
                  <span className="text-2xl font-semibold text-white">
                    {lastBar?.close.toLocaleString('en-US')} {activeAsset.currency}
                  </span>
                  <span className={`text-xs ${isUp ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {isUp ? '+' : ''}
                    {pctChange}% (90D)
                  </span>
                </div>
              </div>

              <div className="inline-flex rounded-full bg-[#09090B] border border-white/[0.09] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setChartStyle('candles')}
                  className={`px-3 py-1 rounded-full cursor-pointer ${
                    chartStyle === 'candles' ? 'bg-white text-black font-semibold' : 'text-[#8E8E93]'
                  }`}
                >
                  {lang === 'ar' ? 'شموع' : 'Candles'}
                </button>
                <button
                  type="button"
                  onClick={() => setChartStyle('area')}
                  className={`px-3 py-1 rounded-full cursor-pointer ${
                    chartStyle === 'area' ? 'bg-white text-black font-semibold' : 'text-[#8E8E93]'
                  }`}
                >
                  {lang === 'ar' ? 'خطي' : 'Line'}
                </button>
              </div>
            </div>

            <div ref={chartContainerRef} className="w-full px-2 pb-3" />
          </section>
        )}

        {/* Double-Entry Sandbox Ledger Rows (Zero Containers) */}
        <section>
          <div className="px-5 py-3 border-b border-white/[0.08] flex items-center justify-between text-xs text-[#71717A]">
            <span>{lang === 'ar' ? 'سجل القيود التجريبي (بدون عمليات بنكية حقيقية)' : 'Sandbox Ledger Entries'}</span>
            <span className="font-mono-num">READ-ONLY SANDBOX</span>
          </div>

          <div className="divide-y divide-white/[0.08]">
            {ledger.map(entry => (
              <div key={entry.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13.5px] text-[#F5F5F7] truncate">{entry.description}</div>
                  <div className="text-[11px] font-mono-num text-[#71717A] mt-0.5 truncate">
                    {entry.debit_account} → {entry.credit_account}
                  </div>
                </div>
                <div className="text-sm font-mono-num font-semibold text-white shrink-0">
                  {entry.amount_egp.toLocaleString('en-US')} EGP
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
