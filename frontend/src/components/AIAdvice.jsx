import React from 'react';
import { 
  Sparkles, 
  Receipt, 
  Calendar, 
  Clock, 
  Settings as SettingsIcon 
} from 'lucide-react';

export default function AIAdvice({ 
  meter, 
  historyData,
  onNavigateToSettings 
}) {
  if (!meter) return null;

  const {
    latest_balance = 0,
    days_remaining = 0
  } = meter;

  const {
    history = [],
    daily_average = 0,
    estimated_bill = 0
  } = historyData || {};

  // Calculate today's usage
  const todayStr = new Date().toISOString().split('T')[0];
  const todayHistory = history.find(h => h.date === todayStr);
  const todaySpend = todayHistory ? todayHistory.usage : (history.length > 0 ? history[history.length - 1].usage : 0.0);

  // Suggested Recharge: daily average * 30, rounded to nearest 50
  const suggestedRecharge = Math.ceil((daily_average * 30) / 50) * 50;

  // Analysis text rules
  const spendComparison = todaySpend > daily_average 
    ? `আজকের খরচ ৳${todaySpend.toFixed(0)} – গড়ের চেয়ে বেশি` 
    : `আজকের খরচ ৳${todaySpend.toFixed(0)} – গড়ের চেয়ে কম`;
  
  const rechargeWarning = days_remaining <= 3
    ? `আপনার মিটারে আর মাত্র ${days_remaining} দিনের ব্যালেন্স আছে। অবিলম্বে রিচার্জ করুন!`
    : `ব্যালেন্স ফুরানোর আগে ${Math.max(1, Math.floor(days_remaining - 1))} দিনের মধ্যে রিচার্জ করুন`;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">AI পরামর্শ</h2>
          <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            <Sparkles className="w-2.5 h-2.5 fill-current" />
            AI চালিত
          </span>
        </div>
        <button 
          onClick={onNavigateToSettings}
          className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Hero Green Card */}
      <div className="app-header-bg text-white rounded-3xl p-8 relative overflow-hidden shadow-xl shadow-emerald-950/10">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-12 -mt-12 pointer-events-none"></div>
        <div className="absolute bottom-0 right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col space-y-4">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <p className="text-xs text-emerald-300 font-medium tracking-wide">আপনার গড় ব্যবহারের ভিত্তিতে</p>
            <h3 className="text-4xl font-black mt-1 tracking-tight">{days_remaining} দিন চলবে</h3>
          </div>
        </div>
      </div>

      {/* Suggested Recharge Card */}
      <div className="premium-card p-6 flex items-center justify-between shadow-md">
        <div className="space-y-1">
          <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">প্রস্তাবিত রিচার্জ</p>
          <p className="text-3xl font-extrabold text-gray-900">৳ {suggestedRecharge.toLocaleString('bn-BD')}</p>
          <p className="text-xs text-gray-500">৩০ দিনের জন্য যথেষ্ট</p>
        </div>
        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
          <Receipt className="w-6 h-6" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 premium-card p-5 text-center">
        <div className="space-y-1 border-r border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase">আজ</p>
          <p className="text-lg font-black text-gray-800">৳ {todaySpend.toFixed(0)}</p>
        </div>
        <div className="space-y-1 border-r border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase">৭ দিনের গড়</p>
          <p className="text-lg font-black text-gray-800">৳ {daily_average.toFixed(0)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase">মাস শেষে</p>
          <p className="text-lg font-black text-gray-800">৳ {estimated_bill.toFixed(0)}</p>
        </div>
      </div>

      {/* Personal Analysis Cards */}
      <div className="space-y-4">
        <h4 className="font-bold text-gray-900 text-base">ব্যক্তিগত বিশ্লেষণ</h4>
        
        {/* Bullet Item 1 */}
        <div className="premium-card p-4 flex items-center gap-4 hover:border-emerald-500/20 hover:-translate-y-0.5 transition duration-200">
          <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-gray-700 leading-snug">{spendComparison}</p>
        </div>

        {/* Bullet Item 2 */}
        <div className="premium-card p-4 flex items-center gap-4 hover:border-emerald-500/20 hover:-translate-y-0.5 transition duration-200">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-gray-700 leading-snug">{rechargeWarning}</p>
        </div>
      </div>
    </div>
  );
}
