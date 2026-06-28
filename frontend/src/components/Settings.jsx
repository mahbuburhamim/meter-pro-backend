import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Globe,
  Info,
  Mail,
  User,
  LogOut,
  Send,
  Loader
} from 'lucide-react';

export default function Settings({ 
  meters, 
  onAddMeter, 
  onDeleteMeter, 
  onUpdateThreshold,
  telegramSettings,
  onUpdateTelegramSettings,
  backendUrl,
  onUpdateBackendUrl,
  onNavigateBack,
  onLogout
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newMeterNo, setNewMeterNo] = useState('');
  const [newThreshold, setNewThreshold] = useState(200);

  // Active meter for threshold settings
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [customThreshold, setCustomThreshold] = useState(200);

  // Toggles
  const [pushEnabled, setPushEnabled] = useState(true);
  const [repeatEnabled, setRepeatEnabled] = useState(true);

  // Connection URL inputs
  const [inputUrl, setInputUrl] = useState(backendUrl || '');

  // Telegram bot state
  const [botInfo, setBotInfo] = useState({
    is_configured: false,
    bot_username: null,
    is_linked: false,
    chat_id: null
  });
  const [isLoadingBotInfo, setIsLoadingBotInfo] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);
  const [showDevMenu, setShowDevMenu] = useState(false);

  const getBaseUrl = () => {
    if (backendUrl) return backendUrl;
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '');
    }
    return 'https://meter-pro-api.onrender.com';
  };
  const actualBackendUrl = getBaseUrl();

  const fetchBotInfo = async () => {
    try {
      const res = await fetch(`${actualBackendUrl.replace(/\/$/, '')}/api/telegram/bot-info`);
      if (res.ok) {
        const data = await res.json();
        setBotInfo(data);
      }
    } catch (err) {
      console.error("Error fetching bot info:", err);
    } finally {
      setIsLoadingBotInfo(false);
    }
  };

  useEffect(() => {
    if (meters && meters.length > 0 && !selectedMeterId) {
      setSelectedMeterId(meters[0].id.toString());
      setCustomThreshold(meters[0].alert_threshold);
    }
  }, [meters, selectedMeterId]);

  useEffect(() => {
    fetchBotInfo();
  }, [backendUrl]);

  // Polling logic when isPolling becomes true
  useEffect(() => {
    let intervalId;
    if (isPolling) {
      let count = 0;
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`${actualBackendUrl.replace(/\/$/, '')}/api/telegram/bot-info`);
          if (res.ok) {
            const data = await res.json();
            if (data.is_linked) {
              setBotInfo(data);
              setIsPolling(false);
              alert("✅ Telegram সফলভাবে যুক্ত হয়েছে!");
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
        count++;
        if (count >= 40) { // Stop polling after 2 mins
          setIsPolling(false);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPolling, backendUrl]);

  const handleMeterChangeForThreshold = (id) => {
    setSelectedMeterId(id);
    const meter = meters.find(m => m.id.toString() === id);
    if (meter) {
      setCustomThreshold(meter.alert_threshold);
    }
  };

  const handleThresholdIncrement = () => {
    const newVal = customThreshold + 50;
    setCustomThreshold(newVal);
    if (selectedMeterId) {
      onUpdateThreshold(parseInt(selectedMeterId), newVal);
    }
  };

  const handleThresholdDecrement = () => {
    const newVal = Math.max(0, customThreshold - 50);
    setCustomThreshold(newVal);
    if (selectedMeterId) {
      onUpdateThreshold(parseInt(selectedMeterId), newVal);
    }
  };

  const handlePresetThreshold = (value) => {
    setCustomThreshold(value);
    if (selectedMeterId) {
      onUpdateThreshold(parseInt(selectedMeterId), value);
    }
  };

  const handleAddMeterSubmit = (e) => {
    e.preventDefault();
    if (!newLabel || !newMeterNo) return;
    onAddMeter({
      label: newLabel,
      meter_number: newMeterNo,
      alert_threshold: parseFloat(newThreshold)
    });
    setNewLabel('');
    setNewMeterNo('');
    setNewThreshold(200);
  };

  const handleConnectTelegram = () => {
    if (!botInfo.bot_username) return;
    const activeMeter = meters.find(m => m.id.toString() === selectedMeterId.toString()) || meters[0];
    const meterParam = activeMeter ? activeMeter.meter_number : 'default';
    const deepLink = `https://t.me/${botInfo.bot_username}?start=${meterParam}`;
    
    if (window.hasOwnProperty('Capacitor') || window.Capacitor) {
      window.open(deepLink, '_system');
    } else {
      window.open(deepLink, '_blank');
    }
    setIsPolling(true);
  };

  const handleDisconnectTelegram = async () => {
    if (!confirm("আপনি কি নিশ্চিত সংযোগ বিচ্ছিন্ন করতে চান?")) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`${actualBackendUrl.replace(/\/$/, '')}/api/telegram/disconnect`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchBotInfo();
        alert("সংযোগ বিচ্ছিন্ন করা হয়েছে।");
      }
    } catch (err) {
      console.error(err);
      alert("সংযোগ বিচ্ছিন্ন করতে ব্যর্থ হয়েছে।");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVersionClick = () => {
    const nextTaps = versionTaps + 1;
    if (nextTaps >= 7) {
      setShowDevMenu(true);
      setVersionTaps(0);
      alert("🔓 ডেভেলপার অপশন সক্রিয় হয়েছে!");
    } else {
      setVersionTaps(nextTaps);
    }
  };


  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onNavigateBack}
          className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black text-gray-900">সেটিংস</h2>
        <div className="p-2.5 rounded-full bg-[#EDE9FE] text-[#7C6FF0]">
          <SettingsIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Main Alerts Group */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1">অ্যালার্ট</h3>
        
        {/* Toggle Toggles */}
        <div className="premium-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-gray-800">পুশ নোটিফিকেশন</h4>
              <p className="text-xs text-gray-500">ব্যালেন্স কমলে জানানো হবে</p>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={pushEnabled} 
                onChange={(e) => setPushEnabled(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-gray-800">বারবার অ্যালার্ট</h4>
              <p className="text-xs text-gray-500">ব্যালেন্স কম থাকলে প্রতি চেকে জানানো হবে</p>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={repeatEnabled} 
                onChange={(e) => setRepeatEnabled(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Alert Threshold Card */}
        <div className="premium-card p-5 space-y-4">
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-gray-800">অ্যালার্টের সীমা</h4>
            <p className="text-xs text-gray-500">ব্যালেন্স এই অঙ্কের নিচে নামলে জানানো হবে</p>
          </div>

          {meters && meters.length > 0 && (
            <div className="mb-2">
              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">মিটার নির্বাচন</label>
              <select 
                value={selectedMeterId}
                onChange={(e) => handleMeterChangeForThreshold(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#7C6FF0]"
              >
                {meters.map(m => (
                  <option key={m.id} value={m.id}>{m.label} ({m.meter_number})</option>
                ))}
              </select>
            </div>
          )}

          {/* Plus/Minus input group */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl p-2.5 max-w-xs mx-auto">
            <button 
              onClick={handleThresholdDecrement}
              className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center font-bold text-gray-600 shadow-sm active:bg-gray-100"
            >
              -
            </button>
            <span className="text-lg font-black text-gray-900">৳ {customThreshold}</span>
            <button 
              onClick={handleThresholdIncrement}
              className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center font-bold text-gray-600 shadow-sm active:bg-gray-100"
            >
              +
            </button>
          </div>

          {/* Preset buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[100, 200, 500, 1000].map(val => (
              <button
                key={val}
                onClick={() => handlePresetThreshold(val)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                  customThreshold === val
                    ? 'bg-[#5B4FCF] border-[#5B4FCF] text-white shadow'
                    : 'bg-white border-gray-100 text-gray-500 hover:text-gray-800'
                }`}
              >
                ৳ {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* General Settings Group */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1">সাধারণ সেটিংস</h3>
        
        {/* Language Row */}
        <div className="premium-card p-4 flex items-center justify-between hover:border-[#7C6FF0]/10 transition">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#EDE9FE] text-[#7C6FF0] rounded-xl">
              <Globe className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-gray-800">ভাষা</span>
          </div>
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
            বাংলা
            <span className="text-gray-300 font-light">&gt;</span>
          </span>
        </div>

        {/* Telegram Notification card */}
        <div className="premium-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#EDE9FE] text-[#7C6FF0] rounded-xl">
                <Send className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-800">টেলিগ্রাম নোটিফিকেশন</h4>
                <p className="text-xs text-gray-500">ব্যালেন্স কমলে টেলিগ্রামে অ্যালার্ট পান</p>
              </div>
            </div>
          </div>

          {isLoadingBotInfo ? (
            <div className="flex items-center justify-center py-2 gap-2 text-xs text-gray-500 font-medium">
              <Loader className="w-4 h-4 animate-spin text-[#7C6FF0]" />
              টেলিগ্রাম তথ্য লোড হচ্ছে...
            </div>
          ) : !botInfo.is_configured ? (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-normal">
              ⚠️ টেলিগ্রাম নোটিফিকেশন বর্তমানে নিষ্ক্রিয় রয়েছে (সার্ভারে Bot Token সেট করা নেই)।
            </div>
          ) : botInfo.is_linked ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <span className="font-bold">✅ Telegram সফলভাবে যুক্ত হয়েছে</span>
                <span className="font-mono bg-emerald-100/50 px-2 py-0.5 rounded text-[10px]">ID: {botInfo.chat_id}</span>
              </div>
              <button
                type="button"
                onClick={handleDisconnectTelegram}
                disabled={isActionLoading}
                className="w-full py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 text-xs font-bold transition flex items-center justify-center gap-1 active:scale-98"
              >
                {isActionLoading ? <Loader className="w-4 h-4 animate-spin" /> : "সংযোগ বিচ্ছিন্ন করুন"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                আপনার টেলিগ্রাম অ্যাকাউন্টে অ্যালার্ট পেতে নিচের বাটনে ক্লিক করে আমাদের বটের সাথে চ্যাট শুরু করুন।
              </p>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConnectTelegram}
                  className="flex-1 py-2.5 rounded-xl bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white font-bold text-xs transition shadow flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                  Telegram-এ যুক্ত করুন
                </button>
                
                <button
                  type="button"
                  onClick={fetchBotInfo}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-150 text-gray-700 font-bold text-xs transition flex items-center justify-center gap-1 active:scale-98"
                  title="রিফ্রেশ করুন"
                >
                  {isActionLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : "Done"}
                </button>
              </div>

              {isPolling && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 rounded-lg py-1.5 px-3">
                  <Loader className="w-3.5 h-3.5 animate-spin text-[#7C6FF0]" />
                  টেলিগ্রাম সংযোগের জন্য অপেক্ষা করা হচ্ছে (বটে /start চাপুন)...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meter Management Settings Group */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1">মিটার ব্যবস্থাপনা</h3>

        {/* Manage Meters list */}
        <div className="premium-card p-5 space-y-4">
          <h4 className="font-bold text-sm text-gray-800">সক্রিয় মিটার তালিকা</h4>
          
          <form onSubmit={handleAddMeterSubmit} className="space-y-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <h5 className="text-[10px] font-bold text-gray-600 uppercase">নতুন মিটার যোগ করুন</h5>
            <input
              type="text"
              required
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="লেবেল (যেমন: বাসা, দোকান)"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#7C6FF0]"
            />
            <input
              type="text"
              required
              value={newMeterNo}
              onChange={(e) => setNewMeterNo(e.target.value)}
              placeholder="মিটার / কাস্টমার নম্বর"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#7C6FF0]"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-[#EDE9FE] text-[#7C6FF0] hover:bg-[#dcd5fc] text-xs font-bold transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              মিটার যোগ করুন
            </button>
          </form>

          <div className="divide-y divide-gray-100">
            {meters.map(m => (
              <div key={m.id} className="flex justify-between items-center py-3">
                <div>
                  <h5 className="font-bold text-sm text-gray-800">{m.label}</h5>
                  <p className="text-[10px] text-gray-500 font-medium">নম্বর: {m.meter_number} | সীমা: ৳{m.alert_threshold}</p>
                </div>
                <button
                  onClick={() => onDeleteMeter(m.id)}
                  className="p-2 text-gray-500 hover:text-rose-600 bg-gray-50 rounded-xl hover:bg-rose-50 border border-gray-100 hover:border-rose-100 transition"
                  title="মিটার অপসারণ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Logout Section */}
        <div className="premium-card p-5 space-y-4">
          <h4 className="font-bold text-sm text-gray-800">লগআউট (Logout)</h4>
          <p className="text-xs text-gray-500">বর্তমান মিটার সংযোগ থেকে বিচ্ছিন্ন হয়ে নতুন মিটার নম্বর দিয়ে লগইন করতে এখানে ক্লিক করুন।</p>
          <button
            onClick={onLogout}
            className="w-full py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-500 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1"
          >
            <LogOut className="w-4 h-4" />
            লগআউট করুন
          </button>
        </div>

        {/* About App Developer */}
        <div className="premium-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#7C6FF0] pb-2 border-b border-gray-100">
            <Info className="w-5 h-5" />
            <h4 className="font-bold">অ্যাপ তথ্য ও নির্মাতা</h4>
          </div>
          <div className="space-y-3 text-xs text-gray-600">
            <p className="font-black text-gray-800 text-sm">NESCO Balance Tracker</p>
            <p 
              onClick={handleVersionClick}
              className="text-[10px] text-gray-500 cursor-pointer select-none active:text-[#7C6FF0] hover:underline"
            >
              ভার্সন: 1.0.0 (MVP) {showDevMenu && "(Developer)"}
            </p>
            <p className="leading-relaxed">
              প্রোঅ্যাক্টিভ ব্যালেন্স ও বিদ্যুৎ ব্যবহার ট্র্যাকার। এটি NESCO প্রিপেইড মিটার গ্রাহকদের স্বয়ংক্রিয় অ্যালার্ট সিস্টেম।
            </p>
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[#7C6FF0]" />
                <span>নির্মাতা: <span className="font-bold text-gray-700">Mahbubur Hamim</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#7C6FF0]" />
                <span>যোগাযোগ: <a href="mailto:hello@movnex.com" className="text-[#7C6FF0] hover:underline">hello@movnex.com</a></span>
              </div>
            </div>
          </div>
        </div>

        {/* Gated Developer Menu */}
        {showDevMenu && (
          <div className="premium-card p-5 space-y-4 border border-[#7C6FF0]/30 shadow-md bg-indigo-50/20 animate-in fade-in slide-in-from-bottom duration-200">
            <h4 className="font-black text-sm text-[#7C6FF0] uppercase tracking-wide">👨‍💻 ডেভেলপার অপশন</h4>
            <div className="space-y-3">
              <h5 className="font-bold text-xs text-gray-800">সার্ভার সংযোগ (API Base URL)</h5>
              <form onSubmit={(e) => { e.preventDefault(); onUpdateBackendUrl(inputUrl); }} className="space-y-3">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="যেমন: https://meter-pro-api.onrender.com"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-[#7C6FF0]"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white font-bold text-xs transition shadow"
                >
                  সংযোগ ইউআরএল আপডেট করুন
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

