import React, { useState, useEffect } from 'react';
import { User, ShieldAlert, RefreshCw, FileText } from 'lucide-react';

export default function Profile({ meter, apiBase }) {
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (meter) {
      fetchCustomerInfo();
    }
  }, [meter]);

  const fetchCustomerInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/meters/${meter.id}/customer-info`);
      if (!res.ok) {
        throw new Error("গ্রাহক তথ্য লোড করতে ব্যর্থ হয়েছে");
      }
      const data = await res.json();
      setProfileData(data);
    } catch (err) {
      console.error(err);
      setError("সার্ভার থেকে গ্রাহক প্রোফাইল লোড করা সম্ভব হয়নি। দয়া করে নেটওয়ার্ক সংযোগ পরীক্ষা করুন।");
    } finally {
      setIsLoading(false);
    }
  };

  if (!meter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 premium-card p-8 text-center">
        <p className="text-gray-500">কোনো মিটার খুঁজে পাওয়া যায়নি।</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">আপনার তথ্য</h2>
        <button 
          onClick={fetchCustomerInfo}
          disabled={isLoading}
          className={`p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition ${isLoading ? 'animate-spin' : ''}`}
          title="রিফ্রেশ"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-80 gap-3 premium-card p-6">
          <div className="w-8 h-8 text-[#7C6FF0] animate-spin border-4 border-solid border-current border-r-transparent rounded-full" role="status"></div>
          <p className="text-sm text-gray-500 font-medium">তথ্য লোড হচ্ছে...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 premium-card max-w-md mx-auto p-8 border-rose-500/20 space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <p className="text-rose-500 font-medium">{error}</p>
          <button 
            onClick={fetchCustomerInfo} 
            className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-xs transition font-black shadow-sm"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      ) : profileData ? (
        <div className="space-y-6">
          {/* Main Visual Profile Card */}
          <div className="app-header-bg text-white rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-[#7C6FF0]/10 flex items-center gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-[#EDE9FE] shadow-inner backdrop-blur-md">
              <User className="w-9 h-9 text-[#EDE9FE]" />
            </div>
            <div className="z-10 space-y-1">
              <h3 className="text-xl font-black tracking-tight">{profileData.customer_name || 'গ্রাহকের নাম পাওয়া যায়নি'}</h3>
              <p className="text-xs text-[#EDE9FE]/90 font-medium tracking-wide">কনজ্যুমার নং: {profileData.consumer_number}</p>
              <p className="text-[10px] bg-white/15 text-white font-bold uppercase tracking-wider px-2 py-0.5 rounded-md w-fit">
                {profileData.electricity_office || 'N/A'}
              </p>
            </div>
          </div>

          {/* Profile details grid */}
          <div className="premium-card p-6 divide-y divide-gray-100">
            {[
              { label: 'গ্রাহকের নাম', val: profileData.customer_name },
              { label: 'পিতা/স্বামীর নাম', val: profileData.father_husband_name || 'N/A' },
              { label: 'ঠিকানা', val: profileData.address },
              { label: 'মোবাইল', val: profileData.mobile },
              { label: 'সংশ্লিষ্ট বিদ্যুৎ অফিস', val: profileData.electricity_office },
              { label: 'ফিডারের নাম', val: profileData.feeder_name },
              { label: 'কনজ্যুমার নম্বর', val: profileData.consumer_number },
              { label: 'মিটার নম্বর', val: profileData.meter_number },
              { label: 'অনুমোদিত লোড', val: profileData.approved_load ? `${profileData.approved_load} kW` : 'N/A' },
              { label: 'অনুমোদিত ট্যারিফ', val: profileData.approved_tariff },
              { label: 'মিটারের ধরন', val: profileData.meter_type },
              { label: 'মিটার স্ট্যাটাস', val: profileData.meter_status },
              { label: 'মিটার স্থাপনের তারিখ', val: profileData.installation_date },
              { label: 'মিনিমাম রিচার্জের পরিমাণ', val: profileData.min_recharge_amount ? `৳ ${profileData.min_recharge_amount}` : 'N/A' },
            ].map((field, idx) => (
              <div key={idx} className="flex justify-between items-center py-3.5 text-xs">
                <span className="font-semibold text-gray-500">{field.label}</span>
                <span className="font-bold text-gray-900 text-right max-w-[60%] break-words">{field.val || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
