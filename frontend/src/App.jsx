import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BarChart3,
  Sparkles,
  User,
  Zap,
  Loader,
  Lock,
  CheckCircle2,
  ArrowRight,
  Settings as SettingsIcon
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import UsageHistory from './components/UsageHistory';
import AIAdvice from './components/AIAdvice';
import Settings from './components/Settings';
import Profile from './components/Profile';
import Footer from './components/Footer';

const getApiBase = () => {
  const savedUrl = localStorage.getItem('backend_url');
  if (savedUrl) {
    return savedUrl.replace(/\/$/, '') + '/api';
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '') + '/api';
  }
  // Detect if running inside Capacitor
  const isCapacitor = window.hasOwnProperty('Capacitor') || (window.location.origin.startsWith('http://localhost') && !window.location.port);
  if (isCapacitor) {
    return 'https://meter-pro-api.onrender.com/api';
  }
  return '/api';
};

const API_BASE = getApiBase();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('active_meter_id'));
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [meters, setMeters] = useState([]);
  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [selectedRange, setSelectedRange] = useState('7d');
  const [telegramSettings, setTelegramSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Login form state
  const [loginMeterNo, setLoginMeterNo] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(localStorage.getItem('backend_url') || 'https://meter-pro-api.onrender.com');

  // Fetch initial data
  useEffect(() => {
    fetchMeters();
    fetchTelegramSettings();
  }, []);

  // Fetch history when selected meter or range changes
  useEffect(() => {
    if (selectedMeterId && isLoggedIn) {
      fetchHistory(selectedMeterId, selectedRange);
    }
  }, [selectedMeterId, selectedRange, isLoggedIn]);

  const fetchMeters = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/meters`);
      if (!res.ok) throw new Error("Failed to fetch meters");
      const data = await res.json();
      setMeters(data);
      
      const savedActiveId = localStorage.getItem('active_meter_id');
      if (savedActiveId) {
        const found = data.find(m => m.id.toString() === savedActiveId);
        if (found) {
          setSelectedMeterId(found.id);
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('active_meter_id');
          setIsLoggedIn(false);
        }
      } else if (data.length > 0 && !selectedMeterId) {
        setSelectedMeterId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(`সার্ভার থেকে মিটার ডেটা লোড করা যায়নি (সার্ভার ইউআরএল: ${API_BASE}/meters)। দয়া করে নেটওয়ার্ক ও ইউআরএল চেক করুন।`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTelegramSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        setTelegramSettings(data);
      }
    } catch (err) {
      console.error("Error fetching Telegram settings:", err);
    }
  };

  const fetchHistory = async (id, range) => {
    try {
      const res = await fetch(`${API_BASE}/meters/${id}/history?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistoryData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefresh = async () => {
    if (!selectedMeterId) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/meters/${selectedMeterId}/refresh`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchMeters();
        await fetchHistory(selectedMeterId, selectedRange);
      }
    } catch (err) {
      console.error(err);
      alert(`সার্ভার থেকে ডেটা রিফ্রেশ করতে ব্যর্থ হয়েছে (ইউআরএল: ${API_BASE}/meters/${selectedMeterId}/refresh)।`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualOverride = async (balance) => {
    if (!selectedMeterId) return;
    try {
      const res = await fetch(`${API_BASE}/meters/${selectedMeterId}/manual-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance })
      });
      if (res.ok) {
        await fetchMeters();
        await fetchHistory(selectedMeterId, selectedRange);
      }
    } catch (err) {
      console.error(err);
      alert(`ম্যানুয়াল ব্যালেন্স আপডেট ব্যর্থ হয়েছে (ইউআরএল: ${API_BASE}/meters/${selectedMeterId}/manual-balance)।`);
    }
  };

  const handleAddMeter = async (meterData) => {
    try {
      const res = await fetch(`${API_BASE}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meterData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMeters();
        setSelectedMeterId(data.id);
        localStorage.setItem('active_meter_id', data.id.toString());
        setIsLoggedIn(true);
        setActiveTab('dashboard');
      } else {
        const errData = await res.json();
        alert(errData.detail || "মিটার যোগ করতে ব্যর্থ হয়েছে।");
      }
    } catch (err) {
      console.error(err);
      alert(`মিটার যোগ করতে ব্যর্থ হয়েছে (ইউআরএল: ${API_BASE}/meters)।`);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginMeterNo) return;
    setIsLoggingIn(true);
    try {
      // 1. Fetch current meters list to check if it already exists
      const resMeters = await fetch(`${API_BASE}/meters`);
      const allMeters = resMeters.ok ? await resMeters.json() : [];
      
      const existing = allMeters.find(m => m.meter_number.trim() === loginMeterNo.trim());
      if (existing) {
        // Meter exists, select it and log in
        localStorage.setItem('active_meter_id', existing.id.toString());
        setSelectedMeterId(existing.id);
        setMeters(allMeters);
        setIsLoggedIn(true);
        setActiveTab('dashboard');
        setIsLoggingIn(false);
        return;
      }

      // 2. Otherwise register a new meter with default label "আমার মিটার" and default threshold 200
      const res = await fetch(`${API_BASE}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_number: loginMeterNo.trim(),
          label: 'আমার মিটার',
          alert_threshold: 200.0
        })
      });

      if (res.ok) {
        const data = await res.json();
        await fetchMeters();
        setSelectedMeterId(data.id);
        localStorage.setItem('active_meter_id', data.id.toString());
        setIsLoggedIn(true);
        setActiveTab('dashboard');
      } else {
        const errData = await res.json();
        alert(errData.detail || "মিটার সংযোগ করতে ব্যর্থ হয়েছে।");
      }
    } catch (err) {
      console.error(err);
      alert(`সার্ভার সংযোগ ত্রুটি (ইউআরএল: ${API_BASE}/meters)। দয়া করে আপনার সার্ভার ইউআরএল সেটিংস চেক করুন।`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_number: 'TEST12345',
          label: 'আমার মিটার (Demo)',
          alert_threshold: 200.0
        })
      });
      if (res.ok || res.status === 400) { // status 400 means already exists
        await fetchMeters();
        // find TEST12345 ID
        const resMeters = await fetch(`${API_BASE}/meters`);
        const allMeters = await resMeters.json();
        const demoMeter = allMeters.find(m => m.meter_number === 'TEST12345');
        if (demoMeter) {
          localStorage.setItem('active_meter_id', demoMeter.id.toString());
          setSelectedMeterId(demoMeter.id);
          setIsLoggedIn(true);
          setActiveTab('dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      alert(`সার্ভার সংযোগ ত্রুটি (ইউআরএল: ${API_BASE}/meters)। দয়া করে আপনার সার্ভার ইউআরএল সেটিংস চেক করুন।`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (confirm("আপনি কি নিশ্চিত লগআউট করতে চান?")) {
      localStorage.removeItem('active_meter_id');
      setIsLoggedIn(false);
      setSelectedMeterId(null);
      setHistoryData(null);
    }
  };

  const handleDeleteMeter = async (id) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই মিটারটি ডিলিট করতে চান?")) return;
    try {
      const res = await fetch(`${API_BASE}/meters/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedMeterId === id) {
          localStorage.removeItem('active_meter_id');
          setSelectedMeterId(null);
          setHistoryData(null);
          setIsLoggedIn(false);
        }
        await fetchMeters();
      }
    } catch (err) {
      console.error(err);
      alert(`মিটার ডিলিট করতে ব্যর্থ হয়েছে (ইউআরএল: ${API_BASE}/meters/${id})।`);
    }
  };

  const handleUpdateThreshold = async (id, threshold) => {
    try {
      const res = await fetch(`${API_BASE}/meters/${id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_threshold: threshold })
      });
      if (res.ok) {
        await fetchMeters();
        if (selectedMeterId === id) {
          await fetchHistory(id, selectedRange);
        }
      }
    } catch (err) {
      console.error(err);
      alert(`অ্যালার্ট সীমা আপডেট করতে ব্যর্থ হয়েছে (ইউআরএল: ${API_BASE}/meters/${id}/settings)।`);
    }
  };

  const handleUpdateTelegramSettings = async (settings) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramSettings(data);
        alert("টেলিগ্রাম সেটিংস সফলভাবে আপডেট হয়েছে!");
      }
    } catch (err) {
      console.error(err);
      alert(`টেলিগ্রাম সেটিংস আপডেট করতে ব্যর্থ হয়েছে (ইউআরএল: ${API_BASE}/settings)।`);
    }
  };

  const activeMeter = meters.find(m => m.id === selectedMeterId);

  // REDESIGNED WELCOME / LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen app-header-bg text-white overflow-y-auto flex flex-col items-center py-8 px-6">
        <div className="max-w-md w-full flex flex-col gap-6 items-stretch">
          
          {/* Top Logo and Header */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#5B4FCF] shadow-md">
                <Zap className="w-6 h-6 fill-current text-[#5B4FCF]" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-none">Meter Pro</h1>
                <p className="text-[10px] text-[#EDE9FE] font-bold uppercase tracking-wider mt-1">প্রিপেইড মিটার ব্যবস্থাপনা</p>
              </div>
            </div>
            <button 
              onClick={() => setShowServerModal(true)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition z-10"
              title="সার্ভার সংযোগ সেটিংস"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Slogan Intro */}
          <div className="space-y-1.5">
            <h2 className="text-3xl font-black leading-tight tracking-tight text-white">
              আপনার নেসকো<br />
              প্রিপেইড মিটারের<br />
              তথ্য সব এক জায়গায়
            </h2>
            <p className="text-xs text-white/90 leading-normal font-light">
              ব্যালেন্স, ব্যবহার, রিচার্জ – সবকিছু এক ট্যাপে।
            </p>
          </div>

          {/* Error Message if Server Connection Fails */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-950 p-4 rounded-2xl text-xs font-semibold relative z-10 flex flex-col gap-1 shadow-md">
              <span className="font-bold text-rose-700">সার্ভার সংযোগ পাওয়া যায়নি:</span>
              <span className="font-mono text-[10px] text-rose-800 break-all">{error}</span>
              <button 
                type="button" 
                onClick={fetchMeters}
                className="mt-1.5 px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-950 rounded-lg text-[10px] font-black self-start transition"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          )}

          {/* Login Form Card */}
          <div className="bg-white text-gray-900 rounded-[32px] p-6 shadow-2xl space-y-5 relative z-10">
            {/* Pill Badge */}
            <div className="flex items-center gap-1.5 bg-[#EDE9FE] text-[#5B4FCF] text-[10px] font-bold px-3 py-1 rounded-full w-fit">
              <Zap className="w-3 h-3 fill-current text-[#7C6FF0]" />
              NESCO প্রিপেইড
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-gray-900 leading-snug">অ্যাকাউন্ট নম্বর দিন</h3>
              <p className="text-xs text-gray-600 font-medium">
                ব্যালেন্স ও ব্যবহার সরাসরি NESCO থেকে – সেকেন্ডেই।
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="relative">
                {/* Custom Plug/Connection Icon */}
                <div className="absolute left-4 top-3.5 text-gray-500 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plug">
                    <path d="M12 2v6" />
                    <path d="M6 8h12v1a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" />
                    <path d="M10 14v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-4" />
                    <path d="M8 2v4" />
                    <path d="M16 2v4" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="যেমন: 32011435"
                  value={loginMeterNo}
                  onChange={(e) => setLoginMeterNo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold focus:outline-none focus:border-[#7C6FF0]"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-4 bg-[#EDE9FE] hover:bg-[#dcd5fc] text-[#5B4FCF] font-black rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow shadow-indigo-100/50"
              >
                {isLoggingIn ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin text-[#5B4FCF]" />
                    লোড হচ্ছে...
                  </>
                ) : (
                  <>
                    এগিয়ে যান
                    <ArrowRight className="w-4 h-4 text-[#5B4FCF]" />
                  </>
                )}
              </button>
            </form>

            {/* Bullet list of trust features */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100 text-[10px] text-gray-600 font-bold uppercase">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-gray-600" />
                নিরাপদ
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-gray-600" />
                অফিসিয়াল ডেটা
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-gray-600" />
                রিয়েল-টাইম
              </span>
            </div>
          </div>

          {/* Subtext link for Demo Try */}
          <div className="text-center">
            <button 
              onClick={handleDemoLogin}
              className="text-xs text-white/90 font-bold hover:underline py-2"
            >
              ডেমো মিটার দিয়ে চেষ্টা করুন
            </button>
          </div>
        </div>

        <div className="py-2 text-center border-t border-white/10 mt-4 animate-fade-in">
          <Footer />
        </div>

        {showServerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
            <div className="bg-white text-gray-900 rounded-[32px] w-full max-w-sm p-6 border border-gray-100 shadow-2xl mx-4 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">সার্ভার সংযোগ সেটিংস</h3>
              <p className="text-xs text-gray-500 mb-5 font-medium">
                আপনার ব্যাকএন্ড সার্ভারের URLটি প্রবেশ করান (যেমন আপনার কম্পিউটারের LAN IP):
              </p>
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                localStorage.setItem('backend_url', inputUrl); 
                window.location.reload(); 
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">সার্ভার ইউআরএল (API URL)</label>
                  <input 
                    type="text"
                    required
                    placeholder="যেমন: https://meter-pro-api.onrender.com"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-[#7C6FF0]"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowServerModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white text-xs font-bold transition"
                  >
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MAIN APPLICATION VIEW (LOGGED IN)
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f7f9fb] pb-16">
      <div>
        {/* Main Content Area */}
        <main className="max-w-6xl mx-auto px-4 py-8 pb-20">
          {activeTab === 'settings' ? (
            <Settings 
              meters={meters}
              onAddMeter={handleAddMeter}
              onDeleteMeter={handleDeleteMeter}
              onUpdateThreshold={handleUpdateThreshold}
              telegramSettings={telegramSettings}
              onUpdateTelegramSettings={handleUpdateTelegramSettings}
              backendUrl={localStorage.getItem('backend_url') || ''}
              onUpdateBackendUrl={(url) => {
                localStorage.setItem('backend_url', url);
                window.location.reload();
              }}
              onNavigateBack={() => setActiveTab('dashboard')}
              onLogout={handleLogout}
            />
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-96 gap-3">
              <Loader className="w-8 h-8 text-[#7C6FF0] animate-spin" />
              <p className="text-sm text-gray-500 font-medium">লোড হচ্ছে...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 premium-card max-w-md mx-auto p-8 border-rose-500/20">
              <p className="text-rose-500 font-medium mb-5">{error}</p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button 
                  onClick={fetchMeters} 
                  className="w-full py-3 bg-[#7C6FF0] hover:bg-[#5B4FCF] text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95"
                >
                  আবার চেষ্টা করুন
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition active:scale-95"
                >
                  সার্ভার সংযোগ পরিবর্তন করুন
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  meter={activeMeter} 
                  historyData={historyData}
                  onRefresh={handleRefresh}
                  onManualOverride={handleManualOverride}
                  isRefreshing={isRefreshing}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'usage' && (
                <UsageHistory 
                  meter={activeMeter}
                  historyData={historyData}
                  selectedRange={selectedRange}
                  onRangeChange={setSelectedRange}
                  onNavigateToSettings={() => setActiveTab('settings')}
                />
              )}

              {activeTab === 'insights' && (
                <AIAdvice 
                  meter={activeMeter}
                  historyData={historyData}
                  onNavigateToSettings={() => setActiveTab('settings')}
                />
              )}

              {activeTab === 'profile' && (
                <Profile
                  meter={activeMeter}
                  apiBase={API_BASE}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Bottom Sticky Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2.5 flex justify-between items-center z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.02)]">
        {[
          { id: 'dashboard', label: 'হোম', icon: LayoutDashboard },
          { id: 'usage', label: 'হিসাব', icon: BarChart3 },
          { id: 'insights', label: 'AI পরামর্শ', icon: Sparkles },
          { id: 'profile', label: 'আপনার তথ্য', icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 flex-1 transition-colors duration-200 ${
                isActive ? 'text-[#5B4FCF] font-black' : 'text-gray-500 font-semibold'
              }`}
            >
              <Icon className={`w-5.5 h-5.5 ${isActive ? 'stroke-[2.5px] text-[#5B4FCF]' : 'stroke-[1.8px]'}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Subtle branding Footer */}
      <div className="pb-16 text-center">
        <Footer />
      </div>
    </div>
  );
}
