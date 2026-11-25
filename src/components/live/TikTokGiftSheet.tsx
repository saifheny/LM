import React, { useState } from 'react';
import { Coins, CreditCard, Smartphone, Wallet, X } from 'lucide-react';

export interface TikTokGiftItem {
  id: string;
  icon: string;
  name: string;
  price: number;
  tier: 'classic' | 'premium' | 'legendary';
}

export const TIKTOK_50_GIFTS: TikTokGiftItem[] = [
  { id: 'g01', icon: '🌹', name: 'وردة', price: 1, tier: 'classic' },
  { id: 'g02', icon: '🫶', name: 'قلب باليد', price: 1, tier: 'classic' },
  { id: 'g03', icon: '🍦', name: 'آيس كريم', price: 1, tier: 'classic' },
  { id: 'g04', icon: '🎮', name: 'GG', price: 1, tier: 'classic' },
  { id: 'g05', icon: '🎤', name: 'مايك لايف', price: 5, tier: 'classic' },
  { id: 'g06', icon: '🫰', name: 'إشارة حب', price: 5, tier: 'classic' },
  { id: 'g07', icon: '☕', name: 'قهوة سريعة', price: 10, tier: 'classic' },
  { id: 'g08', icon: '👋', name: 'تحية', price: 10, tier: 'classic' },
  { id: 'g09', icon: '🧴', name: 'عطر فاخر', price: 20, tier: 'classic' },
  { id: 'g10', icon: '💌', name: 'رسالة حب', price: 25, tier: 'classic' },
  { id: 'g11', icon: '🍩', name: 'دونات', price: 30, tier: 'classic' },
  { id: 'g12', icon: '🕶️', name: 'نظارة شمس', price: 49, tier: 'classic' },
  { id: 'g13', icon: '🧢', name: 'كاب', price: 99, tier: 'classic' },
  { id: 'g14', icon: '🦢', name: 'بجعة ورقية', price: 99, tier: 'classic' },
  { id: 'g15', icon: '🎊', name: 'احتفال', price: 100, tier: 'classic' },
  { id: 'g16', icon: '💞', name: 'قلوب متألقة', price: 100, tier: 'classic' },
  { id: 'g17', icon: '💐', name: 'باقة ورد', price: 150, tier: 'classic' },
  { id: 'g18', icon: '🪄', name: 'عصا سحرية', price: 199, tier: 'classic' },
  { id: 'g19', icon: '💘', name: 'سهم قلب', price: 199, tier: 'classic' },
  { id: 'g20', icon: '🥊', name: 'قفاز ملاكمة', price: 299, tier: 'premium' },
  { id: 'g21', icon: '🐶', name: 'كورجي', price: 299, tier: 'premium' },
  { id: 'g22', icon: '🎸', name: 'جيتار', price: 300, tier: 'premium' },
  { id: 'g23', icon: '🎆', name: 'ألعاب نارية', price: 499, tier: 'premium' },
  { id: 'g24', icon: '🐼', name: 'باندا', price: 500, tier: 'premium' },
  { id: 'g25', icon: '💸', name: 'مدفع كاش', price: 500, tier: 'premium' },
  { id: 'g26', icon: '🦢', name: 'بجعة بيضاء', price: 699, tier: 'premium' },
  { id: 'g27', icon: '🚂', name: 'قطار سريع', price: 899, tier: 'premium' },
  { id: 'g28', icon: '🌌', name: 'المجرة', price: 1000, tier: 'premium' },
  { id: 'g29', icon: '👑', name: 'التاج الذهبي', price: 1200, tier: 'premium' },
  { id: 'g30', icon: '💍', name: 'خاتم ألماس', price: 1500, tier: 'premium' },
  { id: 'g31', icon: '🪔', name: 'فانوس مضيء', price: 1800, tier: 'premium' },
  { id: 'g32', icon: '🐋', name: 'قفزة الحوت', price: 2150, tier: 'premium' },
  { id: 'g33', icon: '🗼', name: 'برج القاهرة', price: 2500, tier: 'premium' },
  { id: 'g34', icon: '🏍️', name: 'دراجة نارية', price: 2988, tier: 'premium' },
  { id: 'g35', icon: '🚤', name: 'جت سكي', price: 3500, tier: 'premium' },
  { id: 'g36', icon: '🏎️', name: 'سيارة رياضية', price: 5000, tier: 'legendary' },
  { id: 'g37', icon: '🚁', name: 'هليكوبتر', price: 6000, tier: 'legendary' },
  { id: 'g38', icon: '🛩️', name: 'طائرة خاصة', price: 7500, tier: 'legendary' },
  { id: 'g39', icon: '🛥️', name: 'يخت فاخر', price: 9888, tier: 'legendary' },
  { id: 'g40', icon: '🦅', name: 'الصقر الذهبي', price: 10000, tier: 'legendary' },
  { id: 'g41', icon: '🔥', name: 'العنقاء', price: 12000, tier: 'legendary' },
  { id: 'g42', icon: '🏰', name: 'القلعة الملكية', price: 15000, tier: 'legendary' },
  { id: 'g43', icon: '☄️', name: 'وابل الشهب', price: 18000, tier: 'legendary' },
  { id: 'g44', icon: '💎', name: 'مطر الألماس', price: 19999, tier: 'legendary' },
  { id: 'g45', icon: '🦄', name: 'بيجاسوس', price: 20000, tier: 'legendary' },
  { id: 'g46', icon: '🏺', name: 'كنز فرعوني', price: 25000, tier: 'legendary' },
  { id: 'g47', icon: '🐉', name: 'التنين الناري', price: 26999, tier: 'legendary' },
  { id: 'g48', icon: '🦁', name: 'الأسد الذهبي', price: 29999, tier: 'legendary' },
  { id: 'g49', icon: '🪐', name: 'كوكب LM', price: 32000, tier: 'legendary' },
  { id: 'g50', icon: '🚀', name: 'كون تيك توك', price: 34999, tier: 'legendary' },
];

const PAYMENT_METHODS = [
  { id: 'coins', label: 'عملات LM', icon: Coins },
  { id: 'wallet', label: 'المحفظة', icon: Wallet },
  { id: 'vodafone', label: 'فودافون كاش', icon: Smartphone },
  { id: 'card', label: 'بطاقة', icon: CreditCard },
];

export function TikTokGiftSheet({
  balance,
  onClose,
  onSendGift,
}: {
  balance: number;
  onClose: () => void;
  onSendGift: (gift: TikTokGiftItem, paymentMethodLabel: string) => void;
}) {
  const [tab, setTab] = useState<'all' | 'classic' | 'premium' | 'legendary'>('all');
  const [selected, setSelected] = useState<TikTokGiftItem>(TIKTOK_50_GIFTS[0]);
  const [payMethod, setPayMethod] = useState('coins');

  const list = tab === 'all' ? TIKTOK_50_GIFTS : TIKTOK_50_GIFTS.filter(g => g.tier === tab);
  const currentPay = PAYMENT_METHODS.find(p => p.id === payMethod) || PAYMENT_METHODS[0];

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl bg-[#07070A]/96 backdrop-blur-xl border-t border-white/[0.14] flex flex-col max-h-[58vh]"
    >
      {/* Header Tabs */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs">
          {[
            { id: 'all' as const, label: `الكل (${TIKTOK_50_GIFTS.length})` },
            { id: 'classic' as const, label: 'شائعة' },
            { id: 'premium' as const, label: 'فاخرة' },
            { id: 'legendary' as const, label: 'أسطورية' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pb-0.5 cursor-pointer transition-colors ${
                tab === t.id ? 'text-white font-semibold border-b border-white' : 'text-[#71717A] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 50-Gift Scrollable Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
        {list.map(g => {
          const isSel = selected.id === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g)}
              className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer border ${
                isSel
                  ? 'bg-white/[0.12] border-white/35'
                  : 'bg-transparent border-transparent hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-2xl leading-none">{g.icon}</span>
              <span className="text-[11px] text-[#F5F5F7] truncate w-full text-center">{g.name}</span>
              <span className="text-[10px] font-mono-num text-[#FACC15] flex items-center gap-0.5">
                {g.price.toLocaleString('en-US')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Payment Method Selector + Send Footer */}
      <div className="px-4 py-3 border-t border-white/[0.08] bg-black/80 space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {PAYMENT_METHODS.map(pm => {
            const Icon = pm.icon;
            const active = payMethod === pm.id;
            return (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPayMethod(pm.id)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer border transition-colors ${
                  active
                    ? 'bg-white text-black border-white font-semibold'
                    : 'bg-[#0C0C0F] border-white/[0.1] text-[#A1A1AA] hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{pm.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[#A1A1AA] font-mono-num">
            الرصيد: <span className="text-white font-semibold">{balance.toLocaleString('en-US')}</span>
          </div>

          <button
            type="button"
            onClick={() => onSendGift(selected, currentPay.label)}
            className="px-5 py-2 rounded-full bg-[#FF2D55] hover:bg-[#ff1c47] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span>إرسال {selected.icon} {selected.name}</span>
            <span className="font-mono-num opacity-90">({selected.price.toLocaleString('en-US')})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
