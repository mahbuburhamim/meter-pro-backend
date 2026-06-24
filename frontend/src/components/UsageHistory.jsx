import React, { useState, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { 
  Check, 
  Settings as SettingsIcon, 
  Info 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function UsageHistory({ 
  meter, 
  historyData, 
  selectedRange, 
  onRangeChange,
  onNavigateToSettings,
  apiBase
}) {
  const [toastMessage, setToastMessage] = useState(null);
  const [monthlyUsage, setMonthlyUsage] = useState([]);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);

  useEffect(() => {
    if (selectedRange === '1y' && meter && apiBase) {
      fetchMonthlyUsage();
    }
  }, [selectedRange, meter, apiBase]);

  const fetchMonthlyUsage = async () => {
    setIsMonthlyLoading(true);
    try {
      const res = await fetch(`${apiBase}/meters/${meter.id}/monthly-usage`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyUsage(data);
      }
    } catch (err) {
      console.error("Failed to fetch monthly usage", err);
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const handleCopyToken = async (token) => {
    if (!token) return;
    const cleanToken = token.trim().replace(/\s+/g, '-');
    try {
      await Clipboard.write({
        string: cleanToken
      });
      showToast("টোকেন কপি হয়েছে");
    } catch (err) {
      try {
        await navigator.clipboard.writeText(cleanToken);
        showToast("টোকেন কপি হয়েছে");
      } catch (e) {
        console.error("Failed to copy token", e);
      }
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };
  if (!meter) return null;

  const {
    history = [],
    recharges = [],
    total_spend = 0,
    daily_average = 0,
    highest_daily_spend = 0
  } = historyData || {};

  // Find the date of the highest daily spend
  const highestSpendItem = history.find(h => h.usage === highest_daily_spend);
  const highestSpendDate = highestSpendItem ? highestSpendItem.date : '';

  const toBanglaDigits = (num) => {
    if (!num) return '';
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().split('').map(char => {
      const digit = parseInt(char);
      return isNaN(digit) ? char : banglaDigits[digit];
    }).join('');
  };

  const translateMonth = (engMonth) => {
    const monthsMap = {
      'January': 'জানু', 'Jan': 'জানু',
      'February': 'ফেব্রু', 'Feb': 'ফেব্রু',
      'March': 'মার্চ', 'Mar': 'মার্চ',
      'April': 'এপ্রি', 'Apr': 'এপ্রি',
      'May': 'মে',
      'June': 'জুন', 'Jun': 'জুন',
      'July': 'জুলা', 'Jul': 'জুলা',
      'August': 'আগ', 'Aug': 'আগ',
      'September': 'সেপ্টে', 'Sep': 'সেপ্টে',
      'October': 'অক্টো', 'Oct': 'অক্টো',
      'November': 'নভে', 'Nov': 'নভে',
      'December': 'ডিসে', 'Dec': 'ডিসে'
    };
    return monthsMap[engMonth] || engMonth;
  };

  const translateFullMonth = (engMonth) => {
    const monthsMap = {
      'January': 'জানুয়ারি', 'Jan': 'জানুয়ারি',
      'February': 'ফেব্রুয়ারি', 'Feb': 'ফেব্রুয়ারি',
      'March': 'মার্চ', 'Mar': 'মার্চ',
      'April': 'এপ্রিল', 'Apr': 'এপ্রিল',
      'May': 'মে',
      'June': 'জুন', 'Jun': 'জুন',
      'July': 'জুলাই', 'Jul': 'জুলাই',
      'August': 'আগস্ট', 'Aug': 'আগস্ট',
      'September': 'সেপ্টেম্বর', 'Sep': 'সেপ্টেম্বর',
      'October': 'অক্টোবর', 'Oct': 'অক্টোবর',
      'November': 'নভেম্বর', 'Nov': 'নভেম্বর',
      'December': 'ডিসেম্বর', 'Dec': 'ডিসেম্বর'
    };
    return monthsMap[engMonth] || engMonth;
  };

  let displayTotalSpend = total_spend;
  let displayDailyAverage = daily_average;
  let displayHighestSpend = highest_daily_spend;
  let displayHighestSpendDate = highestSpendDate;
  let highestSpendTitle = "সর্বোচ্চ দিন";

  if (selectedRange === '1y') {
    const totalUsage = monthlyUsage.reduce((acc, item) => acc + (parseFloat(item.usage.toString().replace(/,/g, '')) || 0), 0);
    displayTotalSpend = totalUsage;
    
    const totalMonths = monthlyUsage.length;
    displayDailyAverage = totalMonths > 0 ? (totalUsage / (totalMonths * 30.4)) : 0;
    
    let maxMonthUsage = 0;
    let maxMonthName = '';
    monthlyUsage.forEach(item => {
      const u = parseFloat(item.usage.toString().replace(/,/g, '')) || 0;
      if (u > maxMonthUsage) {
        maxMonthUsage = u;
        maxMonthName = `${translateFullMonth(item.month)} ${toBanglaDigits(item.year)}`;
      }
    });
    highestSpendTitle = "সর্বোচ্চ মাস";
    displayHighestSpend = maxMonthUsage;
    displayHighestSpendDate = maxMonthName;
  }

  // Format chart data based on date
  const chartData = selectedRange === '1y' 
    ? [...monthlyUsage].reverse().map(item => {
        const usageVal = parseFloat(item.usage.toString().replace(/,/g, '')) || 0;
        return {
          name: translateMonth(item.month),
          usage: usageVal,
          rawDate: `${translateFullMonth(item.month)} ${toBanglaDigits(item.year)}`
        };
      })
    : history.map(item => {
        const dateObj = new Date(item.date);
        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const formattedDay = dayNames[dateObj.getDay()];
        
        let label = '';
        if (selectedRange === '7d') {
          label = formattedDay;
        } else if (selectedRange === '30d') {
          label = dateObj.getDate().toString();
        }

        return {
          name: label,
          usage: item.usage,
          rawDate: item.date
        };
      });

  const maxUsageVal = Math.max(...chartData.map(d => d.usage), 0);

  const getCellFill = (entry, index) => {
    if (selectedRange === '1y') {
      return entry.usage === maxUsageVal && maxUsageVal > 0 ? '#FF6B5B' : '#7C6FF0';
    }
    return index === chartData.length - 1 ? '#7C6FF0' : '#EDE9FE';
  };

  const renderCustomBarLabel = ({ x, y, width, value }) => {
    if (selectedRange !== '1y') return null;
    return (
      <text 
        x={x + width / 2} 
        y={y - 6} 
        fill="#4b5563" 
        fontSize={8} 
        fontWeight="bold" 
        textAnchor="middle"
      >
        {value ? Math.round(value) : ''}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">ব্যবহারের হিসাব</h2>
        </div>
        <button 
          onClick={onNavigateToSettings}
          className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Range Selector Capsule */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full">
        {[
          { id: '7d', label: '৭ দিন' },
          { id: '30d', label: '৩০ দিন' },
          { id: '1y', label: 'বছর' }
        ].map(r => (
          <button
            key={r.id}
            onClick={() => onRangeChange(r.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-center transition ${
              selectedRange === r.id 
                ? 'bg-[#5B4FCF] text-white shadow' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary Aggregate Card */}
      <div className="premium-card p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1 border-r border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase">মোট খরচ</p>
            <p className="text-sm font-black text-gray-900">৳ {displayTotalSpend?.toFixed(0)}</p>
          </div>
          <div className="space-y-1 border-r border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase">দৈনিক গড়</p>
            <p className="text-sm font-black text-gray-900">৳ {displayDailyAverage?.toFixed(0)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">{highestSpendTitle}</p>
            <p className="text-sm font-black text-rose-500">৳ {displayHighestSpend?.toFixed(0)}</p>
            {displayHighestSpendDate && (
              <p className="text-[8px] text-gray-500 font-medium">{displayHighestSpendDate}</p>
            )}
          </div>
        </div>
      </div>

      {/* Chart Card */}
      <div className="premium-card p-5 space-y-4 shadow-sm">
        <div className="h-56 w-full flex items-center justify-center">
          {isMonthlyLoading ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-6 w-6 text-[#7C6FF0]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs text-gray-500 font-medium">লোড হচ্ছে...</span>
            </div>
          ) : chartData.length > 0 ? (
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
                <Bar 
                  dataKey="usage" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30}
                  label={renderCustomBarLabel}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getCellFill(entry, index)} 
                      className="hover:fill-[#5B4FCF] transition duration-150 cursor-pointer"
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

      {/* Recharge History List */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-900 text-sm">রিচার্জ ইতিহাস</h3>
        
        <div className="space-y-3">
          {recharges.length > 0 ? (
            recharges.map((r, index) => (
              <div 
                key={index} 
                className="premium-card p-5 flex items-center justify-between hover:border-[#7C6FF0]/20 transition duration-200"
              >
                {/* Left check circle + details */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#7C6FF0] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    {/* Amount: Large, bold, most prominent */}
                    <h4 className="text-xl font-black text-gray-900 tracking-tight">
                      ৳ {parseFloat(r.amount).toLocaleString('en-US')}
                    </h4>
                    {/* Via + Date: Smaller text, secondary line */}
                    <p className="text-xs text-gray-500 font-semibold">
                      {r.via || 'N/A'} · {r.date}
                    </p>
                    {/* Token number: Smaller text, its own line, full token visible */}
                    {r.token && (
                      <button 
                        onClick={() => handleCopyToken(r.token)}
                        className="block text-[11px] text-[#7C6FF0] hover:text-[#5B4FCF] font-mono font-bold bg-[#EDE9FE]/50 hover:bg-[#EDE9FE] px-2.5 py-1 rounded-lg transition text-left cursor-pointer border border-[#7C6FF0]/10 mt-1 active:scale-[0.98]"
                        title="কপি করতে ক্লিক করুন"
                      >
                        টোকেন: {r.token.trim().replace(/\s+/g, '-')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Right successful status badge */}
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${r.status?.toLowerCase() === 'success' ? 'text-[#7C6FF0] bg-[#EDE9FE] border border-[#7C6FF0]/20' : 'text-rose-600 bg-rose-50 border border-rose-100'}`}>
                  {r.status === 'Success' ? 'সফল' : (r.status === 'Failed' ? 'ব্যর্থ' : r.status)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500 text-xs gap-1.5 premium-card">
              <Info className="w-4 h-4 text-gray-300" />
              <span>কোনো রিচার্জ ইতিহাস পাওয়া যায়নি</span>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white px-4 py-2.5 rounded-xl text-xs font-bold z-50 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
