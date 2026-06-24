import React from 'react';
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
  onNavigateToSettings
}) {
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

  // Format chart data based on date
  const chartData = history.map(item => {
    const dateObj = new Date(item.date);
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const formattedDay = dayNames[dateObj.getDay()];
    
    let label = '';
    if (selectedRange === '7d') {
      label = formattedDay;
    } else if (selectedRange === '30d') {
      label = dateObj.getDate().toString();
    } else {
      label = dateObj.toLocaleDateString('bn-BD', { month: 'short' });
    }

    return {
      name: label,
      usage: item.usage,
      rawDate: item.date
    };
  });

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
                ? 'bg-emerald-950 text-white shadow' 
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
            <p className="text-sm font-black text-gray-900">৳ {total_spend?.toFixed(0)}</p>
          </div>
          <div className="space-y-1 border-r border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase">দৈনিক গড়</p>
            <p className="text-sm font-black text-gray-900">৳ {daily_average?.toFixed(0)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">সর্বোচ্চ দিন</p>
            <p className="text-sm font-black text-rose-500">৳ {highest_daily_spend?.toFixed(0)}</p>
            {highestSpendDate && (
              <p className="text-[8px] text-gray-500 font-medium">{highestSpendDate}</p>
            )}
          </div>
        </div>
      </div>

      {/* Chart Card */}
      <div className="premium-card p-5 space-y-4 shadow-sm">
        <div className="h-56 w-full">
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
                    background: 'rgba(11, 70, 44, 0.9)', 
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
                <Bar dataKey="usage" radius={[4, 4, 0, 0]} maxBarSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === chartData.length - 1 ? '#0b462c' : '#a7f3d0'} 
                      className="hover:fill-emerald-800 transition duration-150 cursor-pointer"
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
                className="premium-card p-4 flex items-center justify-between hover:border-emerald-500/10 transition"
              >
                {/* Left check circle + details */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-extrabold text-sm text-gray-800">৳ {parseFloat(r.amount).toLocaleString('en-US')}</h5>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {r.date} · <span className="lowercase">{r.via || 'N/A'}</span>
                    </p>
                    {r.token && (
                      <p className="text-[9px] text-gray-500 font-mono">টোকেন: {r.token}</p>
                    )}
                  </div>
                </div>

                {/* Right successful status badge */}
                <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full">
                  সফল
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
    </div>
  );
}
