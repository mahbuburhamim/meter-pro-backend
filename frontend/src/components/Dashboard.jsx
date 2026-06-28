import React, { useState } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { AppLauncher } from '@capacitor/app-launcher';
import { 
  Settings as SettingsIcon, 
  Wallet, 
  BarChart3, 
  Sparkles,
  Edit3,
  RefreshCw,
  Clock,
  AlertTriangle,
  Bell
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function Dashboard({ 
  meter, 
  historyData, 
  onRefresh, 
  onManualOverride,
  isRefreshing,
  onNavigateTab
}) {
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualBalance, setManualBalance] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  if (!meter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 premium-card p-8 text-center">
        <p className="text-gray-500">কোনো মিটার খুঁজে পাওয়া যায়নি। Settings এ গিয়ে একটি নতুন মিটার যোগ করুন।</p>
      </div>
    );
  }

  const {
    latest_balance = 0,
    days_remaining = 0,
    is_stale,
    last_fetched_at,
    label,
    meter_number,
    customer_name,
    status
  } = meter;

  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const toBanglaDigits = (num) => {
    if (!num) return '';
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().split('').map(char => {
      const digit = parseInt(char);
      return isNaN(digit) ? char : banglaDigits[digit];
    }).join('');
  };

  const handleCopyMeterNumber = async () => {
    if (!meter_number) return;
    try {
      await Clipboard.write({
        string: meter_number
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      try {
        await navigator.clipboard.writeText(meter_number);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Failed to copy meter number", e);
      }
    }
  };

  const handleLaunchBkash = async () => {
    const packageIdentifier = 'com.bKash.customerapp';
    try {
      const { value } = await AppLauncher.canOpenUrl({ url: packageIdentifier });
      if (value) {
        await AppLauncher.openUrl({ url: packageIdentifier });
      } else {
        await AppLauncher.openUrl({ 
          url: `https://play.google.com/store/apps/details?id=${packageIdentifier}` 
        });
      }
    } catch (err) {
      console.error("Failed to launch app/store", err);
      window.open(`https://play.google.com/store/apps/details?id=${packageIdentifier}`, '_blank');
    }
  };

  const {
    history = [],
    daily_average = 0,
    month_spend = 0,
    estimated_bill = 0
  } = historyData || {};

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualBalance || isNaN(manualBalance)) return;
    onManualOverride(parseFloat(manualBalance));
    setManualBalance('');
    setShowManualModal(false);
  };

  // Convert last_fetched_at to relative time or nice Bangla string
  const formatLastFetched = () => {
    if (!last_fetched_at) return 'N/A';
    const diffMs = new Date() - new Date(last_fetched_at);
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins || 1} মিনিট আগে`;
    }
    return `${diffHrs} ঘণ্টা আগে`;
  };

  // 7-day usage chart data
  const chartData = history.slice(-7).map(item => {
    const dateObj = new Date(item.date);
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const formattedDay = dayNames[dateObj.getDay()];
    return {
      name: formattedDay,
      usage: item.usage,
      rawDate: item.date
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome Header Block */}
      <div className="app-header-bg text-white -mx-4 -mt-8 px-6 pt-8 pb-20 rounded-b-[40px] flex items-center justify-between shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#7C6FF0]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="z-10">
          <p className="text-xs text-[#EDE9FE] font-bold uppercase tracking-wider">স্বাগতম</p>
          <h2 className="text-3xl font-black tracking-tight">{customer_name || 'গ্রাহক'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowNotifications(true)}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-10 relative"
            title="নোটিফিকেশন"
          >
            <Bell className="w-5 h-5" />
            {meter.due_notice && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-rose-500 rounded-full border border-white animate-pulse"></span>
            )}
          </button>
          
          <button 
            onClick={() => onNavigateTab('settings')}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-10"
            title="সেটিংস"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Elevated Balance Card */}
      <div className="premium-card p-6 space-y-6 -mt-16 mx-2 relative z-20 shadow-xl shadow-gray-200/50">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">বর্তমান ব্যালেন্স</span>
          <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-xl">
            A/C {meter_number}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${status === 'deficit' ? 'text-rose-600' : 'text-gray-900'}`}>৳</span>
            <span className={`text-5xl font-black tracking-tight ${status === 'deficit' ? 'text-rose-600' : 'text-gray-900'}`}>
              {latest_balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className={`p-2.5 rounded-full ${status === 'deficit' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-[#EDE9FE] text-[#7C6FF0] hover:bg-[#dcd5fc]'} transition ${isRefreshing ? 'animate-spin' : ''}`}
              title="রিফ্রেশ"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold -mt-2 bg-gray-50/70 border border-gray-100/50 px-2.5 py-1.5 rounded-xl w-fit">
          <Clock className="w-3.5 h-3.5 text-[#7C6FF0] flex-shrink-0" />
          <span>ব্যালেন্স প্রতিদিন রাত ১২:০০ AM-এ আপডেট হয়</span>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
          {status === 'deficit' ? (
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1.5 rounded-full font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>৳{Math.abs(latest_balance).toFixed(2)} ঘাটতি — দ্রুত রিচার্জ করুন</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#EDE9FE] text-[#7C6FF0] px-3 py-1.5 rounded-full font-bold">
              <Clock className="w-3.5 h-3.5 text-[#7C6FF0]" />
              <span>{days_remaining} দিন চলবে</span>
            </div>
          )}
          <span className="text-gray-500 font-medium">
            {formatLastFetched()}
          </span>
        </div>
      </div>

      {/* Stale Data Alert if offline */}
      {is_stale && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-2xl mx-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>সার্ভার অফলাইন; পুরাতন ব্যালেন্স প্রদর্শিত হচ্ছে।</span>
        </div>
      )}

      {/* Row of Three Action Buttons */}
      <div className="grid grid-cols-3 gap-3 px-2">
        <button 
          onClick={() => setShowRechargeModal(true)}
          className="premium-card p-4 flex flex-col items-center gap-2 text-center hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-700">রিচার্জ</span>
        </button>

        <button 
          onClick={() => onNavigateTab('usage')}
          className="premium-card p-4 flex flex-col items-center gap-2 text-center hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="p-3 bg-[#EDE9FE] text-[#7C6FF0] rounded-2xl">
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-700">বিস্তারিত</span>
        </button>

        <button 
          onClick={() => onNavigateTab('insights')}
          className="premium-card p-4 flex flex-col items-center gap-2 text-center hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <span className="text-xs font-bold text-gray-700">পরামর্শ</span>
        </button>
      </div>

      {/* This Month Summary Card */}
      <div className="premium-card p-5 mx-2 space-y-4">
        <h3 className="font-bold text-gray-900 text-sm">এ মাসের সারাংশ</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1 border-r border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase">এ মাসে খরচ</p>
            <p className="text-sm font-black text-gray-800">৳ {month_spend?.toFixed(0)}</p>
          </div>
          <div className="space-y-1 border-r border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase">দৈনিক গড়</p>
            <p className="text-sm font-black text-gray-800">৳ {daily_average?.toFixed(0)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">প্রাক্কলিত বিল</p>
            <p className="text-sm font-black text-gray-800">৳ {estimated_bill?.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* 7-Day Spend Section */}
      <div className="premium-card p-5 mx-2 space-y-4 shadow-lg">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm">৭ দিনের খরচ</h3>
          <button 
            onClick={() => onNavigateTab('usage')}
            className="text-xs font-bold text-[#7C6FF0] hover:underline"
          >
            সব দেখুন
          </button>
        </div>

        <div className="h-44 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#9ca3af" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(91, 79, 207, 0.9)', 
                    borderColor: 'transparent',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '11px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  formatter={(value, name, props) => [`৳${value}`, `তারিখ: ${props.payload.rawDate}`]}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="usage" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === chartData.length - 1 ? '#7C6FF0' : '#EDE9FE'} 
                      className="hover:fill-[#5B4FCF] transition-colors duration-200 cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xs">
              পর্যাপ্ত তথ্য নেই
            </div>
          )}
        </div>
      </div>

      {/* Manual Balance Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="premium-card w-full max-w-md p-6 border border-gray-100 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ব্যালেন্স ম্যানুয়াল আপডেট করুন</h3>
            <p className="text-xs text-gray-500 mb-5">
              মিটারে প্রদর্শিত ব্যালেন্সটি টাইপ করে প্রবেশ করান।
            </p>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">বর্তমান ব্যালেন্স (৳)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="যেমন: 1410.74"
                  value={manualBalance}
                  onChange={(e) => setManualBalance(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#7C6FF0]"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white text-xs font-bold transition"
                >
                  আপডেট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="premium-card w-full max-w-sm p-6 border border-gray-100 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200 space-y-6 relative">
            {/* Close Button */}
            <button 
              onClick={() => { setShowRechargeModal(false); setCopied(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-50 rounded-full transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            <div className="text-center space-y-2 pt-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">মিটার নম্বর</span>
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">{toBanglaDigits(meter_number)}</h3>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyMeterNumber}
              className={`w-full py-4 rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 border ${
                copied 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-50' 
                  : 'bg-[#EDE9FE] border-[#7C6FF0]/10 text-[#5B4FCF] hover:bg-[#dcd5fc]'
              }`}
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-in zoom-in-50"><path d="M20 6 9 17l-5-5"/></svg>
                  কপি হয়েছে!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  মিটার নাম্বার কপি করুন
                </>
              )}
            </button>

            {/* Instruction */}
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </div>
              <p className="text-xs text-gray-600 font-bold leading-relaxed pt-0.5 text-left">
                bKash-এ Pay Bill &gt; Electricity &gt; NESCO সিলেক্ট করে পেস্ট করুন।
              </p>
            </div>

            {/* bKash Launcher Button */}
            <button
              onClick={handleLaunchBkash}
              className="w-full py-4 bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white font-black rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-100 active:scale-[0.98]"
            >
              <span>বিকাশে প্রবেশ করুন</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-white text-gray-900 rounded-[32px] w-full max-w-sm p-6 border border-gray-100 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-[#7C6FF0] pb-3 border-b border-gray-100 mb-4">
              <div className="p-2.5 bg-[#EDE9FE] text-[#7C6FF0] rounded-xl relative">
                <Bell className="w-5 h-5" />
                {meter.due_notice && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
                )}
              </div>
              <h3 className="text-lg font-black text-gray-900">নোটিফিকেশন</h3>
            </div>

            <div className="my-5 max-h-60 overflow-y-auto pr-1">
              {meter.due_notice ? (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-800 leading-relaxed text-left whitespace-pre-wrap font-medium">
                    {meter.due_notice}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-gray-400 gap-2">
                  <Bell className="w-10 h-10 stroke-[1.2px]" />
                  <p className="text-xs font-semibold text-gray-500">কোনো নতুন নোটিফিকেশন নেই।</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button 
                type="button"
                onClick={() => setShowNotifications(false)}
                className="w-full py-3.5 rounded-2xl bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white text-xs font-black transition active:scale-[0.98] shadow-md shadow-indigo-150"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
